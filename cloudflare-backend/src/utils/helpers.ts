import { D1Database } from '@cloudflare/workers-types';

// Helper function to generate UUID v4
export function generateUuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
  return `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-${hex[4]}${hex[5]}-${hex[6]}${hex[7]}-${hex[8]}${hex[9]}-${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`;
}

// Helper function to hash password using bcryptjs
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(password, hash);
}

// Helper function for logging actions
export async function logAction(
  db: D1Database,
  userId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: string,
  ipAddress?: string
): Promise<void> {
  try {
    const id = generateUuid();
    await db.prepare(`
      INSERT INTO operation_logs (id, user_id, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(id, userId, action, entityType, entityId, details, ipAddress).run();
  } catch (error) {
    console.error('Failed to log action:', error);
  }
}

// Helper function to parse pagination params
export interface PaginationParams {
  page: number;
  pageSize: number;
  offset: number;
}

export function parsePagination(params: Record<string, any>): PaginationParams {
  const page = Math.max(1, parseInt(params.page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(params.pageSize) || 10));
  const offset = (page - 1) * pageSize;
  
  return { page, pageSize, offset };
}

// Helper function to create JSON response
export function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

export function errorResponse(message: string, status: number = 400): Response {
  return jsonResponse({ success: false, message }, status);
}

export function successResponse(data?: any, message?: string): Response {
  return jsonResponse({ success: true, data, message });
}

// Date helpers
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDateTime(date: Date): string {
  return date.toISOString().replace('Z', '').slice(0, 19);
}

export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}
