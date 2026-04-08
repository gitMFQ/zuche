# AGENTS.md - AI Agent Context Guide

Quick reference for agentic coding agents working in this repository.

## Project Overview

**Car Rental Management System (租车公司管理系统)** - Full-stack application
- Backend: Node.js + Express 5 + TypeScript + better-sqlite3 + zod
- Frontend: Vue 3 + Vite + TypeScript + Element Plus + Pinia + html2canvas
- Ports: Backend 3001, Frontend 5173

## Build & Run Commands

### Backend
```bash
cd backend
npm install                    # Install dependencies
npm run dev                    # Dev server with hot reload (tsx watch)
npm run start                  # Production run
npm run build                  # Compile TypeScript to dist/
npx tsc --noEmit               # Type check only (no emit)
```

### Frontend
```bash
cd frontend
npm install                    # Install dependencies
npm run dev                    # Dev server (localhost:5173)
npm run build                  # Build for production (includes type check)
npm run preview                # Preview production build
npx vue-tsc --noEmit           # Type check only (no emit)
```

### Type Checking (CRITICAL - Run Before Submitting)
```bash
cd backend && npx tsc --noEmit      # Check backend types
cd frontend && npx vue-tsc --noEmit # Check frontend types
```

**No test framework or lint tools configured.** Type checking is the only validation.

### Environment Setup
Create `.env` file in backend directory:
```bash
PORT=3001
JWT_SECRET=your-secret-key
```

## Code Style Guidelines

### Backend (TypeScript)

**Imports:**
- Use `.js` extension for local modules: `import { query } from '../utils/helpers.js';`
- Third-party imports first, then project modules (alphabetically)
- Example order: express → jwt → local modules

**Types:**
- All function parameters and return types MUST be annotated
- Never use `any` without comment explaining why
- Use interfaces for request/response shapes
- Use zod for request validation
- Controller functions return `void` (send response directly)

**Database (better-sqlite3) - ALWAYS use helper functions:**
```typescript
import { query, queryOne, execute } from '../utils/helpers.js';

const rows = query("SELECT * FROM users WHERE status = ?", [1]);
const user = queryOne("SELECT * FROM users WHERE id = ?", [userId]);
execute("INSERT INTO users (id, name) VALUES (?, ?)", [id, name]);

// NEVER: db.run(), db.exec(), db.prepare() directly
// NEVER: String concatenation for SQL - always use parameterized queries
```

**Error Handling:**
- Wrap all controller logic in try-catch
- Return `{ success: false, message: '...' }` on errors
- Use `res.status(400/404/500).json()` for error responses
- Log errors with `console.error('操作错误:', error)`

**Naming:**
- Files: kebab-case (`authMiddleware.ts`, `orderSources.ts`)
- Functions: camelCase, verb-first (`getOrders`, `createOrder`, `updateOrderStatus`)
- DB tables/columns: snake_case (`order_sources`, `created_at`)
- Constants: UPPER_SNAKE_CASE (`STATUS_MAP`, `JWT_SECRET`)

**Controller Pattern:**
```typescript
export function getResource(req: AuthRequest, res: Response): void {
  try {
    const { id } = req.params;
    const resource = queryOne('SELECT * FROM resources WHERE id = ?', [id]);
    if (!resource) {
      res.status(404).json({ success: false, message: '资源不存在' });
      return;
    }
    res.json({ success: true, data: resource });
  } catch (error) {
    console.error('获取资源错误:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
}
```

### Frontend (Vue 3)

**Composition API Required:**
```vue
<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'

const router = useRouter()
const route = useRoute()
const loading = ref(false)
const tableData = ref<any[]>([])
</script>
```

**Props/Emits:**
```typescript
const props = defineProps<{ orderId: string; }>();
const emit = defineEmits<{ (e: 'refresh'): void; }>();
```

**State Management:**
- Use Pinia stores in `stores/` directory
- User state in `stores/user.ts`

**Form Validation:**
```typescript
const rules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  phone: [{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }]
}
```

**API Calls:**
- Import from `../api` - e.g., `import { orderApi, vehicleApi } from '../api'`
- Handle loading states and errors with try-catch
- Use `ElMessage.success/error()` for user feedback

## Key Conventions

**Response Format:** All APIs return `{ success: boolean, data?: any, message?: string }`

**Authentication:**
- JWT tokens, 1-year expiry
- Use `authMiddleware` for protected routes
- Use `adminOnly` for admin-only routes
- Access user via `req.user?.id`, `req.user?.role`

**File Upload Endpoints:**
- `/api/upload/inspection`, `/api/upload/insurance`, `/api/upload/violation`
- `/api/upload/maintenance`, `/api/upload/vehicle`, `/api/upload/customer`
- File size limit: 10MB
- Return: `{ success: true, data: { url: string } }`

**Database Migrations:** Add in `backend/src/db/index.ts` `runMigrations()` using `ALTER TABLE`.

**Pagination:** Use `queryWithPagination()` helper - returns `{ data, total, page, pageSize, totalPages }`

## Default Credentials

- Username: `admin`
- Password: `admin123`

## Absolute Bans

- ❌ Type suppression (`as any`, `@ts-ignore`, `as unknown as`)
- ❌ Empty catch blocks
- ❌ String concatenation for SQL queries
- ❌ Commit without user request
- ❌ Direct database access without helper functions
- ❌ Skipping type checking before committing
- ❌ Adding sensitive data to logs (passwords, tokens)
- ❌ Using `var` - use `const`/`let`
- ❌ Optional chaining without null checks in templates

## Project Structure

```
car/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Route handlers (orders.ts, vehicles.ts, etc.)
│   │   ├── db/index.ts     # Database setup & migrations
│   │   ├── middleware/     # Auth middleware (auth.ts)
│   │   ├── routes/         # Route definitions (index.ts)
│   │   ├── utils/          # Helper functions (helpers.ts)
│   │   └── index.ts        # Entry point
│   ├── data/               # SQLite database file
│   └── uploads/            # Uploaded files storage
├── frontend/
│   ├── src/
│   │   ├── api/            # API client modules
│   │   ├── components/     # Reusable components
│   │   ├── views/          # Page components
│   │   ├── stores/         # Pinia stores
│   │   ├── router/         # Vue Router config
│   │   └── utils/          # Frontend helpers
│   └── package.json
└── AGENTS.md
```

## Development Workflow

1. Make changes to backend (`backend/src/`) or frontend (`frontend/src/`)
2. Run `npm run dev` in respective directory for hot reload
3. Run type checking: `npx tsc --noEmit` (backend) / `npx vue-tsc --noEmit` (frontend)
4. Test functionality manually
5. Run `git add .` to stage all changes
6. Create a commit with a descriptive message
7. Only push after user approval