/**
 * 本地开发用后端替代品（dev-only，不参与部署）。
 *
 * 为什么需要它：
 *   `wrangler dev` 依赖 workerd 二进制，本机是 aarch64 且用户态虚拟地址空间不足 48 位，
 *   workerd 一启动就 Aborted：
 *     tcmalloc: MmapAligned() failed - unable to allocate with tag (alignment=1073741824)
 *     CHECK in AllocSlow: FATAL ERROR: Out of memory trying to allocate internal tcmalloc data
 *   （`wrangler --version` 能跑是因为它不启动 workerd；`wrangler d1 migrations apply --local`
 *    同样会挂在这里，这也是为什么迁移要用本脚本直接用 sqlite 执行。）
 *
 * 它做了什么：
 *   用 esbuild 把同一份 src/index.ts 打包成 Node ESM，起一个 http 服务，
 *   并把 Worker 绑定换成等价的本地实现：
 *     DB      -> node:sqlite（数据文件在 .wrangler/state/dev-node/data.sqlite）
 *     UPLOADS -> 本地目录（.wrangler/state/dev-node/r2）
 *   接口路径、签名机制、外键约束与真实 Worker 完全一致（SQLite 语义），秒 Wasabi 差异极小。
 *
 * 用法：node scripts/dev-backend.mjs   （默认监听 8787，删掉 data.sqlite 即重置数据）
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(import.meta.dirname, '..');
const STATE_DIR = path.join(ROOT, '.wrangler', 'state', 'dev-node');
const DB_FILE = path.join(STATE_DIR, 'data.sqlite');
const R2_DIR = path.join(STATE_DIR, 'r2');
const BUNDLE = path.join(STATE_DIR, 'app.mjs');
const PORT = Number(process.env.PORT || 8787);
const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-jwt-secret';

const MIME_BY_EXT = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf'
};

/** D1 绑定参数允许 string/number/boolean/null，node:sqlite 只认前者两种 + null */
function toSqlArgs(params) {
  return params.map((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
}

/** D1Database 的最小等价实现：只实现本项目用到的 prepare / batch */
function createD1(file) {
  const sqlite = new DatabaseSync(file);
  sqlite.exec('PRAGMA foreign_keys = ON');

  const wrap = (sql, params) => {
    const statement = {
      _sql: sql,
      _params: params,
      bind(...next) {
        return wrap(sql, next);
      },
      async all() {
        const rows = sqlite.prepare(sql).all(...toSqlArgs(params));
        return { results: rows, success: true, meta: { rows_read: rows.length } };
      },
      async first() {
        const row = sqlite.prepare(sql).get(...toSqlArgs(params));
        return row === undefined ? null : row;
      },
      async raw() {
        return sqlite.prepare(sql).raw().all(...toSqlArgs(params));
      },
      async run() {
        const info = sqlite.prepare(sql).run(...toSqlArgs(params));
        return {
          success: true,
          meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid ?? 0) }
        };
      }
    };
    return statement;
  };

  return {
    prepare(sql) {
      return wrap(sql, []);
    },
    async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        for (const statement of statements) {
          sqlite.prepare(statement._sql).run(...toSqlArgs(statement._params ?? []));
        }
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
      return [];
    },
    async exec(sql) {
      sqlite.exec(sql);
      return { count: 0 };
    }
  };
}

