# NoteApp – A Modern Note-Taking Application

A full-stack note-taking web application built with a modern tech stack. Features rich text editing and PostgreSQL-backed storage.

## Prerequisites

- **Node.js** 22.x or later
- **pnpm** 10.x or later
- **Docker Desktop** (for PostgreSQL)

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd noteapp
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in the required values:
   - `DATABASE_URL` – PostgreSQL connection string
   - `JWT_SECRET` – Secret key for JWT tokens (use ≥32 random characters)
   - `PORT` – Backend server port (default: 3000)
   - `POSTGRES_PASSWORD` – Docker database password

4. **Start PostgreSQL**
   ```bash
   docker compose up -d
   ```

5. **Run database migrations**
   ```bash
   pnpm --filter=@noteapp/api exec prisma migrate dev --name init
   ```

6. **Start the development server**
   ```bash
   pnpm dev
   ```
   This starts all packages (frontend and backend) in parallel.

7. **Run tests**
   ```bash
   pnpm test
   ```

## Available Scripts

All scripts are defined in the root `package.json` and run across the workspace:

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start all packages in development mode (frontend + backend) |
| `pnpm build` | Build all packages for production |
| `pnpm test` | Run the test suite (Vitest) |
| `pnpm lint` | Lint all code with ESLint (0 warnings allowed) |
| `pnpm typecheck` | Run TypeScript type checking across all packages |
| `pnpm format` | Format code with Prettier |
| `pnpm commitlint` | Validate commit messages (used by Husky pre-commit hook) |

## Project Structure

This is a **pnpm workspace monorepo**:

```
noteapp/
├── apps/
│   ├── api/             # Backend API (Node 22 + Express 5 + Prisma)
│   └── web/             # Frontend (React 19 + Vite 6)
├── packages/
│   └── shared/          # Shared types and Zod schemas (CJS + ESM)
├── docs/                # Documentation (FRS, SDS, UX specs)
├── package.json         # Root workspace configuration
├── pnpm-workspace.yaml  # pnpm workspace definition
└── docker-compose.yml   # PostgreSQL 16 container
```

### apps/api
Node.js backend running Express 5 with Prisma 6 ORM, JWT authentication, and PostgreSQL full-text search.

### apps/web
React 19 frontend on Vite 6 with TanStack Query, Zustand, TipTap rich-text editor, and shadcn/ui components.

### packages/shared
Shared TypeScript types and Zod validation schemas consumed by both frontend and backend. Compiled to CJS + ESM.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5.8, Vite 6, TanStack Query, Zustand, TipTap, shadcn/ui |
| Backend | Node.js 22, Express 5, Prisma 6, PostgreSQL 16, JWT |
| Testing | Vitest, Supertest, Playwright |
| Tooling | ESLint 9, Prettier, Husky, commitlint, pnpm workspaces |

## Commit Convention

This project enforces **Conventional Commits**:

```
<type>(<scope>): <description> AB#<ticket-id>
```

- `feat` and `fix` commits **must** include `AB#<ticket-id>` (e.g., `AB#1010`)
- Other types (`chore`, `docs`, `refactor`, `test`) are exempt

**Examples:**
```
feat(api): add note archiving endpoint AB#1010
fix(web): resolve editor scroll bug AB#1015
chore: update dependencies
```

Commit linting is enforced via Husky hooks on every `git commit`.
