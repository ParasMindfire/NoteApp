---
ticket: AB-1010
status: APPROVED
---

# Tasks — AB-1010 Frontend Auth Pages

> Execution order: T1 → (T2 ∥ T3) → T4 → T5 → T6 → T7 → (T8 ∥ T9 ∥ T10) → T11 → (T12 ∥ T13 ∥ T14 ∥ T15 ∥ T16)
> After each completed task, invoke Tester + Reviewer watcher agents before proceeding.

---

- [x] **T1 — Install new packages** (15 min)
  - Run `pnpm add` for all new deps listed in plan.md; update `apps/web/package.json` with pinned versions (no ^ or ~)
  - **Deps:** react-router-dom, axios, react-hook-form, @hookform/resolvers, class-variance-authority, clsx, tailwind-merge, sonner, @radix-ui/react-label, @radix-ui/react-slot
  - **DevDeps:** tailwindcss, autoprefixer, postcss, @types/node
  - **Files touched:** `apps/web/package.json`
  - **Scenarios:** foundation (no scenario directly; unblocks all)

- [x] **T2 — Tailwind + PostCSS config + global CSS + path aliases** (20 min) [PARALLEL with T3]
  - Create `apps/web/tailwind.config.js` with `content: ['./index.html', './src/**/*.{ts,tsx}']`
  - Create `apps/web/postcss.config.js` with tailwindcss + autoprefixer plugins
  - Create `apps/web/src/index.css` with `@tailwind base/components/utilities` + shadcn/ui CSS variable tokens (background, foreground, primary, destructive, muted, border, ring, radius)
  - Update `apps/web/vite.config.ts` — add `resolve.alias: { '@': path.resolve(__dirname, 'src') }`; import `path` from `'node:path'`
  - Update `apps/web/tsconfig.json` — add `"paths": { "@/*": ["./src/*"] }` under compilerOptions
  - Update `apps/web/vitest.config.ts` — add matching `resolve.alias` so `@/` imports resolve in tests
  - **Files touched:** `apps/web/tailwind.config.js` (new), `apps/web/postcss.config.js` (new), `apps/web/src/index.css` (new), `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/vitest.config.ts`
  - **Scenarios:** foundation (unblocks T6 shadcn/ui components)

- [x] **T3 — Core lib files** (20 min) [PARALLEL with T2]
  - `apps/web/src/lib/utils.ts` — `cn()` helper: `twMerge(clsx(...inputs))`
  - `apps/web/src/lib/queryClient.ts` — singleton `QueryClient` with `defaultOptions: { queries: { staleTime: 60_000, retry: 1 } }`
  - `apps/web/src/lib/errorMessages.ts` — `Record<string, string>` map: AUTH_INVALID_CREDENTIALS, USER_EXISTS, AUTH_OTP_INVALID, VALIDATION_FAILED, RATE_LIMITED, fallback
  - `apps/web/src/lib/navigation.ts` — `setNavigate(fn)` / `getNavigate()` singleton; typed as `NavigateFunction | null`
  - **Files touched:** `apps/web/src/lib/utils.ts` (new), `apps/web/src/lib/queryClient.ts` (new), `apps/web/src/lib/errorMessages.ts` (new), `apps/web/src/lib/navigation.ts` (new)
  - **Scenarios:** foundation (unblocks T4, T5; satisfies FR-UI-AUTH-3 error message requirement)

