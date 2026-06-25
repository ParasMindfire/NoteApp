---
ticket: AB-1001
type: INFRA
slug: project-setup
status: APPROVED
---

## Overview

AB-1001 creates the complete monorepo skeleton for the Note-Taking App. A pnpm workspace is established with three packages — `apps/api` (Express 5 + Prisma), `apps/web` (React 19 + Vite), and `packages/shared` (Zod schemas + shared types built with tsup). All tooling required for subsequent tickets is wired up here: TypeScript strict mode, Vitest, Playwright, Husky, commitlint, ESLint, Prettier, OpenSpec, Docker Compose for local Postgres, and the Claude-specific agent/skill/MCP configuration. No application logic is written in this ticket.

## Goals

- Establish pnpm workspace with `apps/web`, `apps/api`, `packages/shared`
- Enable TypeScript strict mode across all packages
- Initialize Prisma with a PostgreSQL 16 connection
- Configure Vitest at root (workspace mode) with per-package overrides
- Configure Playwright for e2e tests under `apps/web/e2e`
- Wire Husky pre-commit hook: `pnpm typecheck && pnpm lint --max-warnings 0 && pnpm test --run`
- Enforce conventional commits + AB# requirement on `feat`/`fix` via commitlint
- Configure ESLint + Prettier at root, shared across all packages
- Initialize `.openspec/` with `changes/` and `archive/` folders
- Commit `.env.example`; add `.env` to `.gitignore`
- Pin all dependency versions (no `^`, `~`, or `@latest`)
- Write root `README.md` with setup steps
- Provide `docker-compose.yml` for local PostgreSQL 16
- Build `packages/shared` as dual CJS + ESM with `tsup`
- Add root pnpm scripts: `build`, `dev`, `test`, `lint`, `typecheck`
- Create `.claude/agents/` with `reviewer.md` and `tester.md`
- Create `.claude/skills/` with six starter skill files
- Create `.claude/settings.json` with Context7, GitHub, Postgres MCP entries (tokens from env)

## Non-Goals

- No application routes, components, or DB schema beyond an empty initial Prisma migration
- No authentication or business logic
- No CI/CD pipeline (GitHub Actions etc.)
- No deployment configuration

## FRs Covered

- FR-INFRA-1 — pnpm workspace structure
- FR-INFRA-2 — TypeScript strict mode everywhere
- FR-INFRA-3 — Prisma + PostgreSQL 16 connection
- FR-INFRA-4 — Vitest root workspace config
- FR-INFRA-5 — Playwright baseline smoke test
- FR-INFRA-6 — Husky pre-commit hook
- FR-INFRA-7 — commitlint conventional commits + AB# rule
- FR-INFRA-8 — ESLint + Prettier
- FR-INFRA-9 — OpenSpec initialized
- FR-INFRA-10 — `.env.example` committed; `.env` gitignored
- FR-INFRA-11 — All versions pinned
- FR-INFRA-12 — Root README.md
- FR-INFRA-13 — docker-compose.yml for local Postgres
- FR-INFRA-14 — packages/shared tsup CJS + ESM build
- FR-INFRA-15 — Root pnpm scripts
- FR-INFRA-16 — `.claude/agents/` reviewer + tester
- FR-INFRA-17 — `.claude/skills/` six starter skills
- FR-INFRA-18 — `.claude/settings.json` MCP config

## Tooling Decisions

| Tool | Version | Decision rationale |
|------|---------|--------------------|
| pnpm | 9.x (pinned) | Native workspace support; faster than npm/yarn; required by FR-INFRA-1 |
| Node | 22 LTS | Specified in CLAUDE.md tech stack |
| TypeScript | 5.x (pinned) | Strict mode required; compatible with React 19 + Express 5 |
| React | 19.x (pinned) | Specified in CLAUDE.md tech stack |
| Vite | 6.x (pinned) | Native ESM, fast HMR, standard for React 19 projects |
| Express | 5.x (pinned) | Specified in CLAUDE.md; async error handling built-in |
| PostgreSQL | 16 (Docker image `postgres:16`) | Specified in CLAUDE.md; required by FR-INFRA-3, FR-INFRA-13 |
| Prisma | 6.x (pinned) | ORM for PostgreSQL; migration tooling |
| tsup | 8.x (pinned) | Dual CJS+ESM build for packages/shared; zero-config |
| Vitest | 2.x (pinned) | Faster than Jest; native ESM; workspace mode; specified in CLAUDE.md |
| Playwright | 1.x (pinned) | Specified in CLAUDE.md; baseline smoke in apps/web/e2e |
| ESLint | 9.x (pinned) | Flat config; TypeScript + React plugins |
| Prettier | 3.x (pinned) | Consistent formatting across all packages |
| Husky | 9.x (pinned) | Git hooks; pre-commit required by FR-INFRA-6 |
| commitlint | 19.x (pinned) | Conventional commits + AB# rule; FR-INFRA-7 |
| Zod | 3.x (pinned) | Validation schemas in packages/shared; shared with frontend and backend |
| TanStack Query | 5.x (pinned) | Server state; specified in CLAUDE.md |
| Zustand | 5.x (pinned) | Client state; specified in CLAUDE.md |
| TipTap | 2.x (pinned) | Rich text editor; specified in CLAUDE.md |
| shadcn/ui | latest CLI (pinned output) | Component library over Radix UI; specified in CLAUDE.md |
| date-fns | 3.x (pinned) | Relative time formatting (used from AB-1015 onward) |
| DOMPurify | 3.x (pinned) | XSS sanitization; required by FR-UI-SEARCH-2 |

