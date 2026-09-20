/**
 * 上传前的本地校验。
 *
 * 这里卡的是「压缩前的原始文件」体积，所以上限给得比较宽松：
 * 手机原图动辄 10-20MB，但上传前会由 utils/image.ts 压到 500KB 以内，
 * 最终的 10MB 硬限制由后端（src/routes/upload.ts）把关。
 */

/** 压缩前的原始文件体积上限，只做防呆（避免把老设备卡死） */
export const MAX_UPLOAD_SOURCE_SIZE = 50 * 1024 * 1024

export interface UploadFileCheckOptions {
  /** 是否允许 PDF，仅保险单为 true，默认 false */
  allowPdf?: boolean
  /** 原始体积上限（字节），默认 MAX_UPLOAD_SOURCE_SIZE */
  maxSize?: number
}

/**
 * 校验待上传文件，通过返回 null，否则返回给 ElMessage 用的错误文案
 * （不依赖 UI 库，方便在任意层复用）
 */
export function validateUploadFile(file: File, options: UploadFileCheckOptions = {}): string | null {
  const { allowPdf = false, maxSize = MAX_UPLOAD_SOURCE_SIZE } = options

  const isImage = file.type.startsWith('image/')
  const isPdf = file.type === 'application/pdf'

  if (allowPdf ? !isImage && !isPdf : !isImage) {
    return allowPdf ? '请选择图片或PDF文件' : '请选择图片文件'
  }

  if (file.size > maxSize) {
    return `文件大小不能超过${Math.round(maxSize / 1024 / 1024)}MB`
  }

  return null
}
