# Skill: Playwright E2E Spec (apps/web/e2e)

## File structure
- One spec file per major journey: `apps/web/e2e/journey.spec.ts`, `apps/web/e2e/auth.spec.ts`
- Page object pattern: `apps/web/e2e/pages/<Name>Page.ts` for repeated selectors

## Conventions
- Test names include scenario IDs from spec.md: `test('E2E-S1: register through logout', ...)`
- Use `page.getByRole`, `page.getByLabel` — NOT `page.locator('.some-class')`
- Wait with `await expect(...).toBeVisible()`, not `page.waitForTimeout(...)`
- Each test starts from a fresh state — use `test.beforeEach` to log in or seed

## Setup
- Local dev server must be running (pnpm --filter @app/web dev)
- Backend must be running (pnpm --filter @app/api dev)
- Use a test database (DATABASE_URL_TEST in .env.test)

## FR coverage assertions (FR-E2E-2)
- Each step tags the FR-* it covers in a comment:
    // covers FR-AUTH-2, FR-UI-AUTH-2
    await loginPage.submit({ email, password });
- The coverage script at the end of FR-E2E-2 parses these comments

## Gotchas
- Don't rely on auto-waiting for navigation; use `await page.waitForURL(...)` explicitly
- Don't share state between tests via module-level variables; use fixtures
- Run in headed mode (`pnpm playwright test --headed`) when debugging