---
ticket: AB-1001
type: INFRA
status: APPROVED
---

## Tasks

After each task: invoke **reviewer agent** (Opus) to audit code vs FR-INFRA-* in FRS.md.
After T16: invoke **tester agent** (Sonnet) to run the infra test suite.

---

- [x] **T1 — Root scaffolding** *(10 min)*
  - Write `.gitignore` **first** (must include `.env` before any `git add`)
  - Write root `package.json` (`"private": true`, scripts: `build dev test lint typecheck`, all devDeps pinned per plan.md)
  - Write `pnpm-workspace.yaml` (`packages: ["apps/*", "packages/*"]`)
  - Write `.env.example` (`DATABASE_URL`, `JWT_SECRET`, `PORT`, `GITHUB_TOKEN` — placeholder values)
  - Verify: `git check-ignore -v .env` shows `.env` is ignored
  - **Files:** `.gitignore`, `package.json`, `pnpm-workspace.yaml`, `.env.example`
  - **Satisfies:** FR-INFRA-1 (partial), FR-INFRA-10, FR-INFRA-11, FR-INFRA-15

---

- [x] **T2 — TypeScript config** *(15 min)*
  - Write `tsconfig.base.json` (`strict: true`, `moduleResolution: bundler`, `target: ES2022`, `skipLibCheck: true`)
  - Write `apps/api/tsconfig.json` (extends base; `outDir: dist`, `rootDir: src`)
  - Write `apps/web/tsconfig.json` (extends base; `jsx: react-jsx`)
  - Write `packages/shared/tsconfig.json` (extends base; `declaration: true`, `outDir: dist`)
  - **Files:** `tsconfig.base.json`, `apps/api/tsconfig.json`, `apps/web/tsconfig.json`, `packages/shared/tsconfig.json`
  - **Satisfies:** FR-INFRA-2

---

- [x] **T3 — Package manifests** *(20 min)*
  - Write `apps/api/package.json` (name `@noteapp/api`, all deps pinned per plan.md: express, @prisma/client, zod, bcrypt, jsonwebtoken, express-rate-limit, dotenv + devDeps)
  - Write `apps/web/package.json` (name `@noteapp/web`, all deps pinned per plan.md: react, react-dom, vite, @tanstack/react-query, zustand, tiptap, dompurify, date-fns, lucide-react, zod + devDeps)
  - Write `packages/shared/package.json` (name `@noteapp/shared`, exports map for CJS+ESM+types, `"files": ["dist"]`, zod dep, tsup devDep)
  - **Files:** `apps/api/package.json`, `apps/web/package.json`, `packages/shared/package.json`
  - **Satisfies:** FR-INFRA-1, FR-INFRA-11

---

- [x] **T4 — pnpm install** *(10 min)*
  - Run `pnpm install`
  - Verify: exits 0, no unresolved peer dependency errors
  - Run `pnpm husky init` to initialize husky (or `pnpm exec husky init`)
  - Commit `pnpm-lock.yaml` to git
  - **Files:** `pnpm-lock.yaml` (generated)
  - **Satisfies:** FR-INFRA-1, FR-INFRA-11 (lockfile pins transitive deps)

---

- [x] **T5 — packages/shared build** *(15 min)*
  - Write `packages/shared/tsup.config.ts` (`format: ["cjs","esm"]`, `dts: true`, `entry: ["src/index.ts"]`, `clean: true`)
  - Write `packages/shared/src/index.ts` (empty barrel: `export {}`)
  - Run `pnpm --filter=@noteapp/shared build`
  - Verify: `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts` all present
  - **Files:** `packages/shared/tsup.config.ts`, `packages/shared/src/index.ts`
  - **Satisfies:** FR-INFRA-14

---

- [x] **T6 — apps/api skeleton** *(15 min)* `[PARALLEL with T7]`
  - Write `apps/api/src/index.ts` (minimal Express 5 app: `GET /health → 200 { status: "ok" }`; listens on `process.env.PORT ?? 3000`)
  - Write `apps/api/prisma/schema.prisma` (generator + datasource blocks; no models)
  - Verify: `pnpm --filter=@noteapp/api build` exits 0 (tsc compiles)
  - **Files:** `apps/api/src/index.ts`, `apps/api/prisma/schema.prisma`
  - **Satisfies:** FR-INFRA-3 (partial — schema ready for migrate)

---

