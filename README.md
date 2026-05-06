# Campus Forum Connect

A premium student-and-alumni community forum built as a **pnpm monorepo**.

### 📁 Project Structure

```
Campus-Forum-Connect/
│
├── apps/                             # 可运行的应用（前端 + 后端）
│   │
│   ├── api/                          # Express 后端服务（端口 5001）
│   │   └── src/
│   │       ├── index.ts              # 入口：启动 HTTP server
│   │       ├── app.ts                # Express 实例、session、中间件挂载
│   │       ├── routes/               # 路由层（按业务拆分）
│   │       │   ├── index.ts          # 路由注册总表
│   │       │   ├── auth.ts           # 注册/登录/Google OAuth/个人信息
│   │       │   ├── posts.ts          # 帖子 CRUD（列表、详情、创建、删除）
│   │       │   ├── posts-bookmarks.ts# 书签功能（收藏/取消/列表）
│   │       │   ├── posts-activity.ts # 个人动态（My Activity 面板）
│   │       │   ├── notifications.ts  # 通知系统（未读数、标全读）
│   │       │   ├── drafts.ts         # 草稿箱（CRUD）
│   │       │   ├── stats.ts          # 统计数据（板块计数、最近动态）
│   │       │   └── health.ts         # 健康检查端点
│   │       └── lib/
│   │           ├── auth.ts           # Session 认证工具函数
│   │           ├── logger.ts         # pino 日志配置
│   │           └── sections.ts       # Section 枚举常量
│   │
│   └── web/                          # React 前端（端口 5173，Vite）
│       └── src/
│           ├── App.tsx               # 路由配置 + Provider 挂载（含 Google OAuth）
│           ├── main.tsx              # 前端入口，React DOM 挂载
│           ├── index.css             # 全局样式（CSS 变量、暗色模式）
│           ├── pages/                # 页面级组件（路由对应的入口）
│           │   ├── home.tsx          # 主页框架，组装各 features，管理路由状态
│           │   ├── login.tsx         # 登录页（邮箱 + Google OAuth）
│           │   ├── register.tsx      # 注册页
│           │   ├── new-post.tsx      # 发帖页（含草稿自动保存）
│           │   └── not-found.tsx     # 404 页面
│           ├── features/             # 功能模块（按业务域拆分）
│           │   ├── navigation/
│           │   │   ├── Header.tsx    # 顶部导航栏（Logo、用户头像、下拉菜单）
│           │   │   └── SectionRail.tsx # 左侧板块导航（含帖子计数角标）
│           │   ├── posts/
│           │   │   ├── PostList.tsx  # 帖子列表（搜索、筛选、排序、草稿/通知/书签模式）
│           │   │   └── PostDetailPane.tsx # 帖子详情 + 评论树 + 回复框
│           │   ├── activity/
│           │   │   └── WelcomePane.tsx # 首页欢迎面板（未登录引导 + 最近活动流）
│           │   └── settings/
│           │       └── SettingsPane.tsx # 设置面板（显示名、用户名、暗色模式）
│           ├── components/ui/        # shadcn/ui 组件库（Button、Dialog、Badge 等）
│           ├── hooks/                # 自定义 React Hooks
│           │   ├── use-toast.ts      # Toast 通知 hook
│           │   └── use-mobile.tsx    # 移动端断点检测 hook
│           └── lib/
│               ├── utils.ts          # 工具函数（cn、relTime、excerpt）
│               └── constants.ts      # 共享常量（SECTION_LABELS、SectionFilter 类型）
│
├── packages/                         # 内部共享库（被 apps 引用）
│   │
│   ├── db/                           # 数据库层（Drizzle ORM + PostgreSQL）
│   │   ├── src/schema/
│   │   │   ├── users.ts              # users 表（含 avatarUrl）
│   │   │   ├── posts.ts              # posts 表 + Section 枚举
│   │   │   ├── comments.ts           # comments 表（支持嵌套回复）
│   │   │   ├── bookmarks.ts          # bookmarks 关联表
│   │   │   ├── notifications.ts      # notifications 表
│   │   │   ├── drafts.ts             # drafts 表
│   │   │   └── session.ts            # express-session 持久化表
│   │   ├── migrations/               # SQL 迁移文件历史
│   │   └── drizzle.config.ts         # Drizzle Kit 配置
│   │
│   ├── api-zod/                      # API 请求体 Zod 校验 Schema（自动生成，勿手改）
│   │   └── src/generated/            # 由 Orval 从 OpenAPI spec 生成
│   │
│   └── api-client-react/             # 前端 API 请求层（自动生成，勿手改）
│       └── src/
│           ├── generated/            # Orval 生成的 React Query hooks 和 fetch 函数
│           ├── custom-fetch.ts       # 带 cookie 凭证的基础 fetch 封装
│           └── custom-hooks.ts       # useCustomFetch / useCustomMutation 通用 hooks
│
├── lib/                              # OpenAPI 规范 + 代码生成配置
│   └── api-spec/
│       └── openapi.yaml              # REST API 的 OpenAPI 3.0 定义（源头文件）
│
├── docs/                             # 架构文档
│   ├── architecture.md               # 整体架构、技术栈、数据流说明
│   ├── api.md                        # REST API 端点文档
│   └── data-model.md                 # 数据库表结构说明
│
├── scripts/                          # 构建/运维辅助脚本
├── .env                              # 本地环境变量（不提交 git）
├── .env.example                      # 环境变量模板
├── package.json                      # Workspace 根配置（pnpm dev / build / typecheck）
├── pnpm-workspace.yaml               # pnpm workspace 成员声明
└── tsconfig.json                     # 根 TypeScript 引用配置
```



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
- **Session**: `trust proxy` is enabled in the backend to support secure cookies behind reverse proxies (like Railway).
- **CORS**: Configured to allow credentials for session-based authentication.

## Production Architecture (Reference)

- **Frontend**: Hosted on **Cloudflare Pages** (`uwdegree.org`).
- **Backend (API)**: Hosted on **Railway** (e.g., `https://api-xxx.up.railway.app`).
- **Database**: Hosted on **Supabase** (PostgreSQL).

### Important for Frontend Development
Always use `import.meta.env.VITE_API_URL` when making API calls in features to ensure requests are correctly routed to the Railway backend in production. Relative paths (`/api/...`) will only work in local development due to the Vite proxy.