/** R2Bucket 的最小等价实现：对象存本地文件，元数据存同名 sidecar json */
function createBucket(dir) {
  mkdirSync(dir, { recursive: true });
  const root = path.resolve(dir);

  const resolveKey = (key) => {
    const target = path.resolve(root, key);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      throw new Error(`非法 R2 key: ${key}`);
    }
    return target;
  };

  const readMeta = (file) => {
    if (!existsSync(`${file}.__meta.json`)) return { httpMetadata: {}, customMetadata: {} };
    return JSON.parse(readFileSync(`${file}.__meta.json`, 'utf8'));
  };

  const toObject = (key, file) => {
    const stat = statSync(file);
    const buffer = readFileSync(file);
    const etag = createHash('sha1').update(buffer).digest('hex');
    const meta = readMeta(file);
    const httpMetadata = meta.httpMetadata ?? {};
    return {
      key,
      size: stat.size,
      etag,
      httpEtag: `"${etag}"`,
      uploaded: stat.mtime,
      httpMetadata,
      customMetadata: meta.customMetadata ?? {},
      async arrayBuffer() {
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
      },
      async text() {
        return buffer.toString('utf8');
      },
      async json() {
        return JSON.parse(buffer.toString('utf8'));
      },
      body: new Blob([buffer]).stream(),
      writeHttpMetadata(headers) {
        const type = httpMetadata.contentType ?? MIME_BY_EXT[path.extname(key).toLowerCase()] ?? 'application/octet-stream';
        headers.set('content-type', type);
        if (httpMetadata.cacheControl) headers.set('cache-control', httpMetadata.cacheControl);
      }
    };
  };

  return {
    async put(key, value, options = {}) {
      const file = resolveKey(key);
      const buffer =
        value instanceof ArrayBuffer
          ? Buffer.from(value)
          : Buffer.isBuffer(value)
            ? value
            : Buffer.isBuffer(value?.buffer)
              ? Buffer.from(value.buffer, value.byteOffset, value.byteLength)
              : Buffer.from(String(value));
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, buffer);
      writeFileSync(
        `${file}.__meta.json`,
        JSON.stringify({ httpMetadata: options.httpMetadata ?? {}, customMetadata: options.customMetadata ?? {} })
      );
      return {
        key,
        size: buffer.byteLength,
        etag: createHash('sha1').update(buffer).digest('hex'),
        httpMetadata: options.httpMetadata ?? {}
      };
    },
    async get(key) {
      const file = resolveKey(key);
      return existsSync(file) ? toObject(key, file) : null;
    },
    async head(key) {
      const found = await this.get(key);
      if (!found) return null;
      return { key, size: found.size, etag: found.etag, httpEtag: found.httpEtag, uploaded: found.uploaded };
    },
    async delete(key) {
      const file = resolveKey(key);
      rmSync(file, { force: true });
      rmSync(`${file}.__meta.json`, { force: true });
    },
    async list({ prefix = '' } = {}) {
      const found = [];
      const walk = (current, relative) => {
        for (const entry of readdirSync(current, { withFileTypes: true })) {
          const nextRel = relative ? `${relative}/${entry.name}` : entry.name;
          const nextPath = path.join(current, entry.name);
          if (entry.isDirectory()) walk(nextPath, nextRel);
          else if (!nextRel.endsWith('.__meta.json') && nextRel.startsWith(prefix)) {
            found.push({ key: nextRel, size: statSync(nextPath).size, uploaded: statSync(nextPath).mtime });
          }
        }
      };
      walk(root, '');
      return { objects: found, truncated: false, delimitedPrefixes: [] };
    }
  };
}

/** 在本地 sqlite 上顺序跑 migrations/（等同于 wrangler d1 migrations apply --local） */
function applyMigrations() {
  mkdirSync(STATE_DIR, { recursive: true });
  const fresh = !existsSync(DB_FILE);
  const sqlite = new DatabaseSync(DB_FILE);
  sqlite.exec('PRAGMA foreign_keys = ON');

  if (fresh) {
    for (const file of readdirSync(path.join(ROOT, 'migrations')).filter((name) => name.endsWith('.sql')).sort()) {
      sqlite.exec(readFileSync(path.join(ROOT, 'migrations', file), 'utf8'));
      console.log(`[dev-backend] 已执行迁移 ${file}`);
    }
    // 演示数据不进生产迁移，本地开发用它避免页面空列表
    const demo = path.join(ROOT, 'scripts', 'seed-demo.sql');
    if (existsSync(demo)) {
      sqlite.exec(readFileSync(demo, 'utf8'));
      console.log('[dev-backend] 已灌入 scripts/seed-demo.sql 演示数据');
    }
  } else {
    console.log(`[dev-backend] 复用已有数据 ${DB_FILE}（删掉该文件可重置并重新迁移）`);
  }
  sqlite.close();
}

async function bundleWorker() {
  await build({
    entryPoints: [path.join(ROOT, 'src', 'index.ts')],
    outfile: BUNDLE,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    sourcemap: false,
    logLevel: 'warning'
  });
}

async function main() {
  applyMigrations();
  await bundleWorker();

  // serveUpload / dashboard 用到 caches.default 与 waitUntil，这里给一个空实现即可
  if (typeof globalThis.caches === 'undefined') {
    globalThis.caches = {
      default: {
        async match() {
          return undefined;
        },
        async put() {
          return undefined;
        },
        async delete() {
          return true;
        }
      }
    };
  }

  const worker = (await import(`${pathToFileURL(BUNDLE).href}?t=${Date.now()}`)).default;
  const db = createD1(DB_FILE);
  const uploads = createBucket(R2_DIR);
  const env = { DB: db, UPLOADS: uploads, JWT_SECRET };

  const server = createServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `127.0.0.1:${PORT}`}`);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      const request = new Request(url, {
        method: req.method,
        headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body
      });

      const response = await worker.fetch(request, env, {
        waitUntil: () => {},
        passThroughOnException: () => {}
      });

      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error('[dev-backend] 请求处理失败:', error);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: '本地后端异常' }));
    }
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[dev-backend] 监听 http://0.0.0.0:${PORT}  (数据: ${DB_FILE}, R2: ${R2_DIR})`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