- [x] **T4 — Zustand stores + useMinDuration hook** (25 min)
  - `apps/web/src/stores/authStore.ts` — `useAuthStore` with `{ accessToken, user, setAuth, clearAuth }`; no persistence middleware; `clearAuth` does NOT call queryClient directly (caller's responsibility)
  - `apps/web/src/stores/forgotPasswordStore.ts` — `useForgotPasswordStore` with `{ step: 1|2|3, email, setEmail, advance, reset }`; `reset` is idempotent (safe under StrictMode)
  - `apps/web/src/hooks/useMinDuration.ts` — `useMinDuration(ms: number)`: accepts a `isPending: boolean` prop; returns `isVisible` that stays `true` for at least `ms` after `isPending` goes `false`
  - **Files touched:** `apps/web/src/stores/authStore.ts` (new), `apps/web/src/stores/forgotPasswordStore.ts` (new), `apps/web/src/hooks/useMinDuration.ts` (new)
  - **Scenarios:** UI-AUTH-LOGIN-S1 (token in Zustand), UI-AUTH-LOGOUT-S1 (clearAuth), UI-AUTH-LOADING-S1 (useMinDuration), UI-AUTH-FORGOT-S4 (forgotPasswordStore reset)

- [x] **T5 — Axios instance + interceptors** (30 min)
  - `apps/web/src/lib/api.ts`:
    - Create Axios instance with `baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000'` and `withCredentials: true`
    - **Request interceptor:** read `useAuthStore.getState().accessToken`; if present, set `Authorization: Bearer <token>`
    - **Response interceptor (401 retry):**
      1. If `config._retry` already set → call `useAuthStore.getState().clearAuth()`; call `getNavigate()?.('/login')`; reject
      2. Set `config._retry = true`
      3. POST `/auth/refresh` (using the same axios instance with `_retry` already set to avoid loop)
      4. On success: call `setAuth(newToken, currentUser)`; retry original request
      5. On failure: `clearAuth()`; `getNavigate()?.('/login')`; reject
  - **Files touched:** `apps/web/src/lib/api.ts` (new)
  - **Scenarios:** UI-AUTH-INTERCEPTOR-S1, UI-AUTH-INTERCEPTOR-S2

- [x] **T6 — shadcn/ui base components** (30 min)
  - `apps/web/src/components/ui/button.tsx` — `Button` with `variant` (default/destructive/outline/ghost) + `size` (default/sm/lg) via `cva`; uses `@radix-ui/react-slot` for `asChild`; accepts `isLoading?: boolean` — when true renders `<Loader2 className="animate-spin" />` replacing label text, width preserved via `min-w`
  - `apps/web/src/components/ui/input.tsx` — styled `<input>` with red border class on `aria-invalid`; `forwardRef`
  - `apps/web/src/components/ui/label.tsx` — wraps `@radix-ui/react-label`; styled
  - `apps/web/src/components/ui/form.tsx` — `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` built on react-hook-form's `Controller` + `useFormContext`
  - **Files touched:** `apps/web/src/components/ui/button.tsx` (new), `apps/web/src/components/ui/input.tsx` (new), `apps/web/src/components/ui/label.tsx` (new), `apps/web/src/components/ui/form.tsx` (new)
  - **Scenarios:** UI-AUTH-LOGIN-S3 (red border, disabled submit), UI-AUTH-LOADING-S1 (spinner in button), FR-UI-AUTH-7

- [x] **T7 — Layout + routing wiring** (35 min)
  - `apps/web/src/components/layout/AppHeader.tsx` — logo text ("NoteApp") + Logout `Button`; reads `useLocation` to hide on `/login`, `/register`, `/forgot-password`; Logout handler: `POST /auth/logout` via api.ts (fire-and-forget on error), then `clearAuth()`, `queryClient.clear()`, `navigate('/login')`
  - `apps/web/src/components/layout/AppLayout.tsx` — `<AppHeader />` + `<main><Outlet /></main>`
  - `apps/web/src/components/auth/PrivateRoute.tsx` — reads `authStore.accessToken`; if null renders `<Navigate to={'/login?next=' + encodeURIComponent(location.pathname)} replace />`
  - `apps/web/src/components/auth/NavigationSetter.tsx` — calls `setNavigate(useNavigate())` in `useEffect([], [])` + cleanup; renders `null`
  - Update `apps/web/src/App.tsx` — `createBrowserRouter` with full route tree (see plan.md); render `<NavigationSetter />` inside root layout before `<Outlet />`
  - Update `apps/web/src/main.tsx` — import `index.css`; wrap with `<QueryClientProvider client={queryClient}>`; add `<Toaster />` (sonner) above `<RouterProvider>`
  - **Files touched:** `apps/web/src/components/layout/AppHeader.tsx` (new), `apps/web/src/components/layout/AppLayout.tsx` (new), `apps/web/src/components/auth/PrivateRoute.tsx` (new), `apps/web/src/components/auth/NavigationSetter.tsx` (new), `apps/web/src/App.tsx` (modify), `apps/web/src/main.tsx` (modify)
  - **Scenarios:** UI-AUTH-LOGOUT-S1 (header Logout), UI-AUTH-LOGIN-S1 (PrivateRoute + redirect), UI-AUTH-INTERCEPTOR-S2 (navigate to /login on clearAuth)

- [x] **T8 — LoginPage + LoginForm** (30 min) [PARALLEL with T9, T10]
  - `apps/web/src/pages/auth/LoginPage.tsx` — if `authStore.accessToken` is set, render `<Navigate to="/notes" replace />`; otherwise render `<LoginForm />`; centered card layout
  - `apps/web/src/pages/auth/LoginForm.tsx`:
    - `useForm` with `zodResolver(loginSchema)`; `mode: 'onBlur'`
    - `useMutation` via api.ts → `POST /auth/login`
    - On success (200): `setAuth(accessToken, user)`; redirect to `?next=` or `/notes`
    - On 401 AUTH_INVALID_CREDENTIALS: show `errorMessages['AUTH_INVALID_CREDENTIALS']` inline below password; clear password field (`setValue('password', '')`); focus password input
    - Submit button uses `useMinDuration(200)` for isLoading
    - `aria-label` on inputs; `<label>` for each field
  - **Files touched:** `apps/web/src/pages/auth/LoginPage.tsx` (new), `apps/web/src/pages/auth/LoginForm.tsx` (new)
  - **Scenarios:** UI-AUTH-LOGIN-S1, UI-AUTH-LOGIN-S2, UI-AUTH-LOGIN-S3

- [x] **T9 — RegisterPage + RegisterForm** (25 min) [PARALLEL with T8, T10]
  - `apps/web/src/pages/auth/RegisterPage.tsx` — same "redirect if authed" guard as LoginPage
  - `apps/web/src/pages/auth/RegisterForm.tsx`:
    - `useForm` with `zodResolver(registerSchema)`; `mode: 'onBlur'`
    - On 201: immediately call `POST /auth/login` with same creds → on success `setAuth(...)` + navigate `/notes`
    - On 409 USER_EXISTS: show "Account already exists. Try logging in." + `<Link to="/login">` below email field
    - On other errors: map via errorMessages.ts
  - **Files touched:** `apps/web/src/pages/auth/RegisterPage.tsx` (new), `apps/web/src/pages/auth/RegisterForm.tsx` (new)
  - **Scenarios:** UI-AUTH-REGISTER-S1, UI-AUTH-REGISTER-S2, UI-AUTH-REGISTER-S3

- [x] **T10 — ForgotPasswordPage + Wizard + OtpInput** (35 min) [PARALLEL with T8, T9]
  - `apps/web/src/components/auth/OtpInput.tsx` — 6 `<input maxLength={1} inputMode="numeric">` elements inside `<fieldset>`/`<legend>`; `onKeyDown` auto-advances on digit, backtracks on Delete/Backspace; exposes `value: string` (6-char concat) + `onChange(val: string)`
  - `apps/web/src/pages/auth/ForgotPasswordPage.tsx` — mounts `<ForgotPasswordWizard />`; `useEffect` cleanup calls `useForgotPasswordStore.getState().reset()`
  - `apps/web/src/pages/auth/ForgotPasswordWizard.tsx`:
    - **Step 1:** email input + submit → `POST /auth/forgot-password`; on any non-network response (including 4xx) → `advance()` to step 2; on network error → show toast "Network error, please try again"
    - **Step 2:** `<OtpInput />` + new password input + submit → `POST /auth/reset-password`; on 204 → `advance()` to step 3; on 401 AUTH_OTP_INVALID → show "Invalid or expired code. Please try again." inline
    - **Step 3:** success message + "Back to login" button → `navigate('/login')`; also auto-redirects after 3s via `useEffect`
  - **Files touched:** `apps/web/src/components/auth/OtpInput.tsx` (new), `apps/web/src/pages/auth/ForgotPasswordPage.tsx` (new), `apps/web/src/pages/auth/ForgotPasswordWizard.tsx` (new)
  - **Scenarios:** UI-AUTH-FORGOT-S1, UI-AUTH-FORGOT-S2, UI-AUTH-FORGOT-S3, UI-AUTH-FORGOT-S4

- [x] **T11 — MSW server + auth handlers** (20 min)
  - `apps/web/src/mocks/server.ts` — `setupServer(...authHandlers)` from `msw/node`
  - `apps/web/src/mocks/handlers/auth.handlers.ts` — MSW v2 `http.post` handlers:
    - `/auth/login` — happy path returns `{ accessToken: 'test-token', user: { id: '1', email: 'test@test.com' } }`; override per-test for error cases
    - `/auth/register` — happy path 201; override for 409
    - `/auth/forgot-password` — always 200
    - `/auth/reset-password` — happy path 204; override for 401
    - `/auth/refresh` — happy path returns new `{ accessToken }`
    - `/auth/logout` — always 204
  - Update `apps/web/src/test-setup.ts` — add `beforeAll(server.listen)`, `afterEach(server.resetHandlers)`, `afterAll(server.close)`
  - **Files touched:** `apps/web/src/mocks/server.ts` (new), `apps/web/src/mocks/handlers/auth.handlers.ts` (new), `apps/web/src/test-setup.ts` (modify)
  - **Scenarios:** test infrastructure (unblocks T12–T16)

- [x] **T12 — authStore unit tests + api interceptor tests** (30 min) [PARALLEL with T13, T14, T15, T16]
  - `apps/web/src/__tests__/stores/authStore.test.ts`:
    - `setAuth` stores token + user in state; not in localStorage
    - `clearAuth` nulls token + user
    - localStorage never written (spy on `localStorage.setItem`)
  - `apps/web/src/__tests__/lib/api.interceptor.test.ts`:
    - **UI-AUTH-INTERCEPTOR-S1:** first request 401 → refresh succeeds → original retried with new token; user sees no error
    - **UI-AUTH-INTERCEPTOR-S2:** first request 401 → refresh also 401 → `clearAuth` called; navigate called with `/login`
  - **Files touched:** `apps/web/src/__tests__/stores/authStore.test.ts` (new), `apps/web/src/__tests__/lib/api.interceptor.test.ts` (new)
  - **Scenarios:** UI-AUTH-INTERCEPTOR-S1, UI-AUTH-INTERCEPTOR-S2

- [x] **T13 — LoginPage tests** (25 min) [PARALLEL with T12, T14, T15, T16]
  - `apps/web/src/__tests__/pages/LoginPage.test.tsx`:
    - **UI-AUTH-LOGIN-S1:** fill valid creds → submit → token in `useAuthStore`; `localStorage.setItem` never called; navigate called with `/notes/123` (via `?next=`)
    - **UI-AUTH-LOGIN-S2:** MSW returns 401 → "Invalid email or password" visible; email field retains value; password field cleared; password input focused
    - **UI-AUTH-LOGIN-S3:** enter invalid email → blur → error text below field; input has `aria-invalid`; submit button disabled
  - **Files touched:** `apps/web/src/__tests__/pages/LoginPage.test.tsx` (new)
  - **Scenarios:** UI-AUTH-LOGIN-S1, UI-AUTH-LOGIN-S2, UI-AUTH-LOGIN-S3

- [x] **T14 — RegisterPage tests** (25 min) [PARALLEL with T12, T13, T15, T16]
  - `apps/web/src/__tests__/pages/RegisterPage.test.tsx`:
    - **UI-AUTH-REGISTER-S1:** MSW register 201 → login 200 → token in authStore; redirected to `/notes`
    - **UI-AUTH-REGISTER-S2:** MSW register 409 → "Account already exists" visible; link to `/login` present
    - **UI-AUTH-REGISTER-S3:** enter password without number → blur → Zod error message visible; submit disabled
  - **Files touched:** `apps/web/src/__tests__/pages/RegisterPage.test.tsx` (new)
  - **Scenarios:** UI-AUTH-REGISTER-S1, UI-AUTH-REGISTER-S2, UI-AUTH-REGISTER-S3

- [x] **T15 — ForgotPasswordPage tests** (30 min) [PARALLEL with T12, T13, T14, T16]
  - `apps/web/src/__tests__/pages/ForgotPasswordPage.test.tsx`:
    - **UI-AUTH-FORGOT-S1:** submit step 1 (any email) → MSW 200 → step 2 fields visible; also test: MSW 429 → still advances to step 2
    - **UI-AUTH-FORGOT-S2:** on step 2, simulate typing digit → verify next OTP input receives focus
    - **UI-AUTH-FORGOT-S3:** submit step 2 with wrong OTP → MSW 401 → "Invalid or expired code" visible; still on step 2
    - **UI-AUTH-FORGOT-S4:** submit step 2 with correct OTP → MSW 204 → step 3 success text visible; after timer navigate called with `/login`
  - **Files touched:** `apps/web/src/__tests__/pages/ForgotPasswordPage.test.tsx` (new)
  - **Scenarios:** UI-AUTH-FORGOT-S1, UI-AUTH-FORGOT-S2, UI-AUTH-FORGOT-S3, UI-AUTH-FORGOT-S4

- [x] **T16 — AppHeader logout test + useMinDuration test** (20 min) [PARALLEL with T12, T13, T14, T15]
  - `apps/web/src/__tests__/components/AppHeader.test.tsx`:
    - **UI-AUTH-LOGOUT-S1:** render AppHeader inside MemoryRouter (authenticated); click Logout → MSW 204 → `authStore.accessToken` is null; `queryClient.clear()` called (spy); navigate called with `/login`
  - `apps/web/src/__tests__/hooks/useMinDuration.test.ts`:
    - **UI-AUTH-LOADING-S1:** `isPending` flips false after 50ms → `isVisible` still true at 100ms; false only after ≥200ms
  - **Files touched:** `apps/web/src/__tests__/components/AppHeader.test.tsx` (new), `apps/web/src/__tests__/hooks/useMinDuration.test.ts` (new)
  - **Scenarios:** UI-AUTH-LOGOUT-S1, UI-AUTH-LOADING-S1
