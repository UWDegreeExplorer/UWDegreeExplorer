# Campus Forum Connect

A polished, student-and-alumni community forum built with React, Vite, Express, and Drizzle ORM.

## Local Setup

This project uses `pnpm` workspaces. Ensure you have Node.js 18+ and `pnpm` installed.

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Create a `.env` file in the root directory (or set them in your shell):

```env
DATABASE_URL=postgres://user:pass@localhost:5432/campus_forum
SESSION_SECRET=your-secret-here
PORT=5000
```

### 3. Run the Project

You can run both the frontend and backend concurrently:

```bash
pnpm dev
```

Or run them separately:

- **Frontend**: `pnpm --filter @workspace/forum dev` (runs on http://localhost:5173)
- **Backend**: `pnpm --filter @workspace/api-server dev` (runs on http://localhost:5000)

## Features

- **Sections**: Carpool, Academic, Roommate, and Other.
- **Search**: Real-time search across all posts.
- **Anonymous Posting**: Support for posting anonymously even when logged in.
- **Threaded Discussions**: Indented reply chains for better readability.
- **Admin Tools**: Built-in logic for administrative post management.

## Project Structure

- `artifacts/forum`: React frontend using Tailwind CSS v4 and Radix UI.
- `artifacts/api-server`: Express backend with PostgreSQL integration.
- `lib/db`: Database schema and Drizzle configurations.
- `lib/api-client-react`: Generated API hooks using Orval.
- `lib/api-spec`: OpenAPI specifications.