- [x] **T7 — apps/web skeleton** *(20 min)* `[PARALLEL with T6]`
  - Write `apps/web/vite.config.ts` (`@vitejs/plugin-react`, `server: { port: 5173 }`)
  - Write `apps/web/index.html` (standard Vite entry; `<div id="root"></div>`)
  - Write `apps/web/src/main.tsx` (`ReactDOM.createRoot` mounting `<App />`)
  - Write `apps/web/src/App.tsx` (renders `<h1>NoteApp</h1>` only)
  - Verify: `pnpm --filter=@noteapp/web build` exits 0
  - **Files:** `apps/web/vite.config.ts`, `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`
  - **Satisfies:** FR-INFRA-15 (web build script works)

---

- [x] **T8 — Vitest config** *(20 min)*
  - Write root `vitest.config.ts` (workspace mode: `workspace: ['apps/api/vitest.config.ts', 'apps/web/vitest.config.ts']`)
  - Write `apps/api/vitest.config.ts` (`environment: "node"`, `coverage: { provider: "v8", threshold: { lines: 80 } }`)
  - Write `apps/web/vitest.config.ts` (`environment: "jsdom"`, `setupFiles: ["./src/test-setup.ts"]`, same coverage threshold)
  - Write `apps/web/src/test-setup.ts` (`import "@testing-library/jest-dom"`)
  - Run `pnpm test --run`
  - Verify: exits 0 (no test files yet → 0 suites, 0 failures)
  - **Files:** `vitest.config.ts`, `apps/api/vitest.config.ts`, `apps/web/vitest.config.ts`, `apps/web/src/test-setup.ts`
  - **Satisfies:** FR-INFRA-4

---

- [x] **T9 — Playwright smoke test** *(20 min)*
  - Write `apps/web/playwright.config.ts` (`baseURL: "http://localhost:5173"`, `testDir: "./e2e"`, projects: Chromium only, `webServer` block auto-starts Vite)
  - Write `apps/web/e2e/smoke.spec.ts` (`test("INFRA-S3: baseline smoke", ...)` — navigate `/`, assert `<h1>NoteApp</h1>` visible)
  - Run `pnpm --filter=@noteapp/web exec playwright install chromium`
  - Run `pnpm --filter=@noteapp/web exec playwright test`
  - Verify: smoke test passes (1/1 green)
  - **Files:** `apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts`
  - **Satisfies:** FR-INFRA-5, INFRA-S3

---

- [x] **T10 — ESLint + Prettier** *(20 min)*
  - Write `eslint.config.js` (ESLint 9 flat config: `typescript-eslint` via `tseslint.config()`, `eslint-plugin-react-hooks`, ignores `dist/**`, `node_modules/**`)
  - Write `.prettierrc.json` (`singleQuote: true`, `trailingComma: "all"`, `printWidth: 100`, `semi: true`)
  - Add `lint` root script: `eslint . --max-warnings 0`
  - Add `format` root script: `prettier --write .`
  - Run `pnpm lint --max-warnings 0`
  - Verify: exits 0; fix any auto-fixable issues before marking done
  - **Files:** `eslint.config.js`, `.prettierrc.json`
  - **Satisfies:** FR-INFRA-8, INFRA-S4

---

