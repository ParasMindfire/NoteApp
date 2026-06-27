# Review Log — AB-1010 Frontend Auth Pages

## T1 — Package install (2026-06-27)

FR-INFRA-11: "All tool versions pinned in package.json (no ^, ~, or @latest)"

### New packages (T1 scope — 10 deps + 4 devDeps)

[OK] FR-INFRA-11 — @hookform/resolvers pinned at 3.9.1 (no range prefix)
[OK] FR-INFRA-11 — @radix-ui/react-label pinned at 2.1.0 (no range prefix)
[OK] FR-INFRA-11 — @radix-ui/react-slot pinned at 1.1.0 (no range prefix)
[OK] FR-INFRA-11 — class-variance-authority pinned at 0.7.1 (no range prefix)
[OK] FR-INFRA-11 — clsx pinned at 2.1.1 (no range prefix)
[OK] FR-INFRA-11 — react-hook-form pinned at 7.54.0 (no range prefix)
[OK] FR-INFRA-11 — react-router-dom pinned at 6.26.2 (no range prefix)
[OK] FR-INFRA-11 — sonner pinned at 1.5.0 (no range prefix)
[OK] FR-INFRA-11 — tailwind-merge pinned at 2.5.5 (no range prefix)
[OK] FR-INFRA-11 — axios pinned at 1.7.7 (no range prefix)
[OK] FR-INFRA-11 — tailwindcss (devDep) pinned at 3.4.13 (no range prefix)
[OK] FR-INFRA-11 — autoprefixer (devDep) pinned at 10.4.20 (no range prefix)
[OK] FR-INFRA-11 — postcss (devDep) pinned at 8.4.49 (no range prefix)
[OK] FR-INFRA-11 — @types/node (devDep) pinned at 22.7.4 (no range prefix)

### Pre-existing packages (unchanged; verified no drift)

[OK] FR-INFRA-11 — react pinned at 19.1.0
[OK] FR-INFRA-11 — react-dom pinned at 19.1.0
[OK] FR-INFRA-11 — @tanstack/react-query pinned at 5.101.1
[OK] FR-INFRA-11 — @tiptap/react pinned at 2.11.7
[OK] FR-INFRA-11 — @tiptap/starter-kit pinned at 2.11.7
[OK] FR-INFRA-11 — zod pinned at 3.25.56
[OK] FR-INFRA-11 — zustand pinned at 5.0.5
[OK] FR-INFRA-11 — dompurify pinned at 3.2.6
[OK] FR-INFRA-11 — lucide-react pinned at 0.511.0
[OK] FR-INFRA-11 — date-fns pinned at 3.6.0
[OK] FR-INFRA-11 — @playwright/test (devDep) pinned at 1.61.1
[OK] FR-INFRA-11 — @testing-library/jest-dom (devDep) pinned at 6.6.3
[OK] FR-INFRA-11 — @testing-library/react (devDep) pinned at 16.3.0
[OK] FR-INFRA-11 — @testing-library/user-event (devDep) pinned at 14.6.1
[OK] FR-INFRA-11 — @types/dompurify (devDep) pinned at 3.0.5
[OK] FR-INFRA-11 — @types/react (devDep) pinned at 19.1.5
[OK] FR-INFRA-11 — @types/react-dom (devDep) pinned at 19.1.5
[OK] FR-INFRA-11 — @vitejs/plugin-react (devDep) pinned at 4.5.0
[OK] FR-INFRA-11 — @vitest/coverage-v8 (devDep) pinned at 4.1.9
[OK] FR-INFRA-11 — jsdom (devDep) pinned at 26.1.0
[OK] FR-INFRA-11 — msw (devDep) pinned at 2.14.6
[OK] FR-INFRA-11 — vite (devDep) pinned at 6.3.5
[OK] FR-INFRA-11 — vitest (devDep) pinned at 4.1.9

### Summary

37 packages checked. 0 FAIL. 0 WARN. All versions are bare exact strings with no ^, ~, or @latest.

## T2+T3 — Config + lib (2026-06-27)

### T2 — tailwind.config.js

[OK] FR-UI-AUTH-1 (shadcn/ui components) — tailwind.config.js content paths cover both `./index.html` and `./src/**/*.{ts,tsx}` as required for all future UI components
[OK] FR-UI-AUTH-1 — shadcn/ui CSS variable color tokens present in theme.extend.colors: border, input, ring, background, foreground, primary, destructive, muted, accent, card (all required for shadcn/ui component rendering)
[OK] FR-UI-AUTH-1 — borderRadius tokens (lg, md, sm) mapped to `--radius` CSS variable, as expected by shadcn/ui
[OK] FR-INFRA-4 — plugins array is present (empty is valid; no shadcn/ui Tailwind plugin is required by FRS)

### T2 — postcss.config.js

[OK] FR-UI-AUTH-1 — PostCSS config exports both `tailwindcss` and `autoprefixer` plugins, satisfying the requirement for Tailwind to process in Vite

### T2 — index.css

