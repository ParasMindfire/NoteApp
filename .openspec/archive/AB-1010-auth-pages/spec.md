---
ticket: AB-1010
slug: auth-pages
type: frontend
status: APPROVED
---

# AB-1010 — Frontend Auth Pages

## Overview

Implements the full authentication UI for the note-taking app: Login, Register, and Forgot-Password
pages, plus the shared Axios HTTP client, Zustand auth slice, 401→refresh interceptor, and
PrivateRoute guard. This is the first frontend ticket; it establishes all auth infrastructure that
AB-1011 onwards depends on. The app header stub (with the Logout button) is also introduced here.

## Goals

- Deliver /login, /register, /forgot-password pages using shadcn/ui + Zod schemas from packages/shared
- Set up Zustand `authStore` (access token in-memory, never localStorage)
- Set up Axios instance with JWT injection + silent 401→refresh retry
- Implement `PrivateRoute` wrapper that redirects to /login when no token
- Minimal `AppHeader` with Logout button

## Non-Goals

- Notes list, editor, search, share, version history UI (AB-1011–1015)
- Nav links for Notes/Search in the header (stubbed in later tickets)
- OAuth or social login
- Persistent session across hard refresh (a new page load requires re-login; that is intentional)

## FRs Covered

- FR-UI-AUTH-1 (login form)
- FR-UI-AUTH-2 (login success, token storage, redirect)
- FR-UI-AUTH-3 (login failure UX)
- FR-UI-AUTH-4 (register form)
- FR-UI-AUTH-5 (forgot-password 3-step flow)
- FR-UI-AUTH-6 (logout button)
- FR-UI-AUTH-7 (loading states on all submits)

## Pages / Components

| Route              | Component(s)                                      | Notes                              |
|--------------------|---------------------------------------------------|------------------------------------|
| /login             | `<LoginPage>` → `<LoginForm>`                     | Redirects to /notes if already authed |
| /register          | `<RegisterPage>` → `<RegisterForm>`               | On success auto-logins, then redirects |
| /forgot-password   | `<ForgotPasswordPage>` → `<ForgotPasswordWizard>` | 3 stateful steps, one URL          |
| (layout)           | `<AppLayout>` + `<AppHeader>`                     | Header stub: logo + Logout button  |
| (guard)            | `<PrivateRoute>`                                  | Wraps all protected routes          |

### Router Setup (React Router v6)

```
/                 → redirect to /notes
/login            → <LoginPage> (public)
/register         → <RegisterPage> (public)
/forgot-password  → <ForgotPasswordPage> (public)
/* protected */   → <PrivateRoute> → <AppLayout>
  /notes          → (placeholder, wired in AB-1011)
  /notes/new      → (placeholder)
  /notes/:id      → (placeholder)
  /search         → (placeholder)
```

Public routes redirect to /notes if already authenticated. Placeholder protected routes render a
simple `<div>Coming soon</div>` so the router tree is fully declared from the start.

## State Management

### Zustand — `authStore`

```ts
interface AuthState {
  accessToken: string | null
  user: { id: string; email: string } | null
  setAuth: (token: string, user: AuthState['user']) => void
  clearAuth: () => void
}
```

- Kept in-memory only. Never persisted to localStorage/sessionStorage.
- `clearAuth` also calls `queryClient.clear()` (passed in at call site by Logout button).

### Zustand — `forgotPasswordStore` (component-local, cleared on page leave)

```ts
interface ForgotPasswordState {
  step: 1 | 2 | 3
  email: string
  setEmail: (email: string) => void
  advance: () => void
  reset: () => void
}
```

Reset called in `<ForgotPasswordPage>` cleanup (`useEffect` return).

### TanStack Query

No query keys introduced in this ticket (all auth calls are mutations). Query client is instantiated
here (`apps/web/src/lib/queryClient.ts`) and passed to `<QueryClientProvider>` in `main.tsx`.

## API Integration

### Axios Instance (`apps/web/src/lib/api.ts`)

- `baseURL`: from `import.meta.env.VITE_API_URL` (default `http://localhost:4000`)
- `withCredentials: true` — ensures httpOnly refresh cookie is sent on every request
- **Request interceptor**: inject `Authorization: Bearer <accessToken>` from `authStore`
- **Response interceptor (401 retry)**:
  1. On 401, attempt `POST /auth/refresh` once (flag to avoid infinite loop)
  2. On refresh success: update `authStore` with new access token, retry original request
  3. On refresh failure: call `authStore.clearAuth()`, navigate to `/login`

### Endpoints consumed

| Action             | Endpoint                   | FRs           |
|--------------------|----------------------------|---------------|
| Login              | POST /auth/login            | FR-AUTH-2     |
| Register           | POST /auth/register         | FR-AUTH-1     |
| Auto-login on reg. | POST /auth/login            | FR-UI-AUTH-4  |
| Forgot password    | POST /auth/forgot-password  | FR-AUTH-5     |
| Reset password     | POST /auth/reset-password   | FR-AUTH-6     |
| Refresh token      | POST /auth/refresh          | FR-AUTH-3     |
| Logout             | POST /auth/logout           | FR-AUTH-4     |

### Error code → user message mappings (`apps/web/src/lib/errorMessages.ts`)

| Code                      | User-facing message                                      |
|---------------------------|----------------------------------------------------------|
| AUTH_INVALID_CREDENTIALS  | "Invalid email or password"                              |
| USER_EXISTS               | "Account already exists. Try logging in."                |
| AUTH_OTP_INVALID          | "Invalid or expired code. Please try again."             |
| VALIDATION_FAILED         | "Please check your input and try again."                 |
| RATE_LIMITED              | "Too many attempts. Please wait a moment."               |
| (fallback)                | "Something went wrong. Please try again."                |

