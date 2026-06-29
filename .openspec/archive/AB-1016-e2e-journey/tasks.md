---
id: AB-1016
status: APPROVED
---

# Tasks — AB-1016 E2E Journey

- [x] TASK-1: Update `apps/web/playwright.config.ts` — change `testMatch` to `'**/*.{e2e,spec}.ts'` [PARALLEL] ~5 min
  - Scenarios: prerequisite for E2E-S1..S11 (journey.spec.ts discovery)
  - Files touched: `apps/web/playwright.config.ts`

- [x] TASK-2: Create `apps/web/e2e/journey.spec.ts` — single Playwright test, 11 steps [PARALLEL] [SUBAGENT] ~60 min
  - Scenarios: E2E-S1, E2E-S2, E2E-S3, E2E-S4, E2E-S5, E2E-S6, E2E-S7, E2E-S8, E2E-S9, E2E-S10, E2E-S11
  - Files touched: `apps/web/e2e/journey.spec.ts`
  - Subagent brief:
    - Scope: write the full journey spec per plan.md § Implementation Detail
    - Single `test()` block; `page.addInitScript()` clipboard mock before first `page.goto()`
    - Unique email: `test-${Date.now()}@example.com`
    - Use `toBeVisible({ timeout: 10_000 })` for autosave "Saved" — never `waitForTimeout`
    - Key selectors listed in plan.md (derived from component source)
    - Model: Sonnet

- [x] TASK-3: Create `scripts/check-e2e-coverage.mjs` — ESM Node FR coverage script [PARALLEL] ~20 min
  - Scenarios: E2E-COV-S1
  - Files touched: `scripts/check-e2e-coverage.mjs`
  - Algorithm: read docs/FRS.md → extract FR-* identifiers → check each appears in journey.spec.ts → exit 0 ("All FRs covered") or exit 1 (list uncovered)
  - Use `import.meta.url` + `fileURLToPath` for path resolution (Windows-safe)

- [x] TASK-4: Add `coverage:e2e` script to root `package.json` [PARALLEL] ~5 min
  - Scenarios: E2E-COV-S1
  - Files touched: `package.json` (root)
  - Change: add `"coverage:e2e": "node scripts/check-e2e-coverage.mjs"` to scripts block
