---
id: AB-1016
status: APPROVED
---

# Plan — AB-1016 E2E Journey

## Files to Create

| File | Purpose |
|------|---------|
| `apps/web/e2e/journey.spec.ts` | Single Playwright test covering all 11 journey steps (E2E-S1..S11) |
| `scripts/check-e2e-coverage.mjs` | ESM Node script; parses FRS.md + journey.spec.ts; reports uncovered FRs (E2E-COV-S1) |

## Files to Modify

| File | Change |
|------|--------|
| `apps/web/playwright.config.ts` | `testMatch` → `'**/*.{e2e,spec}.ts'` so `journey.spec.ts` is picked up alongside `smoke.e2e.ts` |
| `package.json` (root) | Add script `"coverage:e2e": "node scripts/check-e2e-coverage.mjs"` |

## Prisma Schema Changes

None. AB-1016 is a test-only ticket.

## New Packages

None. The coverage script is written as plain ESM JavaScript (`.mjs`) to avoid adding `tsx` or any other runner.

## Dependencies

All of AB-1001 through AB-1015 must be merged. Specifically the following endpoints must be reachable against the local dev server:
- POST /auth/register, /auth/login, /auth/logout
- POST /notes, PATCH /notes/:id, GET /notes, GET /notes/:id
- POST /tags
- GET /search
- POST /notes/:id/shares, DELETE /notes/:id/shares/:token, GET /notes/:id/shares
- GET /notes/:id/versions, GET /notes/:id/versions/:versionId, POST /notes/:id/versions/:versionId/restore

## Implementation Detail

### `apps/web/e2e/journey.spec.ts`

Structure:
```
import { test, expect } from '@playwright/test'

test.beforeAll(async ({ browser }) => {
  // clipboard mock applied per-context — see Decision 4 in spec.md
})

test('E2E-S1..S11: full user journey', async ({ page }) => {
  // Step 0: mock clipboard before first navigation
  await page.addInitScript(() => {
    let _clip = ''
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (t: string) => { _clip = t; return Promise.resolve() } },
      configurable: true,
    })
    Object.defineProperty(window, '__clipboardData', { get: () => _clip })
  })

  // E2E-S1: register + land on /notes
  // E2E-S2: click "Create your first note" → /notes/new
  // E2E-S3: type title + body → wait for "Saved"
  // E2E-S4: open tag combobox → type "e2e-tag" → Enter → chip visible
  // E2E-S5: navigate to /notes → NoteCard visible with tag
  // E2E-S6: /search → type "E2E Note" → <mark> result → click
  // E2E-S7: open share modal → generate with expiry → toast + clipboard
  // E2E-S8: revoke link → confirm → "Revoked" badge
  // E2E-S9: edit body → autosave → history drawer shows version 2
  // E2E-S10: click version 1 → split preview → Restore → confirm → toast
  // E2E-S11: click Logout → /login → /notes redirects back
})
```

Key selectors derived from reading existing components:
- Register form: `getByRole('button', { name: 'Create account' })`
- Empty state CTA: `getByRole('link', { name: 'Create your first note' })`
- Autosave indicator: `getByText('Saved')` (aria-live span in `EditorStatusIndicator`)
- Tag "Add tag" button: `getByRole('button', { name: 'Add tag' })`
- Tag combobox input: `getByPlaceholder('Search or create tag…')`
- History button: `getByRole('button', { name: /history/i })`
- Version list items: `getByTestId('version-list-item')`
- Version preview pane: `getByTestId('version-preview-pane')`
- Restore button: `getByRole('button', { name: 'Restore this version' })`
- Share button: `getByRole('button', { name: /share/i })`
- Share link card: `getByTestId('share-link-card')`
- Revoke button: `getByRole('button', { name: /revoke/i })`
- Logout button: `getByRole('button', { name: 'Logout' })`

Timing strategy (no raw `page.waitForTimeout`):
- After autosave pause: `await expect(page.getByText('Saved')).toBeVisible({ timeout: 10_000 })`
- After search debounce: wait for result card to appear (`toBeVisible`)
- After share generate: wait for toast text (`toBeVisible`)
- After restore: wait for toast `Restored version 1` (`toBeVisible`)

Unique email: `const email = \`test-${Date.now()}@example.com\``

### `scripts/check-e2e-coverage.mjs`

Algorithm:
1. Read `docs/FRS.md` as text
2. Extract all `FR-[A-Z0-9-]+\d` identifiers via regex → unique set
3. Read `apps/web/e2e/journey.spec.ts` as text
4. For each FR identifier, check if it appears in the journey spec
5. Collect uncovered identifiers
6. If any uncovered: print them, `process.exit(1)`
7. Else: print "All FRs covered", `process.exit(0)`

The script reads FRS.md dynamically, so any new FR added in a future ticket is automatically included in the check without modifying the script.

Root path resolution: use `import.meta.url` + `path.resolve` to build absolute paths to docs/FRS.md and apps/web/e2e/journey.spec.ts from the repo root.

### `apps/web/playwright.config.ts` change

```diff
-  testMatch: '**/*.e2e.ts',
+  testMatch: '**/*.{e2e,spec}.ts',
```

### Root `package.json` change

```diff
   "scripts": {
     "build": "pnpm -r run build",
     "dev": "pnpm -r --parallel run dev",
+    "coverage:e2e": "node scripts/check-e2e-coverage.mjs",
     "test": "vitest",
```

## Risk Areas

| Risk | Mitigation |
|------|-----------|
| Clipboard blocked in headless Chromium | `page.addInitScript()` overrides `navigator.clipboard.writeText` before first navigation; mock persists across SPA navigations |
| Autosave 2 s debounce + network RTT | Use `toBeVisible({ timeout: 10_000 })` on the "Saved" text instead of any fixed sleep |
| Tag combobox: popover must be open before typing | Click "Add tag" button first; then `fill()` the `CommandInput`; then `press('Enter')` |
| Step 9 version count: drawer must open after autosave completes | Wait for "Saved" indicator before opening drawer; then assert `version-list-item` count ≥ 2 |
| History button selector ambiguity | `EditorToolbar` renders the History button with `aria-label` — use `getByRole('button', { name: /history/i })` |
| Share modal clipboard fallback input | The modal shows a fallback Input if clipboard fails; the mock prevents this branch — assert toast text instead |
| `journey.spec.ts` not picked up by Playwright | Fixed by updating `testMatch` to `**/*.{e2e,spec}.ts` in playwright.config.ts |
| Coverage script path resolution on Windows | Use `fileURLToPath(import.meta.url)` + `path.join` with forward slashes; `fs.readFileSync` handles both separators |

## Test Strategy

| Scenario | Test file | How validated |
|----------|-----------|--------------|
| E2E-S1..S11 | `apps/web/e2e/journey.spec.ts` | `pnpm test:e2e` from `apps/web` |
| E2E-COV-S1 | `scripts/check-e2e-coverage.mjs` | `pnpm coverage:e2e` from repo root |

No Vitest unit tests are added — this ticket is exclusively Playwright + the coverage script. The tester agent's role is to verify the spec file compiles and runs green, not to write additional unit tests.

## Task Breakdown (for /tasks)

1. Update `apps/web/playwright.config.ts` — change testMatch
2. Create `apps/web/e2e/journey.spec.ts` — steps E2E-S1..S11
3. Create `scripts/check-e2e-coverage.mjs` — FR coverage assertion
4. Update root `package.json` — add coverage:e2e script
