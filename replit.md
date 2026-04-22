# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Project: Campus Forum

Ed-Discussion-style student/alumni community board.

### Artifacts
- **`artifacts/forum`** — React + Vite frontend (port 22557, served at `/`). Three-column layout: section rail, post list, post detail with threaded replies.
- **`artifacts/api-server`** — Express API (port 8080, served at `/api`).

### Domain
- 4 fixed sections: `carpool`, `academic`, `roommate`, `other`.
- Local username/password auth (bcryptjs) — explicitly chosen by the user over Clerk/Replit Auth.
- Anonymous browsing supported; per-post and per-comment "Post anonymously" toggle for logged-in users; visitors are forced anonymous.
- Threaded comments via `parentId`. Reply chain shown indented up to depth 3.
- Email notifications to the post author when someone replies (Nodemailer). If `SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS` env vars are unset, sends are stubbed and logged to the API server console.

### Database
- Tables: `users`, `posts`, `comments`, `session` (for express-session via connect-pg-simple).
- Schema lives in `lib/db/src/schema/`. Push with `pnpm --filter @workspace/db run push`.
- `session` table is created on first start by `connect-pg-simple` (`createTableIfMissing: true`); manual creation SQL is documented in this file's history.

### Auth/session
- `express-session` + `connect-pg-simple` storing in the `session` table.
- Cookie: `connect.sid`, httpOnly, sameSite lax, 30 day expiry, `secure` in production.
- `SESSION_SECRET` env var (already configured). Falls back to a dev secret if missing.

### Demo credentials
- `demo` / `password123` (Alex Chen)
- `jordan` / `password123` (Jordan Kim)

### How to run locally
- API server workflow + forum web workflow are both registered. Restart them via the workflow tools.
- DB: provisioned PostgreSQL is on `DATABASE_URL`. Seed lives in the conversation history; the schema is the source of truth.
