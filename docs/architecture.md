# Architecture Overview

This project is a modern, modular Monorepo managed by `pnpm-workspace`, separating clear concerns into scalable components.

## Workspace Structure

The workspace is divided into two primary directories:

- **`apps/`**: Contains the deployable applications.
  - `web`: The React frontend application (Vite, React Query, Tailwind CSS).
  - `api`: The Node.js Express backend service.
- **`packages/`**: Contains shared libraries and schemas.
  - `db`: Centralized database schema and queries (Drizzle ORM, Postgres).
  - `api-zod`: Shared Zod schemas for end-to-end type safety between client and server.
  - `api-client-react`: Auto-generated React Query hooks mapped to the API specification.
  - `api-spec`: The OpenAPI source of truth.

## Application Architecture

### Frontend (`apps/web`)
- **Framework**: React with Vite.
- **Routing**: `wouter` for lightweight, standard-compliant client-side routing.
- **State Management**: `@tanstack/react-query` for server state and caching; standard React hooks for local UI state.
- **Styling**: Tailwind CSS combined with `radix-ui` and `shadcn/ui` for accessible, premium-feeling components. Theming supports Light, Dark, and System modes seamlessly.

### Backend (`apps/api`)
- **Framework**: Express.js with `pino` for high-performance JSON logging.
- **Routing**: Modular Express routers separated by resource domain (e.g., `posts`, `activity`, `bookmarks`, `auth`).
- **Data Access**: Operations are performed using `drizzle-orm` directly interacting with the schemas defined in `@workspace/db`.

## Data Flow
1. The user interacts with the UI in `apps/web`.
2. UI interactions trigger React Query hooks generated in `@workspace/api-client-react`.
3. The hook fires a type-safe `customFetch` request to the backend.
4. `apps/api` validates incoming payloads against shared schemas from `@workspace/api-zod`.
5. Authorized requests trigger SQL queries constructed via `@workspace/db` to the Postgres instance.
6. Real-time changes (e.g. notifications) and database updates cascade smoothly to connected clients.