## File Layout

```
NoteApp/
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   └── index.ts          # Express entry point (hello-world only)
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # datasource + empty initial migration
│   │   │   └── migrations/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts      # node environment
│   └── web/
│       ├── src/
│       │   └── main.tsx          # React entry point (hello-world only)
│       ├── e2e/
│       │   └── smoke.spec.ts     # Playwright baseline smoke test
│       ├── playwright.config.ts
│       ├── vite.config.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts      # jsdom environment
├── packages/
│   └── shared/
│       ├── src/
│       │   └── index.ts          # re-exports (empty at this stage)
│       ├── tsup.config.ts
│       ├── package.json
│       └── tsconfig.json
├── .claude/
│   ├── agents/
│   │   ├── reviewer.md           # read-only spec compliance auditor
│   │   └── tester.md             # test writer (restricted to test paths)
│   ├── skills/
│   │   ├── prisma-migration.md
│   │   ├── zod-schema.md
│   │   ├── express-route.md
│   │   ├── react-component.md
│   │   ├── tanstack-query.md
│   │   └── playwright-spec.md
│   └── settings.json             # MCP: context7, github, postgres
├── .openspec/
│   ├── changes/
│   │   └── AB-1001-project-setup/
│   │       └── spec.md           # this file
│   └── archive/
├── .husky/
│   └── pre-commit
├── .env.example
├── .gitignore
├── commitlint.config.cjs
├── docker-compose.yml
├── eslint.config.js              # ESLint 9 flat config
├── .prettierrc.json
├── package.json                  # root (scripts + shared devDeps)
├── pnpm-workspace.yaml
├── tsconfig.base.json            # strict mode base
├── vitest.config.ts              # root workspace config
└── README.md
```

## Configuration Files

| File | Purpose |
|------|---------|
| `pnpm-workspace.yaml` | Declares `packages: ["apps/*", "packages/*"]` |
| `package.json` (root) | Root scripts (`build`, `dev`, `test`, `lint`, `typecheck`) via `pnpm -r run`; shared devDeps (TypeScript, ESLint, Prettier, Husky, commitlint) |
| `package.json` (apps/api) | Express 5, Prisma, bcrypt, jsonwebtoken, zod, express-rate-limit; devDeps: Vitest, Supertest |
| `package.json` (apps/web) | React 19, Vite, TanStack Query, Zustand, TipTap, shadcn/ui, DOMPurify, date-fns; devDeps: Vitest, Playwright |
| `package.json` (packages/shared) | Zod; tsup build; exports map for CJS + ESM + types |
| `tsconfig.base.json` | `"strict": true`, `"moduleResolution": "bundler"`, `"target": "ES2022"` |
| `tsconfig.json` (per package) | Extends `../../tsconfig.base.json`; sets `paths` and `outDir` |
| `vitest.config.ts` (root) | Workspace mode pointing to `apps/*/vitest.config.ts` |
| `vitest.config.ts` (apps/api) | `environment: "node"`, coverage thresholds |
| `vitest.config.ts` (apps/web) | `environment: "jsdom"`, coverage thresholds |
| `playwright.config.ts` | `baseURL: "http://localhost:5173"`, Chromium only for baseline |
| `eslint.config.js` | Flat config; `typescript-eslint` + `eslint-plugin-react-hooks`; no `console.log` in production code |
| `.prettierrc.json` | `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100` |
| `.husky/pre-commit` | `pnpm typecheck && pnpm lint --max-warnings 0 && pnpm test --run` |
| `commitlint.config.cjs` | Extends `@commitlint/config-conventional`; custom plugin: `feat`/`fix` type requires `AB#\d+` in subject |
| `.env.example` | `DATABASE_URL`, `JWT_SECRET`, `PORT`, `GITHUB_TOKEN` — placeholder values, no secrets |
| `docker-compose.yml` | `postgres:16` service; port `5432:5432`; health check; volume for data persistence |
| `apps/api/prisma/schema.prisma` | `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }`; empty initial migration |
| `packages/shared/tsup.config.ts` | `format: ["cjs", "esm"]`, `dts: true`, `entry: ["src/index.ts"]` |
| `.openspec/changes/` | Holds per-ticket spec folders |
| `.openspec/archive/` | Holds archived specs post-merge |
| `.claude/settings.json` | `mcpServers`: `context7` (live docs), `github` (PR ops via `$GITHUB_TOKEN`), `postgres` (dev DB via `$DATABASE_URL`) |
| `.claude/agents/reviewer.md` | Auditor definition: read-only tools, appends to `review-log.md` only |
| `.claude/agents/tester.md` | Tester definition: Write/Edit restricted to test file paths, never edits impl code |
| `.claude/skills/*.md` | Six starter skills: prisma-migration, zod-schema, express-route, react-component, tanstack-query, playwright-spec |
| `README.md` | Steps: clone → install → copy `.env.example` → start Docker → `prisma migrate dev` → `pnpm dev` → `pnpm test` |

