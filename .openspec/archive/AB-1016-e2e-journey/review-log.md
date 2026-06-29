# Review Log — AB-1016 E2E Journey

## TASK-1 Review — 2026-06-29

Audited: `apps/web/playwright.config.ts` — testMatch change for AB-1016 TASK-1.

[OK] Check 1: testMatch is `'**/*.{e2e,spec}.ts'` -- git diff confirms exactly `-testMatch: '**/*.e2e.ts'` replaced by `+testMatch: '**/*.{e2e,spec}.ts'`; current file line 5 matches expected value.

[OK] Check 2: `testDir: './e2e'` is present and unchanged -- line 4 of current file reads `testDir: './e2e'`; smoke.e2e.ts at `apps/web/e2e/smoke.e2e.ts` remains discoverable because `*.e2e.ts` matches the `{e2e,spec}` alternation and testDir is unchanged.

[OK] Check 3: `projects` array still contains only the chromium entry -- `{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }` is the sole entry; no additional browsers added; satisfies spec decision 2 ("Chromium only").

[OK] Check 4: No other config changes beyond testMatch -- `git diff HEAD apps/web/playwright.config.ts` shows exactly one hunk with one changed line (testMatch); all other fields (fullyParallel, forbidOnly, retries, workers, reporter, use.baseURL, use.trace, webServer) are byte-for-byte identical to the initial scaffold commit 9c29258.

## TASK-2/3/4 Review — 2026-06-29

Audited: `apps/web/e2e/journey.spec.ts`, `scripts/check-e2e-coverage.mjs`, root `package.json`.
Source truth: `docs/FRS.md` (FR-E2E-1, FR-E2E-2), `.openspec/changes/AB-1016-e2e-journey/spec.md`.

### journey.spec.ts

[OK] Single `test()` block -- line 4: `test('E2E-S1..S11: full user journey', async ({ page }) => {`; no additional top-level `test()` calls in the file; satisfies spec Decision 3 ("Single test() block").

[OK] 11 `test.step()` calls, one per E2E-S1..S11 -- grep confirms exactly 11 `await test.step(` calls at lines 27, 37, 44, 53, 66, 73, 82, 98, 106, 117, 128; labels match scenario IDs E2E-S1 through E2E-S11.

[OK] Clipboard mock via `page.addInitScript()` before first `page.goto()` -- `page.addInitScript()` executes at lines 10-25; first `page.goto('/register')` is at line 29 inside E2E-S1 step; satisfies spec Decision 4 ("must be called before the first page.goto() so it persists across all SPA navigations").

[OK] Unique email using `Date.now()` -- line 5: `const email = \`test-${Date.now()}@example.com\``; satisfies spec Decision 1.

[OK] No `page.waitForTimeout()` calls -- grep finds zero matches in the file; timing uses `toBeVisible({ timeout })` and `waitForURL()` throughout.

[OK] FR-E2E-2 referenced in the file -- line 1: `// FR-E2E-2: coverage assertion — run \`pnpm coverage:e2e\` after this spec to verify all FRs are tagged.`

[OK] All 11 test.step Validates comments match spec.md exactly -- each step's inline comment lists the same FR-* identifiers as the corresponding E2E-S* scenario's "Validates:" line in spec.md (verified for all 11 steps).

[WARN] E2E-S2: editor focus not asserted -- spec.md E2E-S2 states "Then I am on /notes/new and the TipTap editor content-area is **focused**"; implementation only asserts `await expect(page.locator('.ProseMirror')).toBeVisible({ timeout: 5_000 })` (visibility, not focus); a `toHaveFocus()` or `toBeFocused()` assertion on `.ProseMirror` would satisfy the scenario text.

[WARN] E2E-S7: clipboard assertion weaker than scenario requires -- spec.md E2E-S7 states "the clipboard mock captured **a URL containing the share token**"; implementation: `expect(clipData).toBeTruthy()` only checks the value is non-empty; URL shape and share token presence are not verified.

[WARN] E2E-S8: greyed-out styling not asserted -- spec.md E2E-S8 states "the link card shows a 'Revoked' badge **and has greyed-out styling**"; implementation only checks `await expect(page.getByText('Revoked')).toBeVisible()`; no CSS class / opacity assertion for the grey-out state.

[WARN] E2E-S10: restore toast version number not pinned -- spec.md journey step 10 expects toast text "Restored version 1"; implementation uses regex `/Restored version/` which matches any version number; `getByText('Restored version 1')` would be more precise.

### check-e2e-coverage.mjs

[OK] Reads spec.md Validates: lines to build FR list -- lines 23-31 match `**Validates:.*$` against spec.md text and extract FR-* identifiers; does not read FRS.md directly; aligns with audit checklist requirement.

[OK] Checks each FR appears in journey.spec.ts -- lines 39-43 iterate `specFRs` and call `journeyText.includes(fr)`; every FR identifier found in Validates: lines is verified against the journey file.

[OK] Exits 0 with "All FRs covered" when fully covered -- line 56: `console.log(\`All FRs covered (${specFRs.size} total)\`)` followed by `process.exit(0)`.

[OK] Exits 1 with list of uncovered FRs -- lines 48-54: logs each uncovered FR with `console.error` and calls `process.exit(1)`.

[OK] Handles missing journey.spec.ts gracefully -- lines 12-16: `if (!existsSync(JOURNEY_PATH))` prints a descriptive error and calls `process.exit(1)` before attempting any read.

[OK] Uses `import.meta.url` + `fileURLToPath` for Windows-safe path resolution -- line 5: `const __dirname = dirname(fileURLToPath(import.meta.url))`; satisfies MEMORY note on Windows alias paths.

[WARN] Script filename differs from spec Decision 5 -- spec.md Decision 5 states "scripts/check-e2e-coverage**.ts**"; delivered file is `scripts/check-e2e-coverage**.mjs**`; spec text is not updated to reflect the plain-JS module choice.

[WARN] FR-E2E-2 scope drift -- FRS.md FR-E2E-2 Behavior: "verifies **every backend FR-* and frontend FR-UI-*** has at least one assertion"; implementation only checks FRs referenced in spec.md Validates: lines (a curated subset); FRs present in FRS.md but absent from any E2E Validates: line are not checked by the script. This is intentional per the audit brief's PRIMARY check definition but is a narrowing of the FRS text.

### package.json (root)

[OK] `coverage:e2e` script present with correct value -- line 11: `"coverage:e2e": "node scripts/check-e2e-coverage.mjs"`; satisfies E2E-COV-S1 run command.
