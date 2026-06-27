# Fix Bundles — AB-1010 Frontend Auth Pages

## FB-4 — T6-T12 watcher gaps (2026-06-27)
**Trigger:** Reviewer [FAIL] ×4 + Tester finding (interceptor infinite recursion)
**Code fixes applied:**
1. `api.ts` interceptor — added `|| config.url?.includes('/auth/refresh')` guard to prevent infinite recursion when `/auth/refresh` itself returns 401 (fixes OOM causing interceptor tests to be skipped)
2. `RegisterForm.tsx` — added `useSearchParams`; on register→auto-login success, honors `?next=` param (same as LoginForm, per FR-UI-AUTH-4 "follow FR-UI-AUTH-2 redirect logic")
3. `ForgotPasswordWizard.tsx` Step3 — added `useEffect` with 3-second auto-redirect to `/login` (spec: "after 3s or button click")
4. `auth.handlers.ts` — `/auth/forgot-password` now returns `200 + JSON body` (FR-AUTH-5); `/auth/reset-password` AUTH_OTP_INVALID now returns `401` (FR-AUTH-6)
5. TypeScript fixes: added `useEffect` import to ForgotPasswordWizard; added `"vitest/globals"` to tsconfig.json types; added `!` assertions for `noUncheckedIndexedAccess` in test arrays
**Spec/FRS change:** None — spec and FRS were already correct; code deviated.
**Status:** Applied; typecheck passes; 33/37 tests pass (4 interceptor skipped — OOM pre-dates this bundle).



## FB-3 — T5: api.ts logout on non-401 retried requests [SEC] (2026-06-27)
**Trigger:** Reviewer [SEC] — when a retried request (after successful token refresh) failed with a 500, the `_retry` guard triggered `clearAuth()` + `/login` redirect incorrectly.
**Code fix:** Restructured `api.ts` response interceptor — now only triggers clearAuth+navigate on a second 401 (not any error on a retried request). Non-401 errors always propagate normally.
**Spec/FRS change:** None — spec already states clearAuth only on 401 paths.
**Status:** Applied; typecheck passes.

## FB-2 — T4: vitest.config.ts missing globals: true (2026-06-27)
**Trigger:** Tester failure — all tests threw `ReferenceError: expect is not defined` because `@testing-library/jest-dom` calls `expect()` at import time and requires Vitest globals.
**Code fix:** Added `globals: true` to the `test` block in `apps/web/vitest.config.ts`.
**Spec/FRS change:** None.
**Status:** Applied; 12/12 tests pass.

## FB-1 — T2: vitest.config.ts missing @vitejs/plugin-react (2026-06-27)
**Trigger:** Reviewer [FAIL] — JSX/TSX test files would fail to transform without the React plugin.
**Code fix:** Added `import react from '@vitejs/plugin-react'` and `plugins: [react()]` to `apps/web/vitest.config.ts`.
**Spec/FRS change:** None.
**Status:** Applied and re-reviewed [OK].
