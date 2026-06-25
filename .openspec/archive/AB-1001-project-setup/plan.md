---
ticket: AB-1001
type: INFRA
status: APPROVED
---


## Pre-existing Assets (Do Not Re-create)

| Asset | Status |
|-------|--------|
| `.claude/settings.json` | [DONE] Complete — Context7, GitHub, Postgres MCP wired |
| `.claude/agents/reviewer.md` | [DONE] Complete |
| `.claude/agents/tester.md` | [DONE] Complete |
| `.claude/skills/playwright-spec.md` | [DONE] Complete (1 of 6) |
| `.claude/commands/*.md` | [DONE] Complete (implement, parallel, plan, pr, review, spec, tasks) |
| `docs/FRS.md`, `docs/SDS.md`, `docs/UX.md` | [DONE] Present |
| `.openspec/changes/AB-1001-project-setup/spec.md` | [DONE] APPROVED |
| `apps/api/` | Empty dir — needs population |
| `apps/web/` | Empty dir — needs population |
| `packages/shared/` | Empty dir — needs population |

## Files to Create

### Root
| File | Notes |
|------|-------|
| `package.json` | Workspace root: scripts, shared devDeps, `"private": true` |
| `pnpm-workspace.yaml` | `packages: ["apps/*", "packages/*"]` |
| `tsconfig.base.json` | `strict: true`, `moduleResolution: bundler`, `target: ES2022` |
| `vitest.config.ts` | Workspace mode: `workspace: ['apps/*/vitest.config.ts']` |
| `eslint.config.js` | ESLint 9 flat config; TS + react-hooks plugins |
| `.prettierrc.json` | `singleQuote: true`, `trailingComma: "all"`, `printWidth: 100` |
| `commitlint.config.cjs` | Extends `@commitlint/config-conventional`; custom AB# rule on feat/fix |
| `.gitignore` | `node_modules`, `dist`, `.env`, `*.env`, `prisma/migrations/*.sql` excluded from lock |
| `.env.example` | `DATABASE_URL`, `JWT_SECRET`, `PORT`, `GITHUB_TOKEN` — placeholder values |
| `docker-compose.yml` | `postgres:16`, port `5432:5432`, health check, named volume |
| `README.md` | Setup steps: clone → install → env → docker → migrate → dev → test |

### apps/api
| File | Notes |
|------|-------|
| `apps/api/package.json` | Express 5, Prisma, bcrypt, jsonwebtoken, zod, express-rate-limit, dotenv |
| `apps/api/tsconfig.json` | Extends `../../tsconfig.base.json`; `outDir: dist` |
| `apps/api/vitest.config.ts` | `environment: "node"`; coverage threshold 80% |
| `apps/api/src/index.ts` | Minimal Express app: `GET /health → 200 { status: "ok" }` |
| `apps/api/prisma/schema.prisma` | `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }` + empty generator block; no models yet |

### apps/web
| File | Notes |
|------|-------|
| `apps/web/package.json` | React 19, Vite, TanStack Query, Zustand, TipTap, DOMPurify, date-fns, lucide-react, zod |
| `apps/web/tsconfig.json` | Extends `../../tsconfig.base.json`; `jsx: react-jsx` |
| `apps/web/vite.config.ts` | `@vitejs/plugin-react`; `server.port: 5173` |
| `apps/web/index.html` | Standard Vite entry; mounts `#root` |
| `apps/web/src/main.tsx` | `ReactDOM.createRoot` + `<App />` |
| `apps/web/src/App.tsx` | Minimal: renders `<h1>NoteApp</h1>` |
| `apps/web/vitest.config.ts` | `environment: "jsdom"`; coverage threshold 80% |
| `apps/web/playwright.config.ts` | `baseURL: "http://localhost:5173"`; Chromium only |
| `apps/web/e2e/smoke.spec.ts` | Baseline: navigate to `/`, assert `<h1>NoteApp</h1>` visible |

### packages/shared
| File | Notes |
|------|-------|
| `packages/shared/package.json` | `name: "@noteapp/shared"`; exports map for CJS + ESM + types; `"files": ["dist"]` |
| `packages/shared/tsconfig.json` | Extends `../../tsconfig.base.json`; `declaration: true` |
| `packages/shared/tsup.config.ts` | `format: ["cjs", "esm"]`, `dts: true`, `entry: ["src/index.ts"]` |
| `packages/shared/src/index.ts` | Empty re-export barrel (models added in AB-1002+) |

### .claude/skills (5 remaining)
| File | Content summary |
|------|----------------|
| `.claude/skills/prisma-migration.md` | Conventions for writing Prisma migrations (naming, soft-delete pattern, transaction usage) |
| `.claude/skills/zod-schema.md` | Where schemas live (`packages/shared`), how to export, how FE + BE import them |
| `.claude/skills/express-route.md` | Express 5 route template: Zod parse → service call → typed response → error handler |
| `.claude/skills/react-component.md` | shadcn/ui component conventions, TanStack Query hooks pattern, Zustand slice pattern |
| `.claude/skills/tanstack-query.md` | `useQuery` / `useInfiniteQuery` / `useMutation` patterns; query key conventions |

