/**
 * 上传前的图片压缩：最长边 1600px、体积上限 500KB，统一输出 WebP。
 *
 * 选 WebP 的原因：它是当前浏览器能通过 canvas 编码的、体积最小的格式，且支持透明；
 * AVIF 更小但浏览器无法编码，只能由 CDN 在交付时用 format=auto 转出来。
 *
 * 设计原则：任何情况都不 throw —— 压缩失败就退回原图上传，
 * 不让「压缩能力」绑架整条上传链路。
 */

export interface CompressOptions {
  /** 目标体积上限（字节），默认 500KB */
  maxSize?: number
  /** 最长边上限（像素），默认 1600 */
  maxDimension?: number
  /** 初始编码质量，默认 0.82 */
  initialQuality?: number
  /** 质量下限，到此不再降质量、改为缩尺寸，默认 0.5 */
  minQuality?: number
  /** 每次降质量的步长，默认 0.1 */
  qualityStep?: number
  /** 触及质量下限后每轮缩边的比例，默认 0.8 */
  scaleStep?: number
  /** 最大编码轮数，默认 6（防死循环） */
  maxAttempts?: number
}

export interface CompressResult {
  /** 真正要上传的文件；跳过或失败时就是入参的原文件 */
  file: File
  /** 是否执行过重编码 */
  compressed: boolean
  originalSize: number
  finalSize: number
  width?: number
  height?: number
  /** 最终 MIME，决定后端生成的扩展名 */
  type: string
  /** 是否达到 maxSize 要求 */
  withinLimit: boolean
  /** 跳过或降级原因，便于排查 */
  reason?: string
}

const DEFAULTS: Required<CompressOptions> = {
  maxSize: 500 * 1024,
  maxDimension: 1600,
  initialQuality: 0.82,
  minQuality: 0.5,
  qualityStep: 0.1,
  scaleStep: 0.8,
  maxAttempts: 6
}

/** 缩到这个下限就停手，再小就没法看了 */
const MIN_DIMENSION = 320

/** 采样透明通道时用的缩略尺寸 */
const ALPHA_SAMPLE_SIZE = 24

const EXT_BY_MIME: Record<string, string> = {
  'image/webp': '.webp',
  'image/jpeg': '.jpg',
  'image/png': '.png'
}

// ---------------------------------------------------------------------------
// canvas 句柄：把 DOM canvas 与 OffscreenCanvas 两条路径隔离开，
// 避免在 strict 下对联合类型的上下文调用重载方法
// ---------------------------------------------------------------------------

interface CanvasHandle {
  /** 把源图画满整块画布；fillWhite 用于 JPEG 输出（无透明通道，不铺白底会变黑） */
  draw(source: CanvasImageSource, fillWhite: boolean): void
  /** 是否含透明像素（读整块画布） */
  hasTransparentPixel(): boolean
  encode(mime: string, quality: number): Promise<Blob | null>
}

function createCanvas(width: number, height: number): CanvasHandle {
  const canUseOffscreen =
    typeof OffscreenCanvas !== 'undefined' &&
    typeof OffscreenCanvas.prototype.convertToBlob === 'function'

  if (canUseOffscreen) {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (ctx) return wrapOffscreen(canvas, ctx)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建 canvas 2d 上下文')
  return wrapDom(canvas, ctx)
}

function wrapDom(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): CanvasHandle {
  return {
    draw(source, fillWhite) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (fillWhite) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    },
    hasTransparentPixel() {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) return true
      }
      return false
    },
    encode(mime, quality) {
      return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality))
    }
  }
}

function wrapOffscreen(canvas: OffscreenCanvas, ctx: OffscreenCanvasRenderingContext2D): CanvasHandle {
  return {
    draw(source, fillWhite) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (fillWhite) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    },
    hasTransparentPixel() {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 255) return true
      }
      return false
    },
    async encode(mime, quality) {
      try {
        return await canvas.convertToBlob({ type: mime, quality })
      } catch (error) {
        console.warn('[compressImage] OffscreenCanvas 编码失败：', error)
        return null
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 能力探测：不支持 WebP 编码的浏览器调 toBlob('image/webp') 不报错，
// 而是静默返回一个 PNG Blob，所以必须校验回传的 type
// ---------------------------------------------------------------------------

let webpSupport: boolean | null = null

async function canEncodeWebp(): Promise<boolean> {
  if (webpSupport !== null) return webpSupport

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8))
    webpSupport = !!blob && blob.type === 'image/webp'
  } catch (error) {
    console.warn('[compressImage] WebP 能力探测失败，按不支持处理：', error)
    webpSupport = false
  }
  return webpSupport
}

/** 缩到 24×24 扫 alpha 通道，判断源图是否含透明像素 */
function hasTransparentPixel(img: HTMLImageElement): boolean {
  try {
    const handle = createCanvas(ALPHA_SAMPLE_SIZE, ALPHA_SAMPLE_SIZE)
    handle.draw(img, false)
    return handle.hasTransparentPixel()
  } catch (error) {
    console.warn('[compressImage] 透明通道检测失败，按不透明处理：', error)
    return false
  }
}