- [x] **T11 — Husky + commitlint** *(25 min)*
  - Write `.husky/pre-commit`:
    ```sh
    #!/bin/sh
    pnpm typecheck && pnpm lint --max-warnings 0 && pnpm test --run
    ```
  - Write `commitlint.config.cjs` (extends `@commitlint/config-conventional`; custom rule requiring `AB#\d+` in subject when type is `feat` or `fix`)
  - Add `commitlint` root script: `commitlint --edit`
  - Make `.husky/pre-commit` executable (`git update-index --chmod=+x .husky/pre-commit` on Windows)
  - Verify INFRA-S5: run `git commit` with a deliberate type error → blocked
  - Verify INFRA-S6: all four commitlint cases (`feat` no AB#, `feat` with AB#, `chore`, `docs`)
  - **Files:** `.husky/pre-commit`, `commitlint.config.cjs`
  - **Satisfies:** FR-INFRA-6, FR-INFRA-7, INFRA-S5, INFRA-S6

---

- [x] **T12 — Docker Compose + Prisma migrate** *(15 min)*
  - Write `docker-compose.yml` (`postgres:16` service, port `5432:5432`, named volume `noteapp_pgdata`, health check via `pg_isready`)
  - Ensure `.env` has `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/noteapp_dev`
  - Start Docker Desktop; run `docker compose up -d`
  - Run `pnpm --filter=@noteapp/api exec prisma migrate dev --name init`
  - Verify: exits 0; `apps/api/prisma/migrations/` contains the init migration folder
  - **Files:** `docker-compose.yml`
  - **Satisfies:** FR-INFRA-3, FR-INFRA-13, INFRA-S7

---

- [x] **T13 — README.md** *(15 min)* `[PARALLEL with T14, T15]`
  - Write `README.md` covering: prerequisites (Node 22, pnpm 9, Docker), steps (clone → `pnpm install` → copy `.env.example` → `docker compose up -d` → `prisma migrate dev` → `pnpm dev` → `pnpm test`), script reference table, project structure overview
  - **Files:** `README.md`
  - **Satisfies:** FR-INFRA-12

---

- [x] **T14 — .claude/skills (5 files)** *(50 min)* `[PARALLEL with T13, T15]` `[SUBAGENT: Haiku]`
  - Write `.claude/skills/prisma-migration.md` (naming convention `YYYYMMDDHHMMSS_description`; soft-delete pattern using `deletedAt`; when to use `$transaction`; never `DELETE FROM` notes)
  - Write `.claude/skills/zod-schema.md` (schemas live only in `packages/shared/src/schemas/`; export from barrel; how BE imports via `@noteapp/shared`; how FE imports same)
  - Write `.claude/skills/express-route.md` (Express 5 route template: `import { Router } from "express"`; Zod `.safeParse` on body; service call; typed `res.json`; error forwarded to `next(err)`; global error handler pattern)
  - Write `.claude/skills/react-component.md` (shadcn/ui import pattern from `@/components/ui`; TanStack Query `useQuery` co-located with component; Zustand slice access via selector; aria-label on interactive elements)
  - Write `.claude/skills/tanstack-query.md` (query key factory pattern per domain: `noteKeys.all`, `noteKeys.list(filters)`; `useInfiniteQuery` cursor pattern; `useMutation` with `onSuccess` cache invalidation; `queryClient.clear()` on logout per FR-UI-AUTH-6)
  - **Files:** `.claude/skills/prisma-migration.md`, `.claude/skills/zod-schema.md`, `.claude/skills/express-route.md`, `.claude/skills/react-component.md`, `.claude/skills/tanstack-query.md`
  - **Satisfies:** FR-INFRA-17

---

- [x] **T15 — Cleanup** *(5 min)* `[PARALLEL with T13, T14]`
  - Inspect `openspec/` (no dot) at root — confirm contents; delete if empty
  - Verify `.openspec/` (dot-prefixed) has `changes/` and `archive/` subdirs
  - Verify `git ls-files .openspec` shows spec.md, plan.md, tasks.md tracked
  - **Files:** `openspec/` (deleted), `.openspec/archive/` (ensure exists)
  - **Satisfies:** FR-INFRA-9

---

- [x] **T16 — Infra test file** *(50 min)* `[SUBAGENT: Sonnet/tester]`
  - Write `apps/api/src/__tests__/infra.test.ts` with exactly 10 named tests:
    - `it("INFRA-S1: pnpm install exits 0 on fresh clone", ...)` — `execSync("pnpm install --frozen-lockfile")`
    - `it("INFRA-S2: pnpm build exits 0 with 0 errors", ...)` — `execSync("pnpm build")`
    - `it("INFRA-S4: pnpm lint --max-warnings 0 exits 0", ...)` — `execSync("pnpm lint --max-warnings 0")`
    - `it("INFRA-S5: husky pre-commit blocks on type error", ...)` — write bad .ts file, attempt commit, assert exit ≠ 0, clean up
    - `it("INFRA-S6: commitlint rejects feat without AB#", ...)` — pipe to commitlint, assert exit ≠ 0
    - `it("INFRA-S6: commitlint accepts feat with AB#", ...)` — pipe, assert exit 0
    - `it("INFRA-S6: commitlint accepts chore without AB#", ...)` — pipe, assert exit 0
    - `it("INFRA-S6: commitlint accepts docs without AB#", ...)` — pipe, assert exit 0
    - `it("INFRA-S7: prisma migrate dev exits 0", ...)` — requires Docker; skip if `DATABASE_URL` unset
    - `it("INFRA-S8: shared dist resolves as CJS and ESM", ...)` — `require("../../../packages/shared/dist/index.cjs")` + dynamic `import()`
    - `it("INFRA-S9: .env.example tracked; .env gitignored", ...)` — `execSync("git ls-files .env.example")` non-empty; `execSync("git ls-files .env")` empty
    - `it("INFRA-S10: settings.json has MCP keys with no literal secrets", ...)` — JSON.parse; assert keys present; assert no value contains literal token string
  - Run `pnpm test --run`
  - Report: N passing / 10; any failures with file+line+expected/actual
  - **Files:** `apps/api/src/__tests__/infra.test.ts`
  - **Satisfies:** INFRA-S1, S2, S4, S5, S6, S7, S8, S9, S10 (S3 covered by T9)