## Scenarios

### INFRA-S1 — Fresh install succeeds
```
Given: a fresh clone on Node 22 + pnpm 9 with no node_modules
When:  pnpm install
Then:  exits 0; no unresolved peer dependency warnings
```
Validates: FR-INFRA-1, FR-INFRA-11

---

### INFRA-S2 — Full build exits clean
```
Given: pnpm install complete
When:  pnpm build
Then:  exits 0; 0 TypeScript errors; 0 warnings across apps/api, apps/web, packages/shared
```
Validates: FR-INFRA-2, FR-INFRA-14, FR-INFRA-15

---

### INFRA-S3 — Test suite runs green
```
Given: pnpm install complete; Docker Postgres running
When:  pnpm test --run
Then:  Vitest exits 0 (baseline unit tests pass);
       Playwright smoke.spec.ts exits 0 against dev server
```
Validates: FR-INFRA-4, FR-INFRA-5

---

### INFRA-S4 — Lint passes with zero warnings
```
Given: pnpm install complete
When:  pnpm lint --max-warnings 0
Then:  exits 0; no lint errors or warnings
```
Validates: FR-INFRA-8

---

### INFRA-S5 — Husky pre-commit hook fires correctly
```
Given: a staged .ts file with a deliberate type error
When:  git commit (hook fires)
Then:  hook runs typecheck → lint → test --run;
       exits non-zero; commit is blocked; error message references the type error

Given: a staged .ts file with no errors
When:  git commit
Then:  hook exits 0; commit proceeds
```
Validates: FR-INFRA-6

---

### INFRA-S6 — commitlint enforces AB# on feat/fix; exempts chore
```
Given: commitlint installed
When:  echo "feat: add login" | pnpm commitlint
Then:  exits non-zero; error mentions AB# requirement

When:  echo "feat: add login AB#1002" | pnpm commitlint
Then:  exits 0

When:  echo "chore: update deps" | pnpm commitlint
Then:  exits 0 (chore is exempt)

When:  echo "docs: update readme" | pnpm commitlint
Then:  exits 0 (docs is exempt)
```
Validates: FR-INFRA-7

---

### INFRA-S7 — Prisma connects and migrates
```
Given: Docker Compose postgres:16 container running; DATABASE_URL set in .env
When:  pnpm --filter=api prisma migrate dev --name init
Then:  exits 0; empty initial migration file created under prisma/migrations/
```
Validates: FR-INFRA-3, FR-INFRA-13

---

### INFRA-S8 — packages/shared resolves as CJS and ESM
```
Given: pnpm build complete
When:  node -e "const s = require('./packages/shared/dist/index.cjs'); console.log(typeof s)"
Then:  prints "object"; exits 0

When:  node --input-type=module -e "import * as s from './packages/shared/dist/index.js'; console.log(typeof s)"
Then:  prints "object"; exits 0
```
Validates: FR-INFRA-14

---

### INFRA-S9 — .env.example tracked; .env gitignored
```
Given: repo root with git initialized
When:  git ls-files .env.example
Then:  prints ".env.example"

When:  git ls-files .env
Then:  empty output (file is gitignored)

When:  git check-ignore -v .env
Then:  identifies .env as ignored by .gitignore
```
Validates: FR-INFRA-10

---

### INFRA-S10 — MCP settings.json contains env-referenced tokens only
```
Given: .claude/settings.json parsed as JSON
When:  inspecting all token/url values in mcpServers entries
Then:  mcpServers has keys: "context7", "github", "postgres"
       no entry contains a literal secret (password, token string);
       credential values are env variable references (e.g. "$GITHUB_TOKEN", "$DATABASE_URL")

When:  git ls-files .claude/settings.json
Then:  file IS tracked (safe to commit — contains no secrets)
```
Validates: FR-INFRA-18

---

## Dependencies

None — AB-1001 is the root ticket. All subsequent tickets (AB-1002 onward) depend on this ticket being merged.

## Open Questions

None.