### .husky
| File | Content |
|------|---------|
| `.husky/pre-commit` | `pnpm typecheck && pnpm lint --max-warnings 0 && pnpm test --run` |

### Tests
| File | Scenarios covered |
|------|------------------|
| `apps/api/src/__tests__/infra.test.ts` | INFRA-S1, S2, S4, S5, S6, S7, S8, S9, S10 (shell assertions via `execSync`) |
| `apps/web/e2e/smoke.spec.ts` | INFRA-S3 (Playwright baseline) |

## Files to Investigate / Clean Up

| Item | Action |
|------|--------|
| `.env` (root) | **[WARN] Must be gitignored before any commit.** Check contents -- do not commit. If it contains real secrets, rotate them. |
| `openspec/` (no dot, at root) | Appears to be a leftover from pre-init scaffolding. Confirm contents are empty; delete if so. Canonical dir is `.openspec/`. |

## Prisma Schema Changes

`apps/api/prisma/schema.prisma` — initial state (no models):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

First migration name: `init` (empty — no tables yet). Run:
```
pnpm --filter=api prisma migrate dev --name init
```

Models are introduced starting in AB-1002.

## New Packages — Pinned Versions

> All versions use exact pinning (no `^` or `~`). Verify latest patch via
> `npm view <pkg> version` before install; update these if a newer patch exists.

### Root `devDependencies`
```json
{
  "typescript": "5.8.3",
  "eslint": "9.28.0",
  "@typescript-eslint/eslint-plugin": "8.33.0",
  "@typescript-eslint/parser": "8.33.0",
  "eslint-plugin-react-hooks": "5.2.0",
  "prettier": "3.5.3",
  "husky": "9.1.7",
  "@commitlint/cli": "19.8.1",
  "@commitlint/config-conventional": "19.8.1"
}
```

### `apps/api` — `dependencies`
```json
{
  "express": "5.1.0",
  "@prisma/client": "6.9.0",
  "zod": "3.25.56",
  "bcrypt": "5.1.1",
  "jsonwebtoken": "9.0.2",
  "express-rate-limit": "7.5.0",
  "dotenv": "16.5.0"
}
```
### `apps/api` — `devDependencies`
```json
{
  "prisma": "6.9.0",
  "@types/express": "5.0.3",
  "@types/bcrypt": "5.0.2",
  "@types/jsonwebtoken": "9.0.9",
  "@types/node": "22.15.30",
  "@types/supertest": "6.0.3",
  "supertest": "7.1.0",
  "vitest": "2.2.5",
  "@vitest/coverage-v8": "2.2.5"
}
```

### `apps/web` — `dependencies`
```json
{
  "react": "19.1.0",
  "react-dom": "19.1.0",
  "@tanstack/react-query": "5.80.7",
  "zustand": "5.0.5",
  "@tiptap/react": "2.11.7",
  "@tiptap/starter-kit": "2.11.7",
  "dompurify": "3.2.6",
  "date-fns": "3.6.0",
  "lucide-react": "0.511.0",
  "zod": "3.25.56"
}
```
### `apps/web` — `devDependencies`
```json
{
  "@types/react": "19.1.5",
  "@types/react-dom": "19.1.5",
  "@types/dompurify": "3.0.5",
  "@vitejs/plugin-react": "4.5.0",
  "vite": "6.3.5",
  "vitest": "2.2.5",
  "@vitest/coverage-v8": "2.2.5",
  "jsdom": "26.1.0",
  "@testing-library/react": "16.3.0",
  "@testing-library/user-event": "14.6.1",
  "@testing-library/jest-dom": "6.6.3",
  "msw": "2.9.0",
  "@playwright/test": "1.52.0"
}
```

### `packages/shared` — `dependencies`
```json
{
  "zod": "3.25.56"
}
```
### `packages/shared` — `devDependencies`
```json
{
  "tsup": "8.4.0",
  "typescript": "5.8.3"
}
```

## Dependencies on Prior Tickets

None — AB-1001 is the root. All subsequent tickets depend on this branch being merged to `main`.

