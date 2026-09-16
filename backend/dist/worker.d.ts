import { Hono } from 'hono';
import { D1Database, R2Bucket } from '@cloudflare/workers-types';
interface Env {
    Bindings: {
        DB: D1Database;
        BUCKET: R2Bucket;
        JWT_SECRET: string;
        FRONTEND_URL: string;
    };
}
declare const app: Hono<Env, import("hono/types").BlankSchema, "/">;
export default app;
