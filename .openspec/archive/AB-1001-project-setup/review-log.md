# Review Log -- AB-1001

All task reviews conducted 2026-06-25. Legend: [OK] pass | [WARN] minor drift | [FAIL] missing | [SEC] security | [COVERAGE] no test

---

## T1 -- Root Scaffolding

[OK] FR-INFRA-1 -- pnpm-workspace.yaml declares apps/* and packages/*
[OK] FR-INFRA-10 -- .env gitignored; .env.example exempted with !.env.example
[OK] FR-INFRA-11 -- All root devDependencies exact-pinned (no ^, ~, @latest)
[OK] FR-INFRA-15 -- Scripts: build, dev, test, lint, typecheck all present
[WARN] FR-INFRA-10 -- DATABASE_URL in .env.example uses 'postgres' as password (common local default; not a production secret, but less clearly a placeholder than the other values)

---

## T2 -- TypeScript Configs

[OK] FR-INFRA-2 -- tsconfig.base.json has "strict": true
[OK] FR-INFRA-2 -- All package tsconfigs extend tsconfig.base.json
[OK] FR-INFRA-2 -- apps/api outDir: dist, rootDir: src
[OK] FR-INFRA-2 -- packages/shared has declaration: true
[COVERAGE] FR-INFRA-2 -- No test asserting that a non-strict file is rejected by tsc

---

## T3 -- Package Manifests

[OK] FR-INFRA-1 -- apps/api package.json has all required dependencies exact-pinned
[OK] FR-INFRA-1 -- apps/web package.json has all required dependencies exact-pinned
[OK] FR-INFRA-14 -- packages/shared exports map has types/import/require under "."
[OK] FR-INFRA-11 -- No ^ or ~ found in any package.json

---

## T4 -- pnpm install + Husky

[OK] FR-INFRA-1 -- pnpm-lock.yaml present
[OK] FR-INFRA-6 -- .husky/pre-commit exists
[OK] INFRA-S1 -- pnpm install --frozen-lockfile exits 0 (tested in infra.test.ts)

---

## T5 -- packages/shared build

[OK] FR-INFRA-14 -- dist/index.js (ESM) present
[OK] FR-INFRA-14 -- dist/index.cjs (CJS) present
[OK] FR-INFRA-14 -- dist/index.d.ts (types) present

---

## T6 -- apps/api skeleton

[OK] FR-INFRA-3 -- prisma/schema.prisma has generator + datasource blocks
[OK] FR-INFRA-3 -- datasource uses env("DATABASE_URL"); no hardcoded credentials
[OK] FR-INFRA-15 -- apps/api build exits 0
[COVERAGE] FR-INFRA-3 -- No test asserting @prisma/client resolves after generate

---

## T7 -- apps/web skeleton

[OK] FR-INFRA-15 -- apps/web build exits 0 (vite build succeeds)
[OK] FR-INFRA-15 -- index.html + main.tsx + App.tsx present
[OK] FR-INFRA-15 -- vite.config.ts uses @vitejs/plugin-react

---

## T8 -- Vitest config

[OK] FR-INFRA-4 -- vitest.workspace.ts roots api (node) and web (jsdom)
[OK] FR-INFRA-4 -- Coverage threshold 80% declared in both configs
[OK] FR-INFRA-4 -- apps/web include pattern excludes e2e files
[DISMISSED] FR-INFRA-11 -- vitest pinned at 4.1.9 (reviewer flagged as non-existent; confirmed real by "RUN v4.1.9" in test output and 105 passing tests)

---

## T9 -- Playwright smoke test

[OK] FR-INFRA-5 -- playwright.config.ts exists with testDir: ./e2e, testMatch: **/*.e2e.ts
[OK] FR-INFRA-5 -- smoke.e2e.ts navigates / and asserts NoteApp heading
[OK] INFRA-S3 -- Smoke test passes (1/1 green)
[OK] FR-INFRA-5 -- reuseExistingServer: false, port 5174 to avoid collisions

---

## T10 -- ESLint + Prettier

[OK] FR-INFRA-8 -- eslint.config.mjs (ESM, renamed from .js to avoid Node warning)
[OK] FR-INFRA-8 -- .prettierrc.json: singleQuote, trailingComma: all, printWidth: 100, semi
[OK] FR-INFRA-8 -- pnpm lint --max-warnings 0 exits 0
[COVERAGE] FR-INFRA-8 -- No canary test asserting lint fails on a rule-violating file
[COVERAGE] FR-INFRA-8 -- prettier --check not wired into pre-commit hook

---

## T11 -- Husky + commitlint

[OK] FR-INFRA-6 -- .husky/pre-commit runs: pnpm typecheck && pnpm lint --max-warnings 0 && pnpm test --run
[OK] FR-INFRA-7 -- commitlint.config.cjs extends @commitlint/config-conventional
[OK] FR-INFRA-7 -- ab-reference-required rule blocks feat/fix without AB#\d+
[OK] FR-INFRA-7 -- .husky/commit-msg invokes pnpm commitlint --edit $1
[OK] INFRA-S6 -- All four commitlint cases pass (feat+AB# ok, feat-no-AB# blocked, chore ok, docs ok)

---

## T12 -- Docker Compose + Prisma migrate

[OK] FR-INFRA-13 -- docker-compose.yml: postgres:16, port 5432:5432, volume noteapp_pgdata
[OK] FR-INFRA-13 -- healthcheck: pg_isready -U postgres, interval 5s, retries 5
[OK] FR-INFRA-3 -- prisma migrate dev exits 0 against live Docker container
[OK] FR-INFRA-11 -- POSTGRES_PASSWORD sourced from env var (no hardcoded secret)
[WARN] FR-INFRA-13 -- postgres:16 is a floating major tag; patch-level tag would be more reproducible
[COVERAGE] FR-INFRA-3 -- No test asserting @prisma/client instantiates against DATABASE_URL

---

## T13-T16 -- README, Skills, Cleanup, Tests

[OK] FR-INFRA-12 -- README.md: prerequisites, quick start, script table, project structure
[OK] FR-INFRA-17 -- 5 .claude/skills files: prisma-migration, zod-schema, express-route, react-component, tanstack-query
[OK] FR-INFRA-9 -- .openspec/archive/ exists; openspec/ (no dot) does not exist
[OK] INFRA-S1..S10 -- All scenarios have named tests in infra.test.ts (105 passing, 1 skipped)

---

## Summary

Unresolved findings: 0 genuine failures.
Dismissed: vitest 4.1.9 false positive (confirmed real).
Coverage gaps noted above are acceptable for INFRA ticket scope.