/**
 * 决定输出格式：优先 WebP；浏览器不支持 WebP 时，含透明的图必须留 PNG
 * （走 JPEG 会把透明区域压成黑块），不透明的照片用 JPEG 更省体积
 */
async function pickOutputMime(img: HTMLImageElement, sourceType: string): Promise<string> {
  if (await canEncodeWebp()) return 'image/webp'

  const sourceMightHaveAlpha = sourceType === 'image/png' || sourceType === 'image/webp'
  if (sourceMightHaveAlpha && hasTransparentPixel(img)) return 'image/png'
  return 'image/jpeg'
}

// ---------------------------------------------------------------------------
// 解码：用 <img> 而不是 createImageBitmap
// 现代浏览器会给 <img> 自动应用 EXIF 方向，drawImage 沿用已定向的像素，
// 等于免费拿到正确方向；createImageBitmap 的 imageOrientation 在 Safari 上支持不一致
// ---------------------------------------------------------------------------

function decodeImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    let settled = false

    const ok = () => {
      if (settled) return
      settled = true
      resolve(img)
    }
    const fail = () => {
      if (settled) return
      settled = true
      reject(new Error('图片解码失败'))
    }

    img.onload = ok
    img.onerror = fail
    img.src = url
    // decode() 可能因图片已缓存而立刻 resolve，这里与 onload 做竞态兜底
    if (typeof img.decode === 'function') {
      img.decode().then(ok).catch(fail)
    }
  })
}

function renameExt(originalName: string, mime: string): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot > 0 ? originalName.slice(0, dot) : originalName
  return `${base || 'image'}${EXT_BY_MIME[mime] ?? ''}`
}

function skipped(file: File, reason: string, opts: Required<CompressOptions>): CompressResult {
  return {
    file,
    compressed: false,
    originalSize: file.size,
    finalSize: file.size,
    type: file.type,
    withinLimit: file.size <= opts.maxSize,
    reason
  }
}

/**
 * 压缩图片：最长边 1600px、≤500KB、统一 WebP。
 * 非图片（含 PDF）、GIF、空文件原样返回；任何失败也原样返回。
 */
export async function compressImage(file: File, options?: CompressOptions): Promise<CompressResult> {
  const opts = { ...DEFAULTS, ...options }

  if (!file.type.startsWith('image/')) return skipped(file, 'not-image', opts)
  if (file.type === 'image/gif') return skipped(file, 'gif', opts)
  if (file.size === 0) return skipped(file, 'empty', opts)

  let objectUrl = ''
  try {
    objectUrl = URL.createObjectURL(file)
    const img = await decodeImage(objectUrl)

    const naturalWidth = img.naturalWidth
    const naturalHeight = img.naturalHeight
    if (!naturalWidth || !naturalHeight) return skipped(file, 'zero-dimension', opts)

    // 只缩不放：小图保持原尺寸，仅换格式重编码
    const longest = Math.max(naturalWidth, naturalHeight)
    const scale = Math.min(1, opts.maxDimension / longest)
    let width = Math.max(1, Math.round(naturalWidth * scale))
    let height = Math.max(1, Math.round(naturalHeight * scale))

    const outputMime = await pickOutputMime(img, file.type)
    // PNG 忽略质量参数，只有缩尺寸这一条路
    const canTuneQuality = outputMime !== 'image/png'

    let quality = opts.initialQuality
    let best: Blob | null = null
    let withinLimit = false

    for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
      // 画布尺寸在创建时固定，所以每轮按当前目标尺寸重建
      const handle = createCanvas(width, height)
      handle.draw(img, outputMime === 'image/jpeg')
      const blob = await handle.encode(outputMime, quality)
      if (!blob) break

      if (!best || blob.size < best.size) best = blob
      if (blob.size <= opts.maxSize) {
        withinLimit = true
        break
      }

      if (canTuneQuality && quality > opts.minQuality) {
        quality = Math.max(opts.minQuality, quality - opts.qualityStep)
      } else if (Math.max(width, height) > MIN_DIMENSION) {
        width = Math.max(1, Math.round(width * opts.scaleStep))
        height = Math.max(1, Math.round(height * opts.scaleStep))
      } else {
        break
      }
    }

    if (!best) return skipped(file, 'encode-failed', opts)

    // 重编码反而更大时保留原图：永远是「选更小的那个」，避免越压越肥
    if (best.size >= file.size) {
      return skipped(file, 'larger-than-source', opts)
    }

    const compressed = new File([best], renameExt(file.name, outputMime), {
      type: outputMime,
      lastModified: Date.now()
    })

    if (!withinLimit) {
      console.warn('[compressImage] 已压到最小但仍超过目标体积，按最小结果上传：', {
        originalSize: file.size,
        finalSize: compressed.size,
        maxSize: opts.maxSize
      })
    }

    return {
      file: compressed,
      compressed: true,
      originalSize: file.size,
      finalSize: compressed.size,
      width,
      height,
      type: outputMime,
      withinLimit,
      reason: withinLimit ? undefined : 'over-limit-best-effort'
    }
  } catch (error) {
    console.warn('[compressImage] 压缩失败，改用原图上传：', error)
    return skipped(file, 'error', opts)
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}