## Risk Areas

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | **Husky on Windows**: pre-commit hooks require Git Bash (`#!/bin/sh` shebang); PowerShell won't execute them. | High | Use `#!/bin/sh` in `.husky/pre-commit`. Test with an actual `git commit` on the current machine before marking done. |
| R2 | **`.env` already present**: an uncommitted `.env` exists with unknown contents. If committed it becomes part of git history permanently. | High | Add `.env` to `.gitignore` as the very first file write of this ticket. Verify via `git check-ignore .env` before any `git add`. |
| R3 | **commitlint AB# custom rule**: requires a custom `rules` entry (or inline plugin). Incorrect regex will silently pass invalid commits or block valid ones. | Medium | Validate all four INFRA-S6 cases (feat without AB#, feat with AB#, chore, docs) before marking task complete. |
| R4 | **ESLint 9 flat config**: breaking change from `.eslintrc`. TypeScript and React plugins must use the new `FlatCompat` or native flat-config exports. | Medium | Use `typescript-eslint`'s `config()` helper (available since v8) which supports flat config natively. |
| R5 | **`openspec/` duplicate dir**: a no-dot `openspec/` directory coexists with `.openspec/`. If left in place it will be committed and cause confusion. | Medium | Confirm it's empty; delete before first commit. `.openspec/` is canonical per FR-INFRA-9. |
| R6 | **packages/shared exports map**: CJS (`.cjs`) + ESM (`.js`) + types (`.d.ts`) exports field must be correct or downstream imports silently fall back to wrong format. | Medium | Validate INFRA-S8 (both CJS `require` and ESM `import`) before closing task. |
| R7 | **React 19 peer deps**: some devDependencies (testing-library, msw, TipTap) may still have `peerDependencies` on React 18. Installs may warn. | Low | Accept warnings for now; suppress only after confirming the packages actually work at runtime. Do not add `--legacy-peer-deps` without verifying functionality. |

## Test Strategy

| Scenario | Test file | Tool | What it asserts |
|----------|-----------|------|----------------|
| INFRA-S1 | `apps/api/src/__tests__/infra.test.ts` | Vitest + `execSync` | `pnpm install --frozen-lockfile` exits 0 |
| INFRA-S2 | `apps/api/src/__tests__/infra.test.ts` | Vitest + `execSync` | `pnpm build` exits 0 with empty stderr |
| INFRA-S3 | `apps/web/e2e/smoke.spec.ts` | Playwright | Navigate `/`; `<h1>NoteApp</h1>` visible |
| INFRA-S4 | `apps/api/src/__tests__/infra.test.ts` | Vitest + `execSync` | `pnpm lint --max-warnings 0` exits 0 |
| INFRA-S5 | `apps/api/src/__tests__/infra.test.ts` | Vitest + `execSync` | Spawn `git commit` with deliberate type error; assert exit code ≠ 0 |
| INFRA-S6 | `apps/api/src/__tests__/infra.test.ts` | Vitest + `execSync` | Four commitlint pipe cases; assert exit codes |
| INFRA-S7 | `apps/api/src/__tests__/infra.test.ts` | Vitest + `execSync` | `prisma migrate dev --name init` exits 0 (requires Docker) |
| INFRA-S8 | `apps/api/src/__tests__/infra.test.ts` | Vitest + `execSync` | CJS `require` + ESM `import` of `packages/shared/dist` both resolve |
| INFRA-S9 | `apps/api/src/__tests__/infra.test.ts` | Vitest + `execSync` | `git ls-files .env.example` → non-empty; `git ls-files .env` → empty |
| INFRA-S10 | `apps/api/src/__tests__/infra.test.ts` | Vitest (fs read) | Parse `.claude/settings.json`; assert three MCP keys; assert no literal secrets |

All 10 scenarios map to exactly one named test (`it("INFRA-SN: ...")`) per CLAUDE.md rule.

## Implementation Order (for /tasks)

Tasks must run in this order due to dependencies:

```
T1  Root scaffolding         package.json, pnpm-workspace.yaml, .gitignore (.env first!), .env.example
T2  TypeScript config        tsconfig.base.json + per-package tsconfig.json files
T3  Workspace package.json   apps/api, apps/web, packages/shared package.json files
T4  pnpm install             Run install; verify 0 errors, lock file committed
T5  packages/shared build    tsup.config.ts, src/index.ts; verify pnpm --filter=shared build
T6  apps/api skeleton        src/index.ts (health endpoint), prisma/schema.prisma
T7  apps/web skeleton        vite.config.ts, index.html, src/main.tsx, src/App.tsx
T8  Vitest config            Root vitest.config.ts + per-package configs; baseline passing
T9  Playwright smoke         playwright.config.ts + e2e/smoke.spec.ts; smoke passes
T10 ESLint + Prettier        eslint.config.js, .prettierrc.json; pnpm lint exits 0
T11 Husky + commitlint       .husky/pre-commit, commitlint.config.cjs; INFRA-S5+S6 pass
T12 Docker + Prisma          docker-compose.yml; migrate dev --name init; INFRA-S7 passes
T13 README                   README.md with full setup steps
T14 .claude/skills           5 remaining skill files
T15 Cleanup                  Delete openspec/ (no dot); confirm .openspec/ is canonical
T16 Infra test file          apps/api/src/__tests__/infra.test.ts covering INFRA-S1..S10
```
