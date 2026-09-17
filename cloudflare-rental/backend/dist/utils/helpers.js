import { v4 as uuidv4 } from 'uuid';
// 生成 UUID
export function generateId() {
    return uuidv4();
}
// 生成订单号
export function generateOrderNo() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `R${year}${month}${day}${random}`;
}
// 格式化日期
export function formatDate(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toISOString().replace('T', ' ').substring(0, 19);
}
// 获取当前时间
export function now() {
    return formatDate(new Date());
}
// JWT 辅助函数
export async function createToken(payload, secret) {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const tokenPayload = {
        ...payload,
        iat: now,
        exp: now + 31536000 // 1 年有效期
    };
    const base64UrlEncode = (data) => {
        let binary = '';
        for (let i = 0; i < data.length; i++) {
            binary += String.fromCharCode(data[i]);
        }
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };
    const headerEncoded = base64UrlEncode(encoder.encode(JSON.stringify(header)));
    const payloadEncoded = base64UrlEncode(encoder.encode(JSON.stringify(tokenPayload)));
    const signatureInput = encoder.encode(`${headerEncoded}.${payloadEncoded}`);
    const signature = await crypto.subtle.sign('HMAC', key, signatureInput);
    const signatureEncoded = base64UrlEncode(new Uint8Array(signature));
    return `${headerEncoded}.${payloadEncoded}.${signatureEncoded}`;
}
export async function verifyToken(token, secret) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3)
            return null;
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
        const base64UrlDecode = (str) => {
            str = str.replace(/-/g, '+').replace(/_/g, '/');
            while (str.length % 4)
                str += '=';
            const binary = atob(str);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            return bytes;
        };
        const headerEncoded = parts[0];
        const payloadEncoded = parts[1];
        const signatureEncoded = parts[2];
        const signatureInput = encoder.encode(`${headerEncoded}.${payloadEncoded}`);
        const signature = base64UrlDecode(signatureEncoded);
        const valid = await crypto.subtle.verify('HMAC', key, signature, signatureInput);
        if (!valid)
            return null;
        const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadEncoded)));
        // 检查过期时间
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null;
        }
        return { userId: payload.userId, username: payload.username, role: payload.role };
    }
    catch {
        return null;
    }
}
