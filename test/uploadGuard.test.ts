import { describe, expect, it } from 'vitest';
import { detectFileType, magicMatchesMime } from '../src/lib/uploadGuard';

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)].slice(0, 16));

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const GIF = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);

/**
 * 上传接口原先只信任客户端提交的 file.type，而 MIME 客户端可控 ——
 * 把任意内容改名成 .jpg 就能存进 R2 并被 /uploads/* 托管。这里锁住魔数判定。
 */
describe('detectFileType', () => {
  it('识别常见图片与 PDF', () => {
    expect(detectFileType(JPEG)).toBe('jpeg');
    expect(detectFileType(PNG)).toBe('png');
    expect(detectFileType(GIF)).toBe('gif');
    expect(detectFileType(WEBP)).toBe('webp');
    expect(detectFileType(PDF)).toBe('pdf');
  });

  it('无法识别的内容返回 null', () => {
    expect(detectFileType(bytes(0x00, 0x01, 0x02, 0x03))).toBeNull();
    expect(detectFileType(new Uint8Array(0))).toBeNull();
  });

  it('只有 RIFF 头不算 WebP（必须是 RIFF....WEBP）', () => {
    const riffOnly = bytes(0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x41, 0x56, 0x49, 0x20);
    expect(detectFileType(riffOnly)).toBeNull();
  });

  it('字节数不足时不越界访问', () => {
    expect(detectFileType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe('magicMatchesMime', () => {
  it('真实格式与声明一致时通过', () => {
    expect(magicMatchesMime(JPEG, 'image/jpeg')).toBe(true);
    expect(magicMatchesMime(PNG, 'image/png')).toBe(true);
    expect(magicMatchesMime(PDF, 'application/pdf')).toBe(true);
  });

  it('内容与声明不符时拒绝（核心防护点）', () => {
    // 把 PNG 改名成 .jpg 上传
    expect(magicMatchesMime(PNG, 'image/jpeg')).toBe(false);
    // 把任意二进制伪装成图片
    expect(magicMatchesMime(bytes(0x4d, 0x5a, 0x90), 'image/jpeg')).toBe(false);
    // 把 PDF 伪装成图片（保险单之外的上传端点不允许 PDF）
    expect(magicMatchesMime(PDF, 'image/png')).toBe(false);
  });

  it('未知 MIME 一律拒绝', () => {
    expect(magicMatchesMime(JPEG, 'image/svg+xml')).toBe(false);
    expect(magicMatchesMime(JPEG, 'text/html')).toBe(false);
  });
});
