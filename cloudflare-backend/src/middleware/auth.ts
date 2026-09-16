import { jwtVerify, SignJWT } from 'jsonwebtoken';
import { Env } from '../db/index.js';

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

export async function authMiddleware(
  request: Request,
  env: Env
): Promise<{ authorized: boolean; payload?: JwtPayload; response?: Response }> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { 
      authorized: false, 
      response: new Response(JSON.stringify({ 
        success: false, 
        message: '未授权，请登录' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const secret = env.JWT_SECRET || 'your-secret-key';
    // Use native crypto for JWT verification
    const verified = await verifyJwt(token, secret);
    
    if (!verified) {
      return { 
        authorized: false, 
        response: new Response(JSON.stringify({ 
          success: false, 
          message: 'Token 无效或已过期' 
        }), { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        })
      };
    }
    
    return { authorized: true, payload: verified as JwtPayload };
  } catch (error) {
    console.error('Auth error:', error);
    return { 
      authorized: false, 
      response: new Response(JSON.stringify({ 
        success: false, 
        message: '认证失败' 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    };
  }
}

export async function generateToken(payload: JwtPayload, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (365 * 24 * 60 * 60); // 1 year
  
  const body = { ...payload, iat: now, exp };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  
  const signatureInput = `${encodedHeader}.${encodedBody}`;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
  const encodedSignature = base64UrlEncode(signature);
  
  return `${encodedHeader}.${encodedBody}.${encodedSignature}`;
}

async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const [encodedHeader, encodedBody, encodedSignature] = parts;
    
    const decoder = new TextDecoder();
    const header = JSON.parse(decoder.decode(base64UrlDecode(encodedHeader)));
    const body = JSON.parse(decoder.decode(base64UrlDecode(encodedBody)));
    
    // Check expiration
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    // Verify signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signatureInput = `${encodedHeader}.${encodedBody}`;
    const signature = base64UrlDecode(encodedSignature);
    
    const isValid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(signatureInput));
    
    if (!isValid) {
      return null;
    }
    
    return body as JwtPayload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string;
  if (typeof data === 'string') {
    const bytes = new TextEncoder().encode(data);
    base64 = btoa(String.fromCharCode(...bytes));
  } else {
    base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str: string): ArrayBuffer {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
