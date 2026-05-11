# UW Degree Explorer (uwdegree.org)

[![Site Status](https://img.shields.io/website?url=https%3A%2F%2Fuwdegree.org)](https://uwdegree.org)
[![Tech Stack](https://img.shields.io/badge/Stack-Vite%20%7C%20React%20%7C%20Express%20%7C%20Postgres-blue)](https://uwdegree.org)

**UW Degree Explorer** is the ultimate academic planning and community platform designed specifically for University of Waterloo students. It combines powerful degree auditing tools with a vibrant social forum to simplify campus life.

## 🚀 Key Features

### 🎓 Academic Planning Suite
- **Degree Auditor (Transcript Parser)**: Upload your official Quest PDF transcript to automatically populate your major check sheet and visualize your degree progress.
- **Course Explorer**: A fast, searchable database of University of Waterloo courses with detailed descriptions and requirements.
- **Make Calendar**: An interactive drag-and-drop planner to map out your entire degree from 1A to 4B.
- **Breadth Constellation**: A visual representation of your breadth requirements to ensure you meet all university-level constraints.
- **Grade & Workload Calculators**: Tools to predict your term average and estimate weekly study hours based on your course load.

### 💬 Community Forum
- **Categorized Discussions**: Dedicated sections for **Academic Advice**, **Carpooling (to YYZ/Toronto)**, **Roommate Hunting**, and more.
- **Real-time Interaction**: Fully featured discussion board with nested replies, likes, and bookmarks.
- **Draft System**: Never lose your thoughts—all posts and replies are automatically saved as drafts.
- **Verification**: Student-verified badges to ensure trustworthy information within the community.

### 🛡️ Admin Dashboard (`admin.uwdegree.org`)
- A separate, high-performance management interface for administrators.
- Real-time activity tracking, user moderation, and system statistics.

---

## 🛠️ Technology Stack

### Core
- **Frontend**: [React](https://reactjs.org/) + [Vite](https://vitejs.dev/)
- **Backend**: [Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)
- **Database**: [PostgreSQL](https://www.postgresql.org/) (via [Supabase](https://supabase.com/))
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **State Management**: [TanStack Query (React Query)](https://tanstack.com/query/latest)

### Styling & UI
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Components**: [shadcn/ui](https://ui.shadcn.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)

---

## 📦 Deployment Information

The project is architected as a **pnpm monorepo** for seamless development and deployment.

- **Frontend**: Hosted on **Cloudflare Pages** for global edge performance.
- **API Server**: Deployed on **Railway** with auto-scaling and trust-proxy configuration.
- **Database**: **Supabase** (PostgreSQL) with connection pooling.
- **Asset Management**: Subdomain architecture (`admin.uwdegree.org` / `uwdegree.org`) with synchronized CORS policies.

---

## 💻 Local Development

### 1. Prerequisites
- Node.js 20+
- pnpm 9+

### 2. Setup
```bash
# Clone the repository
git clone https://github.com/UWDegreeExplorer/UWDegreeExplorer.git
cd UWDegreeExplorer

# Install dependencies
pnpm install

# Configure Environment
cp .env.example .env
# Fill in your DATABASE_URL and SESSION_SECRET
```

### 3. Database Migration
```bash
pnpm --filter @workspace/db run migrate
```

### 4. Start Development Server
```bash
pnpm dev
```
- **Frontend**: `http://localhost:5173`
- **Backend**: `http://localhost:5001` (Proxied)

---

## 📄 License

This project is private and intended for the University of Waterloo community.

---
*Built with ❤️ for Warriors.*