[OK] FR-UI-AUTH-1 — All three @tailwind directives present: `@tailwind base`, `@tailwind components`, `@tailwind utilities`
[OK] FR-UI-AUTH-1 — CSS variable tokens for shadcn/ui theming declared inside `@layer base :root {}`: --background, --foreground, --card, --card-foreground, --primary, --primary-foreground, --destructive, --destructive-foreground, --muted, --muted-foreground, --accent, --accent-foreground, --border, --input, --ring, --radius all present
[WARN] FR-UI-AUTH-1 — No `.dark {}` CSS variable block is present in index.css. shadcn/ui conventionally ships dark-mode variable overrides under `.dark`. FRS does not explicitly require dark mode for AB-1010, but the absence of a `.dark` block means dark mode is unsupported at the CSS layer; any future dark-mode ticket will require a retroactive change to index.css

### T2 — vite.config.ts

[OK] FR-INFRA-4 (Vite build) — `@` alias correctly resolves to `path.resolve(__dirname, 'src')`, making `@/` imports resolve to the `src/` directory

### T2 — tsconfig.json

[OK] FR-INFRA-2 (TypeScript strict mode) — tsconfig.json extends `../../tsconfig.base.json`; strict mode is inherited from the base config (verified by FR-INFRA-2 acceptance in T1 audit)
[OK] FR-INFRA-4 — `paths` entry `"@/*": ["./src/*"]` aligns with the vite.config.ts alias; TypeScript and Vite will agree on `@/` resolution
[OK] FR-INFRA-4 — `jsx: "react-jsx"` set, enabling automatic JSX transform

### T2 — vitest.config.ts

[OK] FR-INFRA-4 — `@` alias resolves to `path.resolve(__dirname, 'src')` — consistent with vite.config.ts and tsconfig.json
[OK] FR-INFRA-4 — `environment: 'jsdom'` set, required for React component tests
[OK] FR-INFRA-4 — `setupFiles: ['./src/test-setup.ts']` references the setup file that imports `@testing-library/jest-dom`
[OK] FR-INFRA-4 — coverage thresholds set at 80% for lines, functions, branches, statements (matches ≥80% definition of done)
[FAIL] FR-INFRA-4 — `apps/web/vitest.config.ts` uses `defineConfig` imported from `vitest/config` and does NOT include `@vitejs/plugin-react`. The workspace file (`vitest.workspace.ts`) references `apps/web/vitest.config.ts` directly, so there is no Vite config merging. Without the React plugin, Vitest cannot transform JSX/TSX syntax in test files; any component test that imports a `.tsx` file will fail with a parse error at runtime. FRS states: "FR-INFRA-4: Vitest configured at root with workspace overrides for apps/api and apps/web [AB-1001]". The workspace override for apps/web is missing the React plugin that makes JSX tests executable. Observed: `import { defineConfig } from 'vitest/config';` with no `plugins` key. Required: `import react from '@vitejs/plugin-react'; ... plugins: [react()]` (or import from `vite/config` to inherit the Vite config plugins).

### T3 — utils.ts

[OK] FR-UI-AUTH-1 — `cn()` utility using `clsx` + `tailwind-merge` is present; this is the standard shadcn/ui helper required for all component class merging

### T3 — queryClient.ts

[OK] spec.md (TanStack Query) — `queryClient` is instantiated at module level as a module-scoped singleton constant (`export const queryClient = new QueryClient(...)`); it will not be re-created on every render. This satisfies the singleton pattern required by spec.md § TanStack Query.
[OK] FR-UI-AUTH-6 — `queryClient.clear()` can be called on this exported singleton from the Logout button, as required by FR-UI-AUTH-6 behavior

### T3 — errorMessages.ts

[OK] FR-UI-AUTH-3 — `AUTH_INVALID_CREDENTIALS` key present with value `'Invalid email or password'`, matching spec.md § Error code → user message mappings exactly
[OK] FR-UI-AUTH-4 — `USER_EXISTS` key present with value `'Account already exists. Try logging in.'`, matching spec.md exactly
[OK] FR-UI-AUTH-5 — `AUTH_OTP_INVALID` key present with value `'Invalid or expired code. Please try again.'`, matching spec.md exactly
[OK] FR-UI-AUTH-3 — `VALIDATION_FAILED` key present with value `'Please check your input and try again.'`, matching spec.md exactly
[OK] FR-UI-AUTH-3 — `RATE_LIMITED` key present with value `'Too many attempts. Please wait a moment.'`, matching spec.md exactly
[OK] UX.md § Error States — fallback message `'Something went wrong. Please try again.'` returned by `getErrorMessage()` when code is undefined or unmapped, satisfying the fallback row in spec.md
[OK] FR-UI-AUTH-3 — `getErrorMessage()` maps by `error.code` (not `error.detail`), satisfying UX.md "Never display raw error.detail to the user. Map by error.code."
[OK] FR-UI-AUTH-2 — Extra codes `AUTH_REFRESH_INVALID` and `AUTH_TOKEN_INVALID` are present but not listed in spec.md's table; these are additive and cover the 401 interceptor paths — not a spec violation

### T3 — navigation.ts

[OK] FR-UI-AUTH-2 (401 interceptor) — `_navigate` variable is typed as `NavigateFunction | null`, with initial value `null`; callers must null-check before invoking, which prevents type errors in the interceptor
[OK] FR-UI-AUTH-2 — `setNavigate(fn: NavigateFunction)` and `getNavigate(): NavigateFunction | null` provide a module-level imperative navigation handle, as required by the Axios 401 interceptor that cannot access React hooks

### Summary

T2: 1 FAIL (vitest.config.ts missing react plugin), 1 WARN (no .dark CSS variable block)
T3: 0 FAIL, 0 WARN — all required error codes present, singleton queryClient, correct navigation typing

