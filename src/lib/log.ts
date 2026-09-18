import type { D1Database } from '@cloudflare/workers-types';
import { execute } from '../db/helpers';
import { generateId } from './ids';
import { now } from './time';

export interface LogActionInput {
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  ipAddress?: string | null;
}

// 记录操作日志，失败不应影响主业务
export async function logAction(db: D1Database, input: LogActionInput): Promise<void> {
  try {
    await execute(
      db,
      `INSERT INTO operation_logs (id, user_id, action, entity_type, entity_id, details, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        generateId(),
        input.userId || null,
        input.action,
        input.entityType ?? null,
        input.entityId ?? null,
        input.details ?? null,
        input.ipAddress ?? null,
        now()
      ]
    );
  } catch (error) {
    console.error('记录日志失败:', error);
  }
}
