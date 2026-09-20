import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { handleError } from '../lib/errors';
import type { AppContext, AppEnv } from '../types';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const PDF_TYPE = 'application/pdf';

/** 各上传端点的目录、默认文件名与是否允许 PDF */
const KINDS = {
  inspection: { dir: 'inspection', fallback: '年检证', allowPdf: false },
  insurance: { dir: 'insurance', fallback: '保险单', allowPdf: true },
  violation: { dir: 'violation', fallback: '违章照片', allowPdf: false },
  maintenance: { dir: 'maintenance', fallback: '保养照片', allowPdf: false },
  vehicle: { dir: 'vehicle', fallback: '车辆照片', allowPdf: false },
  customer: { dir: 'customer', fallback: '客户证件', allowPdf: false },
  other: { dir: 'other', fallback: '文件', allowPdf: false }
} as const;

type UploadKind = keyof typeof KINDS;

/** 对象 key 分片只允许这些字符（含中文），杜绝路径穿越 */
const SAFE_NAME = /^[A-Za-z0-9._\u4e00-\u9fa5-]+$/;

/** 语义化文件名中不在这份白名单里的字符全部丢弃 */
const UNSAFE_CHAR = /[^A-Za-z0-9\u4e00-\u9fa5_-]/g;

const MAX_NAME_LENGTH = 40;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};

function extensionOf(mime: string, originalName: string): string {
  const fromMime = EXT_BY_MIME[mime];
  if (fromMime) return fromMime;

  const dot = originalName.lastIndexOf('.');
  if (dot > 0) {
    const ext = originalName.slice(dot).toLowerCase();
    if (SAFE_NAME.test(ext.slice(1))) return ext;
  }
  return '';
}

// 把业务语义名（如「京A12345-行驶证」）清洗成可用于对象 key 的安全名字
function toSafeName(input: unknown, fallback: string): string {
  if (typeof input !== 'string') return fallback;

  const cleaned = input
    .trim()
    .replace(/\s+/g, '-')
    .replace(UNSAFE_CHAR, '')
    .replace(/[-_]{2,}/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, MAX_NAME_LENGTH)
    .replace(/^[-_]+|[-_]+$/g, '');

  return cleaned || fallback;
}

// 可读时间戳，按北京时间输出：20260920-153045
function timestampSuffix(): string {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(new Date());

  const pick = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}${pick('month')}${pick('day')}-${pick('hour')}${pick('minute')}${pick('second')}`;
}

// 统一的上传处理：接收 multipart/form-data 写入 R2
function createUploadHandler(kind: UploadKind) {
  const cfg = KINDS[kind];
  const allowed: string[] = cfg.allowPdf ? [...IMAGE_TYPES, PDF_TYPE] : IMAGE_TYPES;
  const typeName = cfg.allowPdf ? 'JPG、PNG、GIF、WEBP 格式的图片或 PDF 文件' : 'JPG、PNG、GIF、WEBP 格式的图片';

  return async (c: AppContext): Promise<Response> => {
    try {
      const form = await c.req.formData();
      const file = form.get('image');

      if (!(file instanceof File)) {
        return c.json({ success: false, message: '请选择文件' }, 400);
      }
      if (file.size > MAX_FILE_SIZE) {
        return c.json({ success: false, message: '文件大小不能超过 10MB' }, 400);
      }
      if (!allowed.includes(file.type)) {
        return c.json({ success: false, message: `只支持${typeName}` }, 400);
      }

      // 前端可选传语义化名字（如「京A12345-行驶证」），未传时用该类型的默认名
      const name = toSafeName(form.get('name'), cfg.fallback);
      // 末尾短随机串保证同一秒内的同名上传不会互相覆盖
      const key = `${cfg.dir}/${name}-${timestampSuffix()}-${crypto.randomUUID().slice(0, 6)}${extensionOf(file.type, file.name)}`;

      await c.env.UPLOADS.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type }
      });

      return c.json({
        success: true,
        data: {
          filename: key,
          url: `/uploads/${key}`,
          type: file.type === PDF_TYPE ? 'pdf' : 'image'
        }
      });
    } catch (error) {
      return handleError(c, '上传错误:', error);
    }
  };
}

// 从 R2 读取并回给浏览器，保持 /uploads/{dir}/{file} 的 URL 语义
export async function serveUpload(c: AppContext): Promise<Response> {
  const key = decodeURIComponent(c.req.path.slice('/uploads/'.length));

  if (!key || !key.split('/').every((part) => SAFE_NAME.test(part))) {
    return c.json({ success: false, message: '文件不存在' }, 404);
  }

  const cache = caches.default;
  const cacheKey = new Request(c.req.raw.url, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  try {
    const object = await c.env.UPLOADS.get(key);
    if (!object) {
      return c.json({ success: false, message: '文件不存在' }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    // key 内含随机串，内容不会变，可长期不可变缓存
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');

    const response = new Response(object.body, { headers });
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (error) {
    return handleError(c, '读取文件错误:', error);
  }
}

export const uploadRoutes = new Hono<AppEnv>();

// 年检证、保险、违章、保养、车辆、客户图片上传，以及其他文件上传
uploadRoutes.post('/upload/inspection', authMiddleware, createUploadHandler('inspection'));
uploadRoutes.post('/upload/insurance', authMiddleware, createUploadHandler('insurance'));
uploadRoutes.post('/upload/violation', authMiddleware, createUploadHandler('violation'));
uploadRoutes.post('/upload/maintenance', authMiddleware, createUploadHandler('maintenance'));
uploadRoutes.post('/upload/vehicle', authMiddleware, createUploadHandler('vehicle'));
uploadRoutes.post('/upload/customer', authMiddleware, createUploadHandler('customer'));
uploadRoutes.post('/upload', authMiddleware, createUploadHandler('other'));
