/**
 * D1 绑定参数允许的类型。
 * 显式包含 undefined：调用方经常直接传 `c.req.query()` 这类可空值，
 * 由 normalize 统一转成 null，避免每个调用点都写 `?? null`。
 */
export type Bind = string | number | boolean | null | undefined;

/**
 * D1 绑定参数不接受 undefined（会抛 D1_TYPE_ERROR），这里统一兜底成 null。
 */
function normalize(params: Bind[]): Bind[] {
  return params.map((value) => (value === undefined ? null : value));
}

export interface ExecResult {
  changes: number;
}

export interface PageResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Stmt {
  sql: string;
  params?: Bind[];
}

// 查询辅助函数 - 返回所有匹配行
export async function query<T>(db: D1Database, sql: string, params: Bind[] = []): Promise<T[]> {
  const result = await db.prepare(sql).bind(...normalize(params)).all<T>();
  return result.results ?? [];
}

// 查询单条记录
export async function queryOne<T>(db: D1Database, sql: string, params: Bind[] = []): Promise<T | null> {
  const row = await db.prepare(sql).bind(...normalize(params)).first<T>();
  return row ?? null;
}

// 执行写操作 - 用于 INSERT, UPDATE, DELETE
export async function execute(db: D1Database, sql: string, params: Bind[] = []): Promise<ExecResult> {
  const result = await db.prepare(sql).bind(...normalize(params)).run();
  return { changes: result.meta.changes };
}

// 分页查询：参数绑定 LIMIT/OFFSET，count 与数据并发发出
export async function queryWithPagination<T>(
  db: D1Database,
  sql: string,
  params: Bind[] = [],
  page: number = 1,
  pageSize: number = 10
): Promise<PageResult<T>> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : 10;
  const offset = (safePage - 1) * safePageSize;
  const normalized = normalize(params);

  const [countRow, pageRows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total FROM (${sql})`).bind(...normalized).first<{ total: number }>(),
    db.prepare(`${sql} LIMIT ? OFFSET ?`).bind(...normalized, safePageSize, offset).all<T>()
  ]);

  const total = countRow?.total ?? 0;

  return {
    data: pageRows.results ?? [],
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.ceil(total / safePageSize)
  };
}

// 批量执行 - D1 的 batch 是隐式事务，任一条失败整体回滚
export async function batchExecute(db: D1Database, stmts: Stmt[]): Promise<void> {
  if (stmts.length === 0) return;
  await db.batch(stmts.map((stmt) => db.prepare(stmt.sql).bind(...normalize(stmt.params ?? []))));
}
