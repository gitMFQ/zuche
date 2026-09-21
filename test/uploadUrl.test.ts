import { describe, expect, it } from 'vitest';
import {
  canonicalUploadPath,
  signUploadPath,
  signUploadUrlsDeep,
  verifyUploadSignature
} from '../src/lib/uploadUrl';

const SECRET = 'test-secret-for-upload-url-signing';

/** 从签名路径里取出 /uploads/ 之后的部分，模拟 serveUpload 的入参 */
function restOf(signedPath: string): string {
  return signedPath.slice('/uploads/'.length);
}

describe('canonicalUploadPath', () => {
  it('未签名的规范路径保持不变', () => {
    expect(canonicalUploadPath('/uploads/customer/张三-身份证.jpg')).toBe('/uploads/customer/张三-身份证.jpg');
  });

  it('剥掉已有签名段，得到规范路径', async () => {
    const signed = await signUploadPath('/uploads/customer/a.jpg', SECRET);
    expect(canonicalUploadPath(signed)).toBe('/uploads/customer/a.jpg');
  });

  it('剥掉 query 与 hash', () => {
    expect(canonicalUploadPath('/uploads/customer/a.jpg?x=1')).toBe('/uploads/customer/a.jpg');
    expect(canonicalUploadPath('/uploads/customer/a.jpg#f')).toBe('/uploads/customer/a.jpg');
  });

  it('外链、base64、空串原样返回（不参与签名）', () => {
    expect(canonicalUploadPath('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg');
    expect(canonicalUploadPath('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(canonicalUploadPath('')).toBe('');
  });

  it('只有 /uploads/ 没有后续段时原样返回，不越界', () => {
    expect(canonicalUploadPath('/uploads/')).toBe('/uploads/');
  });
});

describe('签名与校验', () => {
  it('签名后能通过校验，并还原出 R2 key', async () => {
    const signed = await signUploadPath('/uploads/customer/a.jpg', SECRET);
    const result = await verifyUploadSignature(restOf(signed), SECRET);
    expect(result.valid).toBe(true);
    expect(result.key).toBe('customer/a.jpg');
  });

  it('签名段嵌在路径里（因为 /cdn-cgi/image 不透传 query）', async () => {
    const signed = await signUploadPath('/uploads/vehicle/b.png', SECRET);
    expect(signed).toMatch(/^\/uploads\/\d+\.[A-Za-z0-9_-]{22}\/vehicle\/b\.png$/);
  });

  it('未签名的裸路径被拒绝（这是隐私防护的核心）', async () => {
    const result = await verifyUploadSignature('customer/a.jpg', SECRET);
    expect(result.valid).toBe(false);
  });

  it('换一个密钥就验不过（防伪造）', async () => {
    const signed = await signUploadPath('/uploads/customer/a.jpg', SECRET);
    const result = await verifyUploadSignature(restOf(signed), 'another-secret');
    expect(result.valid).toBe(false);
  });

  it('篡改文件路径后验不过（签名绑定完整路径）', async () => {
    const signed = await signUploadPath('/uploads/customer/a.jpg', SECRET);
    const tampered = signed.replace('/customer/a.jpg', '/customer/b.jpg');
    const result = await verifyUploadSignature(restOf(tampered), SECRET);
    expect(result.valid).toBe(false);
  });

  it('过期签名被拒绝', async () => {
    const expired = await signUploadPath('/uploads/customer/a.jpg', SECRET, -10);
    const result = await verifyUploadSignature(restOf(expired), SECRET);
    expect(result.valid).toBe(false);
  });

  it('格式不对的签名段被拒绝且不抛错', async () => {
    expect((await verifyUploadSignature('notanumber.abc/customer/a.jpg', SECRET)).valid).toBe(false);
    expect((await verifyUploadSignature('abc/customer/a.jpg', SECRET)).valid).toBe(false);
    expect((await verifyUploadSignature('customer/a.jpg', SECRET)).valid).toBe(false);
    expect((await verifyUploadSignature('', SECRET)).valid).toBe(false);
  });

  it('重复签名不会叠加签名段（先剥旧再重签）', async () => {
    const once = await signUploadPath('/uploads/customer/a.jpg', SECRET);
    const twice = await signUploadPath(once, SECRET);
    expect(canonicalUploadPath(twice)).toBe('/uploads/customer/a.jpg');
    expect((await verifyUploadSignature(restOf(twice), SECRET)).valid).toBe(true);
  });
});

describe('signUploadUrlsDeep', () => {
  it('递归替换响应体里的上传路径（数组、嵌套对象都要覆盖）', async () => {
    const payload = {
      success: true,
      data: {
        pickup_image: '/uploads/order/a.jpg',
        id_card_images: ['/uploads/customer/b.jpg', '/uploads/customer/c.jpg'],
        documents: [{ url: '/uploads/insurance/d.pdf', type: 'pdf' }],
        // 外链与 base64 不动
        external: 'https://example.com/x.jpg',
        inline: 'data:image/png;base64,AAAA',
        // 非上传字段（R2 对象 key 不以 /uploads/ 开头）不动
        filename: 'customer/a.jpg',
        order_no: 'R20260921000001'
      }
    };

    const signed = await signUploadUrlsDeep(payload, SECRET);

    expect(signed.data.pickup_image).toMatch(/^\/uploads\/\d+\.[A-Za-z0-9_-]{22}\/order\/a\.jpg$/);
    expect(signed.data.id_card_images).toHaveLength(2);
    for (const url of signed.data.id_card_images) {
      expect(url).toMatch(/^\/uploads\/\d+\.[A-Za-z0-9_-]{22}\/customer\/b?c?\.jpg$/);
      expect((await verifyUploadSignature(restOf(url), SECRET)).valid).toBe(true);
    }
    expect(signed.data.documents[0].url).toMatch(/^\/uploads\/\d+\.[A-Za-z0-9_-]{22}\/insurance\/d\.pdf$/);
    expect(signed.data.external).toBe('https://example.com/x.jpg');
    expect(signed.data.inline).toBe('data:image/png;base64,AAAA');
    expect(signed.data.filename).toBe('customer/a.jpg');
    expect(signed.data.order_no).toBe('R20260921000001');
  });

  it('null / 数字 / 布尔值原样保留', async () => {
    const signed = await signUploadUrlsDeep({ a: null, b: 1, c: true, d: undefined }, SECRET);
    expect(signed).toEqual({ a: null, b: 1, c: true, d: undefined });
  });
});
