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

/** details 是自由文本（含客户名、备注等），截断避免个别超长内容把日志表撑大 */
const MAX_DETAILS_LENGTH = 500;

// 记录操作日志，失败不应影响主业务
export async function logAction(db: D1Database, input: LogActionInput): Promise<void> {
  try {
    const details = input.details ? input.details.slice(0, MAX_DETAILS_LENGTH) : null;

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
        details,
        input.ipAddress ?? null,
        now()
      ]
    );
  } catch (error) {
    console.error('记录日志失败:', error);
  }
}