## T2 fix-bundle re-review (2026-06-27)

Re-audit scope: `apps/web/vitest.config.ts` only — confirming the fix for the [FAIL] found in the T2+T3 review.

[OK] Fix check 1 — `@vitejs/plugin-react` is imported on line 2 (`import react from '@vitejs/plugin-react'`) and `react()` is passed in `plugins: [react()]` on line 6. The previously missing React plugin is now present.

[OK] Fix check 2 — `resolve.alias` for `@` is still present: `'@': path.resolve(__dirname, 'src')` on lines 7-10. No regression.

[OK] Fix check 3 — All `test` options are still present and unchanged:
  - `environment: 'jsdom'` (line 13)
  - `setupFiles: ['./src/test-setup.ts']` (line 14)
  - `exclude: ['**/node_modules/**', '**/dist/**']` (line 15)
  - coverage thresholds at 80% for lines, functions, branches, statements (lines 16-24)

### Summary

3 checks performed. 0 FAIL. 0 WARN. The fix-bundle resolved the previously reported [FAIL] without introducing any regressions. `apps/web/vitest.config.ts` is now fully compliant with FR-INFRA-4.

## T4 — Stores + hook (2026-06-27)

### authStore.ts (`apps/web/src/stores/authStore.ts`)

[OK] FR-UI-AUTH-2 sub-bullet "accessToken stored in Zustand only — no persistence middleware" — `import { create } from 'zustand'` only; no `persist` import from `zustand/middleware` anywhere in the file. No persistence wrapper applied to the store.

[OK] UX.md § Tokens "Access token: kept in memory in a Zustand store; never localStorage" — confirmed: no `persist` middleware, no `localStorage.setItem`, no `sessionStorage` usage. Token lives only in the Zustand in-memory store.

[OK] FR-UI-AUTH-2 sub-bullet "clearAuth sets both accessToken AND user to null (complete cleanup)" — line 19: `clearAuth: () => set({ accessToken: null, user: null })` sets both fields to null in a single atomic set call.

[OK] spec.md § State Management "clearAuth does NOT call queryClient directly (caller's responsibility)" — `clearAuth` implementation on line 19 calls only `set({ accessToken: null, user: null })`; no `queryClient` import or call anywhere in the file. The caller (Logout button) is responsible for calling `queryClient.clear()` separately, which matches spec.md's stated intent.

[OK] Zustand v5 API double-call pattern — line 15: `export const useAuthStore = create<AuthState>()((set) => ({...}))`. Type parameter passed to `create<AuthState>()` and then the store factory `(set) => (...)` is a second call. This is the correct curried Zustand v5 TypeScript pattern.

### forgotPasswordStore.ts (`apps/web/src/stores/forgotPasswordStore.ts`)

[OK] FR-UI-AUTH-5 sub-bullet "step type is 1 | 2 | 3 (not plain number)" — interface at line 4: `step: 1 | 2 | 3;` is a literal union type, not `number`. Initial value `step: 1` satisfies the type, and the `advance` cast `as 1 | 2 | 3` preserves it through arithmetic.

[OK] FR-UI-AUTH-5 sub-bullet "advance() caps at step 3 (no overflow to 4)" — line 15-18: `set((state) => ({ step: state.step < 3 ? ((state.step + 1) as 1 | 2 | 3) : 3 }))`. When `state.step === 3`, the ternary short-circuits to `3`; calling `advance()` on step 3 keeps step at 3. No overflow to 4 is possible.

[OK] FR-UI-AUTH-5 sub-bullet "reset() is idempotent — calling it twice has same effect as once" — line 19: `reset: () => set({ step: 1, email: '' })`. This sets `step` to `1` and `email` to `''` unconditionally. Calling it a second time produces the identical state transition (setting already-1 step to 1, empty string to empty string). The operation is referentially idempotent and safe under React StrictMode double-invoke.

### useMinDuration.ts (`apps/web/src/hooks/useMinDuration.ts`)

[OK] FR-UI-AUTH-7 sub-bullet "hook ensures spinner shows for >=200ms minimum — logic must delay the false transition, not the true transition" — when `isPending` becomes `true` (lines 12-17): `setIsVisible(true)` is called immediately with no timer delay. When `isPending` becomes `false` (lines 18-21): `setIsVisible(false)` is scheduled via `setTimeout(..., ms)` where `ms` defaults to `200`. The `true` transition is instant; the `false` transition is delayed. This is the correct anti-flicker pattern.

