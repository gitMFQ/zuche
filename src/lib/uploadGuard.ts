/**
 * 上传文件的魔数校验。
 *
 * 上传接口原本只信任客户端提交的 file.type，而 MIME 是客户端可控的 ——
 * 把任意内容命名成 .jpg 就能存进 R2 并被 /uploads/* 公开托管（等于一个图床）。
 * 这里读文件头判断真实格式，与声明的类型不一致就拒绝。
 *
 * 不做图片尺寸/解码校验：Worker 侧不解码图片，展示时经 Cloudflare 图像转换，
 * 那条链路本身有像素上限，额外解析会引入一堆格式分支却没有实际收益。
 */

export type DetectedFileType = 'jpeg' | 'png' | 'gif' | 'webp' | 'pdf';

const SIGNATURE_LENGTH = 16;

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

/** 读取文件头 16 字节并判断真实格式，无法识别时返回 null */
export function detectFileType(header: Uint8Array): DetectedFileType | null {
  // JPEG: FF D8 FF
  if (startsWith(header, [0xff, 0xd8, 0xff])) return 'jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  // GIF: "GIF8"
  if (startsWith(header, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  // WebP: RIFF....WEBP
  if (startsWith(header, [0x52, 0x49, 0x46, 0x46]) && startsWith(header.slice(8), [0x57, 0x45, 0x42, 0x50])) {
    return 'webp';
  }
  // PDF: "%PDF"
  if (startsWith(header, [0x25, 0x50, 0x44, 0x46])) return 'pdf';

  return null;
}

const TYPE_BY_MIME: Record<string, DetectedFileType> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf'
};

/** 需要读取的文件头长度 */
export const MAGIC_BYTES_TO_READ = SIGNATURE_LENGTH;

/**
 * 校验文件真实格式与声明的 MIME 是否一致。
 * 声明了未知 MIME 时返回 false（调用方已有 MIME 白名单，这里只是兜底）。
 */
export function magicMatchesMime(header: Uint8Array, declaredMime: string): boolean {
  const expected = TYPE_BY_MIME[declaredMime];
  if (!expected) return false;

  return detectFileType(header) === expected;
}
