# AGENTS.md - AI Agent Context Guide

Quick reference for agentic coding agents working in this repository.

## Project Overview

**Car Rental Management System** - Full-stack application
- Backend: Node.js + Express 5 + TypeScript + better-sqlite3
- Frontend: Vue 3 + Vite + TypeScript + Element Plus + Pinia
- Ports: Backend 3000, Frontend 5173

## Build & Run Commands

### Backend
```bash
cd backend
npm install          # Install dependencies
npm run dev          # Dev server with hot reload (tsx watch)
npm run start        # Production run
npm run build        # Compile TypeScript to dist/
```

### Frontend
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Dev server (localhost:5173)
npm run build        # Build for production
npm run preview      # Preview production build
```

### Type Checking (IMPORTANT - Run Before Submitting)
```bash
cd backend && npx tsc --noEmit      # Check backend types
cd frontend && npx vue-tsc --noEmit # Check frontend types
```

**No test framework or lint tools configured.** Type checking is the only validation.

## Code Style Guidelines

### Backend (TypeScript)

**Imports:**
- Use `.js` extension for local modules: `import { query } from '../utils/helpers.js';`
- Third-party imports first, then project modules (alphabetically)

**Types:**
- All function parameters and return types MUST be annotated
- Never use `any` without comment explaining why
- Use interfaces for request/response shapes

**Database (better-sqlite3):**
```typescript
// CORRECT - use helper functions
const rows = query("SELECT * FROM users WHERE status = ?", [1]);
const user = queryOne("SELECT * FROM users WHERE id = ?", [userId]);
execute("INSERT INTO users (id, name) VALUES (?, ?)", [id, name]);

// CORRECT - prepare statements directly
const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
const row = stmt.get(userId);
stmt.run(id, name);

// NEVER: db.run(), db.exec() with params, string concatenation for SQL
```

**Error Handling:**
- Wrap all controller logic in try-catch
- Return `{ success: false, message: '...' }` on errors
- Use appropriate HTTP status codes (400, 404, 500)

**Naming:**
- Files: kebab-case (`authMiddleware.ts`)
- Functions: camelCase, verb-first (`getOrders`, `createOrder`)
- Constants: UPPER_SNAKE_CASE
- DB tables/columns: snake_case

### Frontend (Vue 3)

**Composition API Required:**
```vue
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
// Use ref() for primitives, reactive() for objects
</script>
```

**Imports:**
```typescript
// API
import { orderApi, vehicleApi } from '../api';

// Utils
import { PAYMENT_METHOD_OPTIONS } from '../utils/constants';
import { formatDateTime, getImageUrl } from '../utils/helpers';
```

**Props/Emits:**
```typescript
// Define with defineProps/defineEmits
const props = defineProps<{ orderId: string; }>();
const emit = defineEmits<{ (e: 'refresh'): void; }>();
```

**State Management:**
- Use Pinia stores in `stores/` directory
- User state in `stores/user.ts`

### CSS

- Use CSS variables for theming: `var(--primary-color)`
- Mobile-first: write mobile styles first, add `@media (min-width: 768px)` for desktop
- Avoid global styles; use scoped or unique class prefixes

## Key Conventions

**Response Format (Backend):** All APIs return `{ success: boolean, data?: any, message?: string }`

**Authentication:** JWT tokens, 1-year expiry. Use `authMiddleware` for protected routes, `adminOnly` for admin-only endpoints.

**Operation Logging:** Use `logAction(userId, action, entityType, entityId, details, ip)` after key operations.

**File Upload:** POST `/api/upload/:type` where type is `vehicle|customer|inspection|insurance|maintenance|violation|other`

**Database Migrations:** Add in `backend/src/db/index.ts` `runMigrations()` function using `ALTER TABLE`.

## Default Credentials

- Username: `admin`
- Password: `admin123`

## Absolute Bans

- ❌ Type suppression (`as any`, `@ts-ignore`, `@ts-expect-error`)
- ❌ Empty catch blocks
- ❌ Delete failing tests to "pass" (no tests exist anyway)
- ❌ String concatenation for SQL queries (use parameterized queries)
- ❌ Commit without user request