## Ticket-Specific UX Decisions

1. **Redirect after login**: `/notes` by default; honors `?next=` query param (validated to same-origin
   paths only — no open-redirect; strip protocol + host if present).

2. **Register auto-login**: After 201 from POST /auth/register, immediately POST /auth/login with the
   same credentials. No separate success screen — user lands on /notes transparently.

3. **Forgot-password step transitions**: Step 1 always advances to step 2 on any non-network response
   (200 or 4xx), matching the "don't leak account existence" requirement in FR-AUTH-5. Only a network
   error keeps the user on step 1.

4. **OTP input**: 6 individual single-character `<input>` elements, auto-advancing focus on digit entry
   and backspacing on delete. Grouped in a `<fieldset>` with a single `<legend>` for screen readers.

5. **Minimum spinner display (200ms)**: All submit buttons use a `useMinDuration(200)` hook that
   ensures the spinner shows for at least 200ms even if the response is instant.

6. **`PrivateRoute` navigation**: Uses `<Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />`
   so the user returns to their intended destination after login.

7. **AppHeader scope**: Logo + Logout button only. Nav items (Notes, Search) are added in AB-1011/1013.
   Header renders `null` on public auth routes (no logout button shown on /login etc.).

## Scenarios

### UI-AUTH-LOGIN-S1 — Successful login + redirect
**Validates:** FR-UI-AUTH-1, FR-UI-AUTH-2
Given the user is on /login?next=/notes/123,
when they enter valid credentials and submit,
then the accessToken is stored in Zustand (not localStorage), and they are redirected to /notes/123.

### UI-AUTH-LOGIN-S2 — Invalid credentials error
**Validates:** FR-UI-AUTH-3
Given the user submits wrong credentials,
when the API returns 401 AUTH_INVALID_CREDENTIALS,
then the message "Invalid email or password" is shown inline, the email field retains its value,
the password field is cleared, and focus returns to the password input.

### UI-AUTH-LOGIN-S3 — Client-side validation blocks submit
**Validates:** FR-UI-AUTH-1
Given the user has not entered a valid email,
when they blur the email field,
then an inline error appears below the field, the input gains a red border, and the submit button
remains disabled.

### UI-AUTH-REGISTER-S1 — Successful register → auto-login → redirect
**Validates:** FR-UI-AUTH-4
Given the user submits valid register credentials,
when the API returns 201 and the subsequent login returns 200,
then they land on /notes with the accessToken stored in Zustand.

### UI-AUTH-REGISTER-S2 — Duplicate account error
**Validates:** FR-UI-AUTH-4
Given the email already exists,
when the API returns 409 USER_EXISTS,
then "Account already exists. Try logging in." appears inline with a link to /login.

### UI-AUTH-REGISTER-S3 — Client-side validation (password rule)
**Validates:** FR-UI-AUTH-4
Given the user enters a password without a number,
when they blur the password field,
then an inline error "Password must contain at least one number" appears (from the shared Zod schema message).

### UI-AUTH-FORGOT-S1 — Step 1: email submitted regardless of existence
**Validates:** FR-UI-AUTH-5
Given any email (existing or not) is submitted on step 1,
when the API responds (200 or error),
then the UI always advances to step 2 (OTP + new password fields are shown).

### UI-AUTH-FORGOT-S2 — Step 2: OTP auto-advance between inputs
**Validates:** FR-UI-AUTH-5
Given the user is on step 2,
when they type a digit into one OTP box,
then focus automatically moves to the next box.

### UI-AUTH-FORGOT-S3 — Step 2: wrong OTP shows inline error
**Validates:** FR-UI-AUTH-5
Given the user submits an incorrect OTP,
when the API returns 401 AUTH_OTP_INVALID,
then "Invalid or expired code. Please try again." is shown inline; the user stays on step 2.

### UI-AUTH-FORGOT-S4 — Step 3: success screen → redirect to /login
**Validates:** FR-UI-AUTH-5
Given the OTP and new password are correct,
when the API returns 204,
then step 3 (success screen) is shown and after 3 seconds (or on button click) the user is redirected to /login.

### UI-AUTH-LOGOUT-S1 — Logout clears state + redirects
**Validates:** FR-UI-AUTH-6
Given the user is authenticated and clicks Logout,
when POST /auth/logout succeeds (or fails — idempotent),
then `authStore.clearAuth()` is called, `queryClient.clear()` is called, and the user is redirected to /login with no stale data in cache.

### UI-AUTH-LOADING-S1 — Submit spinner with 200ms minimum
**Validates:** FR-UI-AUTH-7
Given the user submits the login form,
when the API responds in under 200ms,
then the spinner still displays for the full 200ms before the button returns to its normal state
(no layout shift during display).

### UI-AUTH-INTERCEPTOR-S1 — Silent token refresh on 401
**Validates:** FR-UI-AUTH-2 (token lifecycle), UX.md § Tokens
Given the user has a valid refresh token cookie but an expired access token,
when any authenticated request receives a 401,
then the interceptor silently calls POST /auth/refresh, updates the access token, and retries the
original request — the user sees no error.

### UI-AUTH-INTERCEPTOR-S2 — Refresh failure redirects to /login
**Validates:** FR-UI-AUTH-2 (token lifecycle)
Given both the access token and refresh token are invalid,
when the 401 retry also fails,
then `authStore.clearAuth()` is called and the user is redirected to /login.

## Dependencies

- **AB-1009 merged** — all backend endpoints (auth, notes, tags, versions) are available.
- **packages/shared** — Zod schemas for loginSchema, registerSchema, resetPasswordSchema exported.
- **shadcn/ui components initialized** — Button, Input, Form, Dialog, Label available in apps/web.

## Open Questions

_(none — all resolved by clarifying questions above)_