[OK] FR-UI-AUTH-7 sub-bullet "timer cleanup in useEffect return (prevents memory leak / setState after unmount)" — lines 24-27: the useEffect return function checks `if (timerRef.current)` and calls `clearTimeout(timerRef.current)`. This fires on every re-render (cleaning up the previous effect's timer) and on unmount, preventing a stale setState call after the component is gone.

[OK] FR-UI-AUTH-7 sub-bullet "Correct use of useRef for timer (not state, to avoid extra renders)" — line 9: `const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`. The timer handle is stored in a ref (not `useState`), so updating it does not trigger a re-render. Only `isVisible` (which drives the UI) is in state.

### Coverage checks

[COVERAGE] FR-UI-AUTH-2 has no named test verifying that `localStorage` is never written when `setAuth` is called. FRS states: "localStorage never set with token (verified by test)". No test file in the T4 scope contains an assertion like `expect(localStorage.getItem(...)).toBeNull()` or `expect(localStorage.setItem).not.toHaveBeenCalled()` for the authStore.

[COVERAGE] FR-UI-AUTH-5 has no named test for `advance()` boundary — specifically that calling `advance()` when `step === 3` keeps step at `3` (no overflow). The cap logic exists in code but no test verifies the boundary condition.

[COVERAGE] FR-UI-AUTH-7 has no named test verifying the >=200ms minimum display duration of `useMinDuration`. Scenario UI-AUTH-LOADING-S1 requires this behavior to be tested.

### Summary

3 files audited. 0 FAIL. 0 WARN. 3 COVERAGE gaps noted. All FRS sub-bullets for authStore, forgotPasswordStore, and useMinDuration are satisfied by the implementation.

## T5 — Axios interceptors (2026-06-27)

### File audited: `apps/web/src/lib/api.ts`

**FR-UI-AUTH-2 / spec.md § Axios Instance**

[OK] FR-UI-AUTH-2 sub-bullet "baseURL reads from `import.meta.env.VITE_API_URL` with fallback to `http://localhost:4000`" -- line 10: `baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000'`. Nullish coalescing correctly applies the fallback only when the env var is undefined or null.

[OK] FR-UI-AUTH-2 sub-bullet "`withCredentials: true` set (ensures httpOnly refresh cookie is sent)" -- line 11: `withCredentials: true` is set in the `axios.create({...})` options, meaning every request on the `api` instance carries credentials.

[OK] FR-UI-AUTH-2 sub-bullet "Request interceptor injects `Authorization: Bearer <token>` from `useAuthStore.getState().accessToken`" -- lines 14-19: request interceptor calls `useAuthStore.getState().accessToken` (static `.getState()` call, correct outside React components) and injects `config.headers.Authorization = \`Bearer ${token}\`` on line 17.

[OK] FR-UI-AUTH-2 sub-bullet "No token → no Authorization header (guard present)" -- lines 15-18: assignment is inside `if (token) { ... }`. When `accessToken` is null the block is skipped and no Authorization header is added.

**UI-AUTH-INTERCEPTOR-S1 (401 retry)**

[OK] UI-AUTH-INTERCEPTOR-S1 sub-bullet "On 401: sets `_retry = true` before calling refresh (loop guard)" -- line 35: `config._retry = true` is set before `await api.post('/auth/refresh')`.

[OK] UI-AUTH-INTERCEPTOR-S1 sub-bullet "If `_retry` is already true when a 401 arrives → does NOT retry again (infinite loop prevented)" -- line 27: `if (error.response?.status !== 401 || config._retry)` short-circuits into the clearAuth/navigate block when _retry is already true.

[OK] UI-AUTH-INTERCEPTOR-S1 sub-bullet "On refresh success: calls `setAuth(newToken, currentUser)` + retries original request" -- lines 39-41: `useAuthStore.getState().setAuth(data.accessToken, currentUser)` called; line 46: `return api(config)` retries the original request.

[WARN] UI-AUTH-INTERCEPTOR-S1 sub-bullet "Retried request uses new token (header updated)" -- lines 43-45: `if (config.headers) { config.headers.Authorization = \`Bearer ${data.accessToken}\` }` updates the config object. The request interceptor also re-runs on the retry via the same `api` instance, providing a safety net. However, the `if (config.headers)` guard is unnecessarily conditional — if config.headers were falsy the explicit update would be silently skipped. In practice Axios always initializes headers so this does not cause a bug, but the conditional weakens the explicit update path without benefit.

**UI-AUTH-INTERCEPTOR-S2 (refresh failure)**

[OK] UI-AUTH-INTERCEPTOR-S2 sub-bullet "On refresh failure OR on second 401 (retry path): calls `clearAuth()`" -- clearAuth() is called in both paths: second-401 path (lines 28-30) and the catch block (line 48).

[OK] UI-AUTH-INTERCEPTOR-S2 sub-bullet "Calls `getNavigate()?.('/login')` — safe optional chain" -- line 30 and line 49 both use `getNavigate()?.('/login')` with the optional chain.

**Security checks**

[SEC] The `_retry` guard condition at line 27-32 clears auth and redirects to /login for ANY error on a retried request, not only a second 401. Observed code: `if (error.response?.status !== 401 || config._retry) { if (config._retry) { clearAuth(); navigate('/login'); } }`. If the retried request (after a successful token refresh) fails with a 500 or network error, `config._retry` is true, so the inner block fires, incorrectly forcing logout. FRS spec.md states: "On refresh failure: call `authStore.clearAuth()`, navigate to `/login`" and "On 401 retry also fails" — the intent is auth-failure-only logout, not generic-error-on-retry logout. A 500 on the retried request is not an authentication failure and should be propagated as a normal error, not trigger a forced logout.

[OK] SEC sub-bullet "Does the interceptor log or expose the raw token?" -- no `console.log`, `console.error`, or any logging of the token appears anywhere in `api.ts`.

[OK] SEC sub-bullet "Refresh endpoint called with `withCredentials: true`" -- line 38: `await api.post('/auth/refresh')` uses the same `api` instance created with `withCredentials: true`; the httpOnly cookie is sent automatically on this call.

**Coverage checks**

[COVERAGE] UI-AUTH-INTERCEPTOR-S1 has no test. `apps/web/src/__tests__/lib/` is empty; no test file exists for `api.ts`. Scenario UI-AUTH-INTERCEPTOR-S1 ("silent token refresh on 401") has no corresponding named test verifying that a 401 triggers a refresh call and the original request is retried with the new token.

[COVERAGE] UI-AUTH-INTERCEPTOR-S2 has no test. Scenario UI-AUTH-INTERCEPTOR-S2 ("refresh failure redirects to /login") has no corresponding named test verifying that `clearAuth()` is called and `getNavigate()` is invoked with `/login` when the refresh endpoint itself fails.

### Summary

2 OK (Axios instance config), 4 OK (interceptor S1), 2 OK (interceptor S2), 2 OK (security), 1 WARN, 1 SEC, 2 COVERAGE gaps.

## 2026-06-27T00:00:00Z -- Task T6-T12

---

### T6 -- shadcn/ui components

#### button.tsx

[OK] FR-UI-AUTH-7 sub-bullet Button label replaced with Spinner -- isLoading prop shows Loader2 animate-spin in place of children (button.tsx line 50). Spinner has aria-hidden; screen readers do not announce it.
[OK] FR-UI-AUTH-7 sub-bullet Button width preserved no layout shift -- inline-flex plus fixed size variants (h-10 px-4 py-2) keep button dimensions stable when label swaps to spinner.
[OK] FR-UI-AUTH-1 sub-bullet cva variants -- buttonVariants uses class-variance-authority with variant (default, destructive, outline, ghost) and size (default, sm, lg, icon); @radix-ui/react-slot Slot used for asChild pattern.
[OK] FR-UI-AUTH-1 sub-bullet Accessibility disabled state -- disabled and aria-disabled both set to (disabled || isLoading) on lines 46-47, preventing double-submission and announcing disabled state.
[OK] UX.md Accessibility Focus ring visible -- focus-visible:ring-2 focus-visible:ring-ring present in base class string; default outline not overridden without alternative.

#### input.tsx

[OK] FR-UI-AUTH-1 sub-bullet aria-invalid:border-destructive -- input.tsx line 12: aria-[invalid=true]:border-destructive and aria-[invalid=true]:ring-destructive applied via Tailwind aria variant. Red border appears when aria-invalid=true is set.
[OK] FR-UI-AUTH-1 sub-bullet forwardRef -- React.forwardRef wraps the Input component; ref passed to underlying input element.
[OK] UX.md Form Patterns Inline errors red border on input -- aria-[invalid=true]:border-destructive satisfies the input bordered red requirement.

#### label.tsx

[OK] FR-UI-AUTH-1 sub-bullet @radix-ui/react-label -- label uses LabelPrimitive.Root; htmlFor forwarded through ComponentPropsWithoutRef enabling proper label-input association.

#### form.tsx

[OK] FR-UI-AUTH-1 sub-bullet FormField/FormItem/FormLabel/FormControl/FormMessage -- all four named exports present and wired to react-hook-form Context. FormControl sets aria-describedby and aria-invalid on lines 95-96, triggering Input aria-[invalid=true] Tailwind variant.
[OK] FR-UI-AUTH-1 sub-bullet Inline error below field -- FormMessage renders p.text-destructive with the error string (line 114), satisfying UX.md red text below field.
[OK] UX.md Accessibility Form fields have label -- FormLabel sets htmlFor={formItemId} (line 79); FormControl has id={formItemId} (line 94); correct label-input association.

---

### T7 -- Layout + routing

#### NavigationSetter.tsx

[WARN] FR-UI-AUTH-2 sub-bullet imperative navigation handle for Axios interceptor -- NavigationSetter cleanup function (line 10) calls setNavigate(navigate) instead of clearing the reference. On unmount this re-assigns rather than nulls the singleton. AppLayout persists for the session lifetime so unlikely to cause stale-closure bugs in practice, but cleanup semantics are incorrect.

#### PrivateRoute.tsx

[OK] FR-UI-AUTH-2 sub-bullet PrivateRoute redirects to /login when no token -- if (!accessToken) guard with Navigate to /login?next= encoded-path replace (lines 12-18) matches spec.md Decision 6 exactly.
[OK] UX.md Navigation Protected routes redirect to /login if no access token -- satisfied.
[OK] spec.md Router Setup Public routes redirect to /notes if already authenticated -- LoginPage and RegisterPage both check accessToken and render Navigate to /notes replace if truthy.

#### AppHeader.tsx

[OK] FR-UI-AUTH-6 sub-bullet POST /auth/logout with current refresh token -- api.post(/auth/logout) called with withCredentials:true from api instance config, sending the httpOnly refresh cookie automatically.
[OK] FR-UI-AUTH-6 sub-bullet Clear access token from Zustand -- clearAuth() called on line 24.
[OK] FR-UI-AUTH-6 sub-bullet Clear all TanStack Query cache queryClient.clear() -- queryClient.clear() called on line 25 using the exported singleton.
[OK] FR-UI-AUTH-6 sub-bullet Redirect to /login -- navigate(/login) called on line 26.
[OK] FR-UI-AUTH-6 sub-bullet Logout idempotent proceed even if request fails -- try/catch wraps api.post; empty catch block on lines 21-23 means clearAuth + navigate always execute regardless of API response.
[OK] spec.md Decision 7 Header renders null on public auth routes -- AUTH_ROUTES array checked on lines 14-16; return null when on /login, /register, or /forgot-password.

#### AppLayout.tsx

[OK] spec.md Router Setup AppLayout wraps all protected routes -- NavigationSetter, AppHeader, and Outlet rendered in correct order.

#### App.tsx

[OK] spec.md Router Setup createBrowserRouter with all declared routes -- all routes present: / to Navigate /notes, /login, /register, /forgot-password, protected children under PrivateRoute with AppLayout.
[OK] spec.md Router Setup Placeholder protected routes render Coming soon -- confirmed on lines 32-35.

#### main.tsx

[OK] FR-UI-AUTH-6 sub-bullet queryClient singleton passed to QueryClientProvider -- queryClient imported and passed to QueryClientProvider on line 14.
[OK] UX.md Toasts Use a single toast library sonner -- Toaster richColors position=top-right mounted at root in main.tsx line 15, satisfying global toast provider requirement.

---

### T8 -- LoginPage + LoginForm

[OK] FR-UI-AUTH-1 sub-bullet Route /login component LoginForm with shadcn/ui Input + Button -- LoginPage at /login renders LoginForm; LoginForm uses Input, Button, Form components.
[OK] FR-UI-AUTH-1 sub-bullet Validation Zod schema imported from packages/shared (same as FR-AUTH-2 backend) -- loginSchema imported from @noteapp/shared line 6 of LoginForm.tsx; zodResolver(loginSchema) used line 27.
[OK] FR-UI-AUTH-1 sub-bullet Validate on blur not per keystroke -- mode: onBlur on line 28 of LoginForm.tsx.
[OK] FR-UI-AUTH-1 sub-bullet Submit button disabled until valid -- disabled={!form.formState.isValid || isVisible} on line 116 of LoginForm.tsx.
[OK] FR-UI-AUTH-1 sub-bullet Inline error below field red border on input -- FormMessage renders below each field; aria-invalid set on inputs triggers aria-[invalid=true]:border-destructive from Input component.
[OK] FR-UI-AUTH-1 sub-bullet keyboard-reachable aria-labels present -- aria-label=Email line 72, aria-label=Password line 93; standard form elements with tab order.
[OK] FR-UI-AUTH-2 sub-bullet On 200 response store accessToken in Zustand auth slice in-memory only -- setAuth called in onSuccess line 36; no localStorage write.
[OK] FR-UI-AUTH-2 sub-bullet Redirect to URL from ?next= query param if present else /notes -- lines 37-39: next && next.startsWith(/) ? next : /notes; same-origin check via startsWith.
[OK] FR-UI-AUTH-3 sub-bullet On 401 AUTH_INVALID_CREDENTIALS show inline error via errorMessages.ts map -- getErrorMessage(code) used line 45; message set as password field error rendered by FormMessage.
[OK] FR-UI-AUTH-3 sub-bullet Email field stays populated -- only form.setValue(password, empty-string) called; email value untouched.
[OK] FR-UI-AUTH-3 sub-bullet Password field clears -- form.setValue(password, empty-string) on line 44.
[OK] FR-UI-AUTH-3 sub-bullet Focus returns to password -- setTimeout(() => passwordRef.current?.focus(), 0) on line 46.
[OK] FR-UI-AUTH-7 sub-bullet Minimum display 200ms anti-flicker timer -- useMinDuration(mutation.isPending) on line 53; isVisible used for spinner and button-disabled state.

---

### T9 -- RegisterPage + RegisterForm

[OK] FR-UI-AUTH-4 sub-bullet Route /register same validation as login -- RegisterPage at /register; registerSchema from @noteapp/shared; mode: onBlur.
[OK] FR-UI-AUTH-4 sub-bullet On 201 success auto-call login endpoint with same creds -- mutationFn posts to /auth/register then immediately posts to /auth/login with same credentials (lines 31-35 of RegisterForm.tsx).
[FAIL] FR-UI-AUTH-4 sub-bullet then follow FR-UI-AUTH-2 redirect logic -- FRS states: On 201 success, auto-call login endpoint with same creds, then follow FR-UI-AUTH-2 redirect logic. FR-UI-AUTH-2 specifies: Redirect to URL from ?next= query param if present, else /notes. Observed code in RegisterForm.tsx line 39: navigate(/notes, { replace: true }) unconditionally navigates to /notes with no useSearchParams import and no ?next= param honored. A user arriving at /register?next=/notes/123 lands on /notes after successful registration instead of /notes/123, violating FR-UI-AUTH-2 redirect logic as referenced by FR-UI-AUTH-4.
[OK] FR-UI-AUTH-4 sub-bullet On 409 USER_EXISTS inline error with link to /login -- code === USER_EXISTS check line 43; form.setError sets email field error; lines 76-82 render a Link to /login when error message matches.
[OK] FR-UI-AUTH-7 sub-bullet Loading state with minimum 200ms -- useMinDuration(mutation.isPending) line 51; isLoading={isVisible} on Button.

---

### T10 -- OtpInput + ForgotPasswordPage + ForgotPasswordWizard

#### OtpInput.tsx

[OK] FR-UI-AUTH-5 sub-bullet 6 digits auto-advance between inputs -- 6 input elements rendered; handleChange calls inputsRef.current[index+1]?.focus() on line 20 after valid digit entry.
[OK] FR-UI-AUTH-5 sub-bullet Grouped in fieldset with single legend for screen readers -- fieldset + legend.sr-only containing One-time password -- 6 digits (OtpInput.tsx lines 48-49).
[OK] FR-UI-AUTH-5 sub-bullet Backspacing on delete -- handleKeyDown handles Backspace and Delete; clears current digit or moves focus to previous input.
[OK] UX.md Accessibility All interactive elements keyboard-reachable -- digit inputs are native input elements; paste handling via onPaste; keyboard navigation via onKeyDown.
[OK] spec.md Decision 4 OTP input 6 individual single-character input elements auto-advancing focus -- implemented correctly.
[OK] UX.md Accessibility aria-labels -- each input has aria-label=Digit N of 6 (OtpInput.tsx line 61).

#### ForgotPasswordPage.tsx

[OK] FR-UI-AUTH-5 sub-bullet State cleared on page leave -- useEffect cleanup return () => { reset(); } on lines 9-12 of ForgotPasswordPage.tsx. reset() returns state to { step: 1, email: empty-string }.

#### ForgotPasswordWizard.tsx

[OK] FR-UI-AUTH-5 sub-bullet Step 1 advance to step 2 regardless of response do not leak account existence -- Step1.onSubmit: on API error with a code falls through catch and calls advance(); on success calls advance(). Only a network error (no code) triggers early return before advance().
[OK] FR-UI-AUTH-5 sub-bullet On 401 AUTH_OTP_INVALID show inline error -- Step2.onSubmit line 97: code === AUTH_OTP_INVALID sets otpError via getErrorMessage(code). Error rendered with role=alert on line 115.
[FAIL] FR-UI-AUTH-5 sub-bullet Step 3 success screen redirect to /login -- spec.md scenario UI-AUTH-FORGOT-S4 states: step 3 (success screen) is shown and after 3 seconds (or on button click) the user is redirected to /login. Observed Step3 component in ForgotPasswordWizard.tsx: no useEffect, no setTimeout, no auto-redirect. Only a manual Back to login button click navigates to /login. The 3-second auto-redirect is missing.
[OK] FR-UI-AUTH-5 sub-bullet Zod schemas from packages/shared used -- forgotPasswordSchema and resetPasswordSchema imported from @noteapp/shared (ForgotPasswordWizard.tsx line 6).
[OK] FR-UI-AUTH-7 sub-bullet Loading state with 200ms minimum on Step1 and Step2 -- both use useMinDuration(isPending) with isLoading={isVisible} on submit buttons.

---

### T11 -- MSW server + auth handlers + test-setup

[OK] FR-INFRA-4 sub-bullet test-setup imports @testing-library/jest-dom starts/resets/closes MSW server -- test-setup.ts: beforeAll server.listen, afterEach server.resetHandlers, afterAll server.close.
[OK] FR-UI-AUTH-1 sub-bullet Mock login handler returns accessToken and user on valid credentials -- auth.handlers.ts lines 9-13: { accessToken: mock-access-token, user: { id: user-1, email } } for user@example.com / Password1.
[OK] FR-UI-AUTH-3 sub-bullet Mock login handler returns 401 AUTH_INVALID_CREDENTIALS for wrong credentials -- line 14: HttpResponse.json({ code: AUTH_INVALID_CREDENTIALS }, { status: 401 }).
[OK] FR-UI-AUTH-4 sub-bullet Mock register handler returns 409 USER_EXISTS for existing email -- auth.handlers.ts lines 19-21.
[FAIL] FR-AUTH-5 sub-bullet Success response 200 with message -- FRS FR-AUTH-5 states: Success response: 200 with { message: If your account exists, you will receive an OTP }. Observed in auth.handlers.ts lines 33-39: new HttpResponse(null, { status: 204 }) -- a 204 No Content response. FRS requires status 200 with a JSON body. The mock does not simulate the correct backend contract.
[FAIL] FR-AUTH-6 sub-bullet 401 AUTH_OTP_INVALID wrong OTP / expired / out of attempts -- FRS FR-AUTH-6 states: Errors: 401 AUTH_OTP_INVALID. Observed in auth.handlers.ts lines 41-47: HttpResponse.json({ code: AUTH_OTP_INVALID }, { status: 400 }) -- HTTP 400 not 401. ForgotPasswordWizard checks by error code not HTTP status so this is non-breaking for current UI tests, but the mock is inconsistent with FRS and would cause false-pass tests if any code path branches on HTTP status.
[OK] FR-UI-AUTH-2 sub-bullet Mock refresh handler returns new accessToken -- HttpResponse.json({ accessToken: refreshed-access-token }) on POST /auth/refresh.
[OK] FR-UI-AUTH-6 sub-bullet Mock logout handler returns 204 -- new HttpResponse(null, { status: 204 }) for POST /auth/logout, matching FR-AUTH-4 success response.

---

### T12 -- Tests

#### authStore.test.ts

[OK] FR-UI-AUTH-2 sub-bullet localStorage never set with token verified by test -- test line 25 uses vi.spyOn(Storage.prototype, setItem) and asserts not.toHaveBeenCalled(). COVERAGE gap from T4 review is now resolved.
[OK] FR-UI-AUTH-5 sub-bullet advance() caps at step 3 -- test line 57 covers the boundary condition. COVERAGE gap from T4 review is now resolved.

#### useMinDuration.test.ts

[OK] FR-UI-AUTH-7 sub-bullet Minimum display 200ms verified by test -- three named tests with UI-AUTH-LOADING-S1 prefix: visible while pending, stays true for 200ms after pending becomes false using fake timers, becomes false after full 200ms. COVERAGE gap from T4 review is now resolved.

#### api.interceptor.test.ts

[OK] UI-AUTH-INTERCEPTOR-S1 named test retries original request with new token after successful refresh -- verifies refreshCalled, retryAuthHeader=Bearer new-token, response status 200, no navigate call. COVERAGE gap from T5 review is now resolved.
[OK] UI-AUTH-INTERCEPTOR-S2 named test calls clearAuth and navigates to /login when refresh also fails -- verifies accessToken null, user null, mockNavigate called with /login. COVERAGE gap from T5 review is now resolved.
[OK] Request interceptor tests cover header injection and no-token cases (api.interceptor.test.ts lines 81-110).

#### LoginPage.test.tsx

[OK] UI-AUTH-LOGIN-S1 submits credentials stores token in Zustand not localStorage and redirects to ?next= path -- renders with ?next=/notes/123, submits valid creds, asserts navigation, checks Zustand state, checks localStorage spy.
[OK] UI-AUTH-LOGIN-S2 shows Invalid email or password clears password field retains email on 401 -- two tests covering message + field values (line 93) and focus behavior (line 117).
[OK] UI-AUTH-LOGIN-S3 shows inline error and red border on blur submit button stays disabled -- checks aria-invalid=true on email input (line 163).
[COVERAGE] FR-UI-AUTH-4 has no named test for scenario UI-AUTH-REGISTER-S1 (successful register -> auto-login -> redirect). No RegisterForm.test.tsx or RegisterPage.test.tsx exists in apps/web/src/__tests__/.
[COVERAGE] FR-UI-AUTH-4 has no named test for scenario UI-AUTH-REGISTER-S2 (409 USER_EXISTS -> inline error with link to /login).
[COVERAGE] FR-UI-AUTH-4 has no named test for scenario UI-AUTH-REGISTER-S3 (client-side validation: password without a number shows Zod schema error message).
[COVERAGE] FR-UI-AUTH-5 has no named test for scenario UI-AUTH-FORGOT-S1 (Step 1: email submitted regardless of existence -> always advances to step 2).
[COVERAGE] FR-UI-AUTH-5 has no named test for scenario UI-AUTH-FORGOT-S2 (Step 2: OTP auto-advance between digit inputs).
[COVERAGE] FR-UI-AUTH-5 has no named test for scenario UI-AUTH-FORGOT-S3 (Step 2: wrong OTP -> AUTH_OTP_INVALID -> inline error message).
[COVERAGE] FR-UI-AUTH-5 has no named test for scenario UI-AUTH-FORGOT-S4 (Step 3: success screen -> auto-redirect after 3 seconds or on button click). Compounded by [FAIL]: the auto-redirect is also missing from the code.
[COVERAGE] FR-UI-AUTH-6 has no named test for scenario UI-AUTH-LOGOUT-S1 (Logout button: clearAuth called, queryClient.clear() called, redirect to /login).

---

### Cross-cutting Security Checks

[OK] UX.md Tokens Access token kept in memory in Zustand never localStorage -- confirmed across all T6-T12 files; no localStorage.setItem or persist middleware in any auth-related store or component.
[OK] UX.md Tokens Refresh token stored in httpOnly cookie frontend never reads it directly -- no code reads or writes a refresh token value; withCredentials:true on api instance ensures browser sends cookie automatically.
[OK] FR-UI-SEARCH-2 security note NEVER use dangerouslySetInnerHTML without sanitization -- no dangerouslySetInnerHTML or .innerHTML assignment found in any T6-T12 file.
[OK] UX.md Error States Never display raw error.detail to the user -- all error paths use getErrorMessage(code) which maps by code; no .detail field rendered to DOM.

---

### Summary -- T6-T12

| Severity  | Count |
|-----------|-------|
| FAIL      | 4     |
| WARN      | 1     |
| SEC       | 0     |
| COVERAGE  | 8     |
| OK        | 64    |

FAIL items requiring resolution:

1. [FAIL] FR-UI-AUTH-4 -- RegisterForm.tsx line 39 hard-codes navigate(/notes) without reading ?next= param. FRS text: then follow FR-UI-AUTH-2 redirect logic. FR-UI-AUTH-2: Redirect to URL from ?next= query param if present, else /notes.

2. [FAIL] FR-UI-AUTH-5 -- ForgotPasswordWizard.tsx Step3 component missing 3-second auto-redirect. FRS/spec.md scenario UI-AUTH-FORGOT-S4: after 3 seconds (or on button click) the user is redirected to /login.

3. [FAIL] FR-AUTH-5 mock -- auth.handlers.ts returns 204 No Content for POST /auth/forgot-password. FRS FR-AUTH-5: Success response: 200 with { message: ... }.

4. [FAIL] FR-AUTH-6 mock -- auth.handlers.ts returns HTTP 400 for AUTH_OTP_INVALID. FRS FR-AUTH-6: 401 AUTH_OTP_INVALID -- wrong OTP / expired / out of attempts.

COVERAGE gaps (no named test for scenario): UI-AUTH-REGISTER-S1, UI-AUTH-REGISTER-S2, UI-AUTH-REGISTER-S3, UI-AUTH-FORGOT-S1, UI-AUTH-FORGOT-S2, UI-AUTH-FORGOT-S3, UI-AUTH-FORGOT-S4, UI-AUTH-LOGOUT-S1.
