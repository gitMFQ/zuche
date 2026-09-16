import { Env, initDatabase } from './db/index.js';
import { authMiddleware } from './middleware/auth.js';
import { loginController, getCurrentUserController, changePasswordController } from './controllers/auth.js';
import { getOrdersController, getOrderController, createOrderController, updateOrderStatusController, updateOrderController, extendOrderController, addPaymentController, cancelOrderController } from './controllers/orders.js';
import { jsonResponse, errorResponse, successResponse, logAction } from './utils/helpers.js';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    
    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    
    // Initialize database on first request
    await initDatabase(env.DB);
    
    // Health check
    if (path === '/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }
    
    // Auth routes (no auth required)
    if (path === '/api/auth/login' && method === 'POST') {
      return loginController(request, env);
    }
    
    // Protected routes
    const authResult = await authMiddleware(request, env);
    if (!authResult.authorized && authResult.response) {
      return authResult.response;
    }
    
    const userId = authResult.payload?.userId;
    
    // Auth routes (protected)
    if (path === '/api/auth/me' && method === 'GET') {
      return getCurrentUserController(request, env, userId);
    }
    
    if (path === '/api/auth/password' && method === 'PUT') {
      return changePasswordController(request, env, userId);
    }
    
    // Upload routes - handle R2 storage
    if (path.startsWith('/api/upload/') && method === 'POST') {
      return handleUpload(request, env, userId);
    }
    
    // Static file serving from R2
    if (path.startsWith('/uploads/')) {
      return handleStaticFile(path, env);
    }
    
    // Order routes
    if (path === '/api/orders' && method === 'GET') {
      return getOrdersController(request, env, userId);
    }
    if (path === '/api/orders' && method === 'POST') {
      return createOrderController(request, env, userId);
    }
    if (path.match(/^\/api\/orders\/[a-f0-9-]+$/i) && method === 'GET') {
      const orderId = path.split('/')[3];
      return getOrderController(request, env, userId, orderId);
    }
    if (path.match(/^\/api\/orders\/[a-f0-9-]+\/status$/i) && method === 'PUT') {
      const orderId = path.split('/')[3];
      return updateOrderStatusController(request, env, userId, orderId);
    }
    if (path.match(/^\/api\/orders\/[a-f0-9-]+$/) && method === 'PUT') {
      const orderId = path.split('/')[3];
      return updateOrderController(request, env, userId, orderId);
    }
    if (path.match(/^\/api\/orders\/[a-f0-9-]+\/extend$/i) && method === 'POST') {
      const orderId = path.split('/')[3];
      return extendOrderController(request, env, userId, orderId);
    }
    if (path.match(/^\/api\/orders\/[a-f0-9-]+\/payments$/i) && method === 'POST') {
      const orderId = path.split('/')[3];
      return addPaymentController(request, env, userId, orderId);
    }
    if (path.match(/^\/api\/orders\/[a-f0-9-]+\/cancel$/i) && method === 'POST') {
      const orderId = path.split('/')[3];
      return cancelOrderController(request, env, userId, orderId);
    }
    
    // 404
    return new Response('Not Found', { status: 404 });
  }
};

async function handleUpload(request: Request, env: Env, userId?: string): Promise<Response> {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File | null;
    
    if (!image) {
      return errorResponse('请选择文件');
    }
    
    // Extract type from path: /api/upload/{type}
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const type = parts[parts.length - 1] || 'other';
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const ext = image.name.split('.').pop() || 'jpg';
    const filename = `${type}-${timestamp}-${randomSuffix}.${ext}`;
    
    // Upload to R2
    await env.BUCKET.put(`uploads/${type}/${filename}`, image.stream(), {
      httpMetadata: {
        contentType: image.type
      }
    });
    
    const fileUrl = `/uploads/${type}/${filename}`;
    const isPdf = image.type === 'application/pdf';
    
    return successResponse({
      filename,
      url: fileUrl,
      type: isPdf ? 'pdf' : 'image'
    });
  } catch (error) {
    console.error('Upload error:', error);
    return errorResponse('上传失败', 500);
  }
}

async function handleStaticFile(path: string, env: Env): Promise<Response> {
  try {
    // Remove /uploads/ prefix
    const key = path.slice(9); // Remove '/uploads/'
    const object = await env.BUCKET.get(key);
    
    if (!object) {
      return new Response('File not found', { status: 404 });
    }
    
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Access-Control-Allow-Origin', '*');
    
    return new Response(object.body, {
      headers
    });
  } catch (error) {
    console.error('Static file error:', error);
    return new Response('File not found', { status: 404 });
  }
}
