import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth.js'
import type { Bindings, Variables } from '../index.js'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// 通用上传处理函数
async function handleUpload(c: any, subdir: string, allowPdf = false) => {
  try {
    const formData = await c.req.parseBody()
    const file = formData.get('image') as File | null
    
    if (!file) {
      return c.json({ success: false, message: '请选择文件' }, 400)
    }
    
    // 验证文件类型
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    const allowedPdfTypes = ['application/pdf']
    const allowedTypes = allowPdf ? [...allowedImageTypes, ...allowedPdfTypes] : allowedImageTypes
    
    if (!allowedTypes.includes(file.type)) {
      const msg = allowPdf
        ? '只支持 JPG、PNG、GIF、WEBP 格式的图片或 PDF 文件'
        : '只支持 JPG、PNG、GIF、WEBP 格式的图片'
      return c.json({ success: false, message: msg }, 400)
    }
    
    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ success: false, message: '文件大小不能超过 10MB' }, 400)
    }
    
    // 生成文件名
    const ext = file.name.split('.').pop() || (file.type.startsWith('image/') ? 'jpg' : 'bin')
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const filename = `${subdir}-${uniqueSuffix}.${ext}`
    
    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer()
    
    // 上传到 R2
    await c.env.UPLOADS.put(`${subdir}/${filename}`, arrayBuffer, {
      httpMetadata: {
        contentType: file.type
      }
    })
    
    // 生成访问 URL（使用 R2 公开域名或自定义域名）
    // 注意：需要在 Cloudflare Dashboard 配置 R2 公开访问或使用自定义域名
    const fileUrl = `/api/uploads/${subdir}/${filename}`
    
    return c.json({
      success: true,
      data: {
        filename,
        url: fileUrl,
        type: file.type === 'application/pdf' ? 'pdf' : 'image'
      }
    })
  } catch (error) {
    console.error('上传失败:', error)
    return c.json({ success: false, message: '上传失败' }, 500)
  }
}

// 年检证图片上传接口
app.post('/inspection', authMiddleware, async (c) => {
  return handleUpload(c, 'inspection')
})

// 保险图片/PDF上传接口
app.post('/insurance', authMiddleware, async (c) => {
  return handleUpload(c, 'insurance', true)
})

// 违章图片上传接口
app.post('/violation', authMiddleware, async (c) => {
  return handleUpload(c, 'violation')
})

// 保养图片上传接口
app.post('/maintenance', authMiddleware, async (c) => {
  return handleUpload(c, 'maintenance')
})

// 车辆图片上传接口
app.post('/vehicle', authMiddleware, async (c) => {
  return handleUpload(c, 'vehicle')
})

// 客户图片上传接口
app.post('/customer', authMiddleware, async (c) => {
  return handleUpload(c, 'customer')
})

// 通用上传接口
app.post('/', authMiddleware, async (c) => {
  return handleUpload(c, 'other')
})

// 获取上传的文件（从 R2）
app.get('/:subdir/:filename', async (c) => {
  try {
    const subdir = c.req.param('subdir')
    const filename = c.req.param('filename')
    
    const object = await c.env.UPLOADS.get(`${subdir}/${filename}`)
    
    if (!object) {
      return c.json({ success: false, message: '文件不存在' }, 404)
    }
    
    const contentType = object.httpMetadata?.contentType || 'application/octet-stream'
    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    headers.set('content-type', contentType)
    
    return new Response(object.body, {
      headers
    })
  } catch (error) {
    console.error('获取文件失败:', error)
    return c.json({ success: false, message: '获取文件失败' }, 500)
  }
})

export default app
