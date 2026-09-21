/**
 * 上传文件的签名 URL。
 *
 * 背景：/uploads/* 之前完全公开，身份证、行驶证、保险单只要 URL 泄露
 * （转发、Referer、浏览器历史、日志）就能被任何人读取。现在对外暴露的图片 URL
 * 一律带签名，serveUpload 校验过期时间与 HMAC。
 *
 * 签名嵌在**路径**里而不是 query 上：前端展示图片时会拼成
 * `/cdn-cgi/image/<opts>/<源路径>`，Cloudflare 的图像转换层不会把 query 透传给源站，
 * 只有路径能保证签名到达 Worker。
 * 路径形态：/uploads/{exp}.{sig}/{dir}/{file}
 *
 * 存储侧仍以 /uploads/{dir}/{file} 为准，对外响应时才签名（见 signUploadUrlsDeep）。
 * 因此库里即使存着带签名的旧值也没关系 —— 每次对外都会先剥掉旧签名再重新签。
 */

import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';

const UPLOAD_PREFIX = '/uploads/';

/** 签名截断长度：22 个 base64url 字符约 132 位，足够抗碰撞 */
const SIG_LENGTH = 22;

/** 签名有效期，与 JWT 有效期保持一致 */
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;

/** {exp}.{sig} 段的格式 */
const SIG_PATTERN = /^(\d+)\.([A-Za-z0-9_-]{22})$/;

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * 从 JWT_SECRET 派生出专用于上传 URL 签名的子密钥。
 * 这样不需要新增一个 secret，也避免同一个密钥直接承担两种签名用途。
 */
async function signingKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign'
  ]);
  const derived = await crypto.subtle.sign('HMAC', baseKey, encoder.encode('upload-url-signing-v1'));
  return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function computeSignature(key: CryptoKey, payload: string): Promise<string> {
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toBase64Url(signature).slice(0, SIG_LENGTH);
}

/** 定长比较，避免按字符提前返回带来的时序差异 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * 把任意形态的上传 URL 归一成规范路径：去掉 query/hash、去掉已有的签名段。
 * 非 /uploads/ 开头的值（外链、base64、空串）原样返回。
 */
export function canonicalUploadPath(value: string): string {
  if (!value.startsWith(UPLOAD_PREFIX)) return value;

  const withoutQuery = value.split('?')[0].split('#')[0];
  const rest = withoutQuery.slice(UPLOAD_PREFIX.length);
  const slash = rest.indexOf('/');
  if (slash === -1) return withoutQuery;

  // 第一段是签名段就剥掉，得到真正的 {dir}/{file}
  if (SIG_PATTERN.test(rest.slice(0, slash))) {
    return UPLOAD_PREFIX + rest.slice(slash + 1);
  }

  return withoutQuery;
}

/** 给规范路径签名，返回 /uploads/{exp}.{sig}/{dir}/{file} */
export async function signUploadPath(
  path: string,
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
): Promise<string> {
  const canonical = canonicalUploadPath(path);
  if (!canonical.startsWith(UPLOAD_PREFIX)) return canonical;

  const rest = canonical.slice(UPLOAD_PREFIX.length);
  if (!rest) return canonical;

  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const key = await signingKey(secret);
  const signature = await computeSignature(key, `${exp}/${rest}`);

  return `${UPLOAD_PREFIX}${exp}.${signature}/${rest}`;
}

export interface UploadSignatureResult {
  valid: boolean;
  /** 校验通过时的 R2 对象 key（{dir}/{file}） */
  key: string;
}

/** 校验 /uploads/ 之后的路径片段，通过时返回 R2 key */
export async function verifyUploadSignature(rest: string, secret: string): Promise<UploadSignatureResult> {
  const slash = rest.indexOf('/');
  if (slash === -1) return { valid: false, key: '' };

  const segment = rest.slice(0, slash);
  const key = rest.slice(slash + 1);
  const match = SIG_PATTERN.exec(segment);
  if (!match) return { valid: false, key: '' };

  const exp = Number(match[1]);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
    return { valid: false, key: '' };
  }

  const signing = await signingKey(secret);
  const expected = await computeSignature(signing, `${exp}/${key}`);
  if (!timingSafeEqual(expected, match[2])) {
    return { valid: false, key: '' };
  }

  return { valid: true, key };
}

/**
 * 递归把响应体里所有 /uploads/ 路径换成签名 URL。
 *
 * 做成统一的响应后处理，而不是在每个 controller 里逐个字段签名：图片字段散落在
 * 8 个 controller 的十几个字段里（含 JSON 数组与 {url,type} 对象），手写一定会漏。
 */
export async function signUploadUrlsDeep<T>(value: T, secret: string): Promise<T> {
  if (typeof value === 'string') {
    return (value.startsWith(UPLOAD_PREFIX) ? await signUploadPath(value, secret) : value) as T;
  }

  if (Array.isArray(value)) {
    return (await Promise.all(value.map((item) => signUploadUrlsDeep(item, secret)))) as T;
  }

  if (value && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(
        async ([entryKey, entryValue]) => [entryKey, await signUploadUrlsDeep(entryValue, secret)] as const
      )
    );
    return Object.fromEntries(entries) as T;
  }

  return value;
}

/**
 * 挂在 /api 上的响应后处理：把 JSON 响应里所有上传路径替换成签名 URL。
 * 上传接口返回的 url 也会被签名，前端可以直接拿它预览；
 * 存入库里的签名过期后也没影响，因为每次读出来都会重新签。
 */
export const signUploadUrls: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();

  const res = c.res;
  if (res?.status !== 200) return;
  if (!res.headers.get('content-type')?.includes('application/json')) return;

  const secret = c.env.JWT_SECRET;
  // 未配置密钥时 authMiddleware 已经会拦截业务请求，这里保持原样即可
  if (!secret) return;

  const body: unknown = await res.json();
  const signed = await signUploadUrlsDeep(body, secret);

  const headers = new Headers(res.headers);
  // 重新序列化后长度会变，交给运行时重新计算
  headers.delete('content-length');
  c.res = new Response(JSON.stringify(signed), { status: 200, headers });
};
