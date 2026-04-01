# AGENTS.md - AI Agent Context Guide

Quick reference for agentic coding agents working in this repository.

## Project Overview

**Car Rental Management System** - Full-stack application
- Backend: Node.js + Express 5 + TypeScript + better-sqlite3 + zod
- Frontend: Vue 3 + Vite + TypeScript + Element Plus + Pinia + html2canvas
- Ports: Backend 3001, Frontend 5173

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

**Types:**
- All function parameters and return types MUST be annotated
- Never use `any` without comment explaining why
- Use interfaces for request/response shapes
- Use zod for request validation

**Database (better-sqlite3):**
```typescript
// CORRECT - use helper functions
const rows = query("SELECT * FROM users WHERE status = ?", [1]);
const user = queryOne("SELECT * FROM users WHERE id = ?", [userId]);
execute("INSERT INTO users (id, name) VALUES (?, ?)", [id, name]);

// NEVER: db.run(), db.exec() with params, string concatenation for SQL
```

**Error Handling:**
- Wrap all controller logic in try-catch
- Return `{ success: false, message: '...' }` on errors

**Naming:**
- Files: kebab-case (`authMiddleware.ts`)
- Functions: camelCase, verb-first (`getOrders`, `createOrder`)
- DB tables/columns: snake_case

### Frontend (Vue 3)

**Composition API Required:**
```vue
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
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

## Key Conventions

**Response Format:** All APIs return `{ success: boolean, data?: any, message?: string }`

**Authentication:** JWT tokens, 1-year expiry. Use `authMiddleware` for protected routes.

**File Upload Endpoints:**
- `/api/upload/inspection`, `/api/upload/insurance`, `/api/upload/violation`
- `/api/upload/maintenance`, `/api/upload/vehicle`, `/api/upload/customer`
- File size limit: 10MB

**Database Migrations:** Add in `backend/src/db/index.ts` `runMigrations()` using `ALTER TABLE`.

## Default Credentials

- Username: `admin`
- Password: `admin123`

## Absolute Bans

- ❌ Type suppression (`as any`, `@ts-ignore`)
- ❌ Empty catch blocks
- ❌ String concatenation for SQL queries
- ❌ Commit without user request
- ❌ Direct database access without helper functions
- ❌ Skipping type checking before committing
- ❌ Adding sensitive data to logs (passwords, tokens)

## Project Structure

```
car/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── db/index.ts      # Database & migrations
│   │   ├── middleware/      # Auth middleware
│   │   ├── routes/          # Route definitions
│   │   ├── utils/           # Helper functions
│   │   └── index.ts         # Entry point
│   ├── data/                # SQLite database
│   └── uploads/             # Uploaded files
├── frontend/
│   ├── src/
│   │   ├── api/             # API client
│   │   ├── components/      # Reusable components
│   │   ├── views/           # Page components
│   │   ├── stores/          # Pinia stores
│   │   └── router/          # Vue Router
│   └── package.json
└── AGENTS.md
```

## Development Workflow

1. Make changes to backend (`backend/src/`) or frontend (`frontend/src/`)
2. Run `npm run dev` in respective directory for hot reload
3. Run type checking: `npx tsc --noEmit` (backend) / `npx vue-tsc --noEmit` (frontend)
4. Test functionality
5. Only commit after user approval