# Campus Forum Connect

A premium student-and-alumni community forum.

## Local Development Setup

This project uses `pnpm` workspaces. Ensure you have Node.js 18+ and `pnpm` installed.

### 1. Environment Configuration

1.  Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
2.  Open `.env` and fill in your `DATABASE_URL` (from Supabase or a local PostgreSQL).
3.  Ensure `SESSION_SECRET` is set to a secure random string.

### 2. Database Initialization

This project uses Drizzle ORM with versioned migrations. To set up your database:

```bash
# 1. Install dependencies
pnpm install

# 2. Run migrations to create tables
pnpm --filter @workspace/db run migrate
```

*Note: If you are making schema changes, use `pnpm --filter @workspace/db run generate` to create a new migration file.*

### 3. Running the App

Start both the frontend and backend concurrently:

```bash
pnpm dev
```

- **Frontend**: http://localhost:5173
- **Backend**: http://localhost:5001 (Proxied via `/api`)

## Security & Best Practices

- **Secrets**: Never commit `.env`. It is ignored by git. Use `.env.example` as a template.
- **Session**: `trust proxy` is enabled in the backend to support secure cookies behind reverse proxies (like Supabase/Vercel).
- **CORS**: Configured to allow credentials for session-based authentication.
