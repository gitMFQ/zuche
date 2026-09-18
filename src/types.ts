import type { Context } from 'hono';

/** JWT 载荷，同时是中间件注入到上下文的用户信息 */
export interface AuthUser {
  id: string;
  username: string;
  role: string;
  name: string;
}

/** wrangler.jsonc 中声明的绑定 */
export interface Bindings {
  DB: D1Database;
  UPLOADS: R2Bucket;
  ASSETS: Fetcher;
  /** 通过 wrangler secret put 设置，本地开发写在 .dev.vars */
  JWT_SECRET?: string;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: { user?: AuthUser };
};

export type AppContext = Context<AppEnv>;

/** 统一的接口响应体 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}
