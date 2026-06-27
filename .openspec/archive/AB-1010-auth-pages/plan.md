---
ticket: AB-1010
status: APPROVED
---

# Plan — AB-1010 Frontend Auth Pages

## Dependencies on Prior Tickets

- AB-1009 merged to `main` (all backend auth endpoints live and tested)
- `packages/shared` exports `loginSchema`, `registerSchema`, `forgotPasswordSchema`,
  `resetPasswordSchema` — already present; no changes needed

## New Packages

Add to `apps/web/package.json` **dependencies** (pinned, no ^ or ~):

| Package                    | Version   | Purpose                              |
|----------------------------|-----------|--------------------------------------|
| `react-router-dom`         | `6.26.2`  | Client-side routing                  |
| `axios`                    | `1.7.7`   | HTTP client + interceptors           |
| `react-hook-form`          | `7.54.0`  | Form state + validation              |
| `@hookform/resolvers`      | `3.9.1`   | Zod adapter for react-hook-form      |
| `class-variance-authority` | `0.7.1`   | shadcn/ui variant utility            |
| `clsx`                     | `2.1.1`   | className merging utility            |
| `tailwind-merge`           | `2.5.5`   | Tailwind class conflict resolution   |
| `sonner`                   | `1.5.0`   | Toast notifications                  |
| `@radix-ui/react-label`    | `2.1.0`   | Accessible Label primitive           |
| `@radix-ui/react-slot`     | `1.1.0`   | Slot primitive (shadcn Button base)  |

Add to `apps/web/package.json` **devDependencies** (pinned):

| Package          | Version    | Purpose                         |
|------------------|------------|---------------------------------|
| `tailwindcss`    | `3.4.13`   | CSS utility framework           |
| `autoprefixer`   | `10.4.20`  | PostCSS autoprefixer            |
| `postcss`        | `8.4.49`   | CSS processing                  |
| `@types/node`    | `22.7.4`   | Node types for vite path alias  |

> Note: verify each version is still current before `pnpm add`. All must be exact (no semver ranges).

## Prisma Schema Changes

None — frontend-only ticket.

## Files to CREATE

### Config / Styling
```
apps/web/tailwind.config.js          ← content paths covering src/**
apps/web/postcss.config.js           ← tailwindcss + autoprefixer plugins
apps/web/src/index.css               ← @tailwind base/components/utilities + CSS vars (shadcn/ui tokens)
```

### Lib
```
apps/web/src/lib/utils.ts            ← cn() = tailwind-merge + clsx helper
apps/web/src/lib/queryClient.ts      ← singleton QueryClient (staleTime 1min, retry 1)
apps/web/src/lib/errorMessages.ts    ← error code → user message Record<string,string>
apps/web/src/lib/navigation.ts       ← navigate singleton (setNavigate / getNavigate)
apps/web/src/lib/api.ts              ← Axios instance, request interceptor, 401 retry interceptor
```

### Hooks
```
apps/web/src/hooks/useMinDuration.ts ← returns isPending; enforces 200ms minimum display
```

### Stores
```
apps/web/src/stores/authStore.ts          ← accessToken, user, setAuth, clearAuth
apps/web/src/stores/forgotPasswordStore.ts ← step, email, advance, setEmail, reset
```

### shadcn/ui base components (hand-scaffolded, no CLI)
```
apps/web/src/components/ui/button.tsx    ← Button with Spinner slot (uses cva + @radix-ui/react-slot)
apps/web/src/components/ui/input.tsx     ← Input (styled, forwarded ref)
apps/web/src/components/ui/label.tsx     ← Label (wraps @radix-ui/react-label)
apps/web/src/components/ui/form.tsx      ← Form helpers (FormField, FormItem, FormMessage via react-hook-form context)
```

### Layout
```
apps/web/src/components/layout/AppHeader.tsx  ← logo text + Logout button; hidden on auth routes
apps/web/src/components/layout/AppLayout.tsx  ← <AppHeader> + <main>{children}</main> wrapper
```

### Auth / Guards
```
apps/web/src/components/auth/PrivateRoute.tsx   ← reads authStore; if no token → <Navigate to="/login?next=…" replace />
apps/web/src/components/auth/OtpInput.tsx        ← 6 single-char inputs with auto-advance + backspace; fieldset/legend
apps/web/src/components/auth/NavigationSetter.tsx ← one-time hook component that calls setNavigate(useNavigate()) inside Router
```

### Pages
```
apps/web/src/pages/auth/LoginPage.tsx             ← public route wrapper (redirect if authed)
apps/web/src/pages/auth/LoginForm.tsx             ← react-hook-form + loginSchema + useMutation
apps/web/src/pages/auth/RegisterPage.tsx          ← public route wrapper
apps/web/src/pages/auth/RegisterForm.tsx          ← react-hook-form + registerSchema; auto-login on 201
apps/web/src/pages/auth/ForgotPasswordPage.tsx    ← mounts ForgotPasswordWizard; resets store on unmount
apps/web/src/pages/auth/ForgotPasswordWizard.tsx  ← drives step 1/2/3 via forgotPasswordStore
```

### MSW mocks
```
apps/web/src/mocks/server.ts                  ← setupServer(...handlers) for Vitest
apps/web/src/mocks/handlers/auth.handlers.ts  ← MSW v2 http.post handlers for all auth endpoints
```

### Tests
```
apps/web/src/__tests__/stores/authStore.test.ts              ← unit: setAuth/clearAuth, never touches localStorage
apps/web/src/__tests__/lib/api.interceptor.test.ts           ← UI-AUTH-INTERCEPTOR-S1, S2
apps/web/src/__tests__/hooks/useMinDuration.test.ts          ← UI-AUTH-LOADING-S1
apps/web/src/__tests__/pages/LoginPage.test.tsx              ← UI-AUTH-LOGIN-S1, S2, S3
apps/web/src/__tests__/pages/RegisterPage.test.tsx           ← UI-AUTH-REGISTER-S1, S2, S3
apps/web/src/__tests__/pages/ForgotPasswordPage.test.tsx     ← UI-AUTH-FORGOT-S1, S2, S3, S4
apps/web/src/__tests__/components/AppHeader.test.tsx         ← UI-AUTH-LOGOUT-S1
```

## Files to MODIFY

| File | Change |
|------|--------|
| `apps/web/package.json` | Add all new deps listed above |
| `apps/web/vite.config.ts` | Add `resolve.alias: { '@': path.resolve(__dirname, 'src') }` |
| `apps/web/tsconfig.json` | Add `paths: { "@/*": ["./src/*"] }` under compilerOptions |
| `apps/web/vitest.config.ts` | Add `resolve.alias` matching vite (for `@/` imports in tests) |
| `apps/web/src/App.tsx` | Replace stub with full `<RouterProvider>` tree (see Router tree below) |
| `apps/web/src/main.tsx` | Wrap in `<QueryClientProvider>`, import `index.css`, add `<Toaster />` |
| `apps/web/src/test-setup.ts` | Add MSW `server.listen/resetHandlers/close` lifecycle |

### Router tree in App.tsx
```
createBrowserRouter([
  { path: '/', element: <Navigate to="/notes" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  {
    element: <PrivateRoute><AppLayout /></PrivateRoute>,
    children: [
      { path: '/notes', element: <div>Coming soon</div> },
      { path: '/notes/new', element: <div>Coming soon</div> },
      { path: '/notes/:id', element: <div>Coming soon</div> },
      { path: '/search', element: <div>Coming soon</div> },
    ]
  }
])
```

`<NavigationSetter />` rendered once inside the router (before `<Outlet />`) to wire up the
navigate singleton used by the Axios interceptor.

## Architecture Notes

### Navigate singleton pattern (api.ts ↔ Router)

`navigation.ts` exports `setNavigate(fn)` and `getNavigate()`. The Axios 401 interceptor calls
`getNavigate()?.('/login')` on refresh failure. `<NavigationSetter>` calls `setNavigate` once on
mount (inside the Router, so `useNavigate` is valid). This avoids prop-drilling navigate into the
Axios module and keeps the interceptor pure.

### 401 retry loop guard

`api.ts` marks retried requests with `config._retry = true`. If a request with `_retry = true`
gets another 401 (refresh itself failed), the interceptor does **not** retry again — it calls
`clearAuth()` and navigates to `/login` immediately.

### Public-route redirect

`<LoginPage>` and `<RegisterPage>` read `authStore.accessToken`; if set, render
`<Navigate to="/notes" replace />` before the form mounts. This prevents authenticated users from
seeing auth pages.

### Toaster placement

`<Toaster />` (sonner) rendered in `main.tsx` above `<RouterProvider>` so it is independent of
route transitions.

## Scenario → Test File Mapping

| Scenario ID              | Test file                                      |
|--------------------------|------------------------------------------------|
| UI-AUTH-LOGIN-S1         | `LoginPage.test.tsx`                           |
| UI-AUTH-LOGIN-S2         | `LoginPage.test.tsx`                           |
| UI-AUTH-LOGIN-S3         | `LoginPage.test.tsx`                           |
| UI-AUTH-REGISTER-S1      | `RegisterPage.test.tsx`                        |
| UI-AUTH-REGISTER-S2      | `RegisterPage.test.tsx`                        |
| UI-AUTH-REGISTER-S3      | `RegisterPage.test.tsx`                        |
| UI-AUTH-FORGOT-S1        | `ForgotPasswordPage.test.tsx`                  |
| UI-AUTH-FORGOT-S2        | `ForgotPasswordPage.test.tsx`                  |
| UI-AUTH-FORGOT-S3        | `ForgotPasswordPage.test.tsx`                  |
| UI-AUTH-FORGOT-S4        | `ForgotPasswordPage.test.tsx`                  |
| UI-AUTH-LOGOUT-S1        | `AppHeader.test.tsx`                           |
| UI-AUTH-LOADING-S1       | `useMinDuration.test.ts`                       |
| UI-AUTH-INTERCEPTOR-S1   | `api.interceptor.test.ts`                      |
| UI-AUTH-INTERCEPTOR-S2   | `api.interceptor.test.ts`                      |

## Risk Areas

| Risk | Mitigation |
|------|-----------|
| **Tailwind + Vite PostCSS** — styles don't apply if content paths miss src/ | Set `content: ['./index.html', './src/**/*.{ts,tsx}']` in tailwind.config.js; verify one styled component renders before moving on |
| **React 19 + react-hook-form `<Form>`** — children prop type changed in React 19 | Use `@ts-expect-error` on shadcn Form if needed; react-hook-form 7.54 has React 19 fixes |
| **navigate() called before Router mounts** — `getNavigate()` returns null during app boot | Guard: `getNavigate()?.('/login')` (optional chain); boot-time requests shouldn't 401 |
| **forgotPasswordStore reset in StrictMode** — useEffect cleanup fires twice in dev | `reset()` is idempotent (sets step back to 1); safe under StrictMode |
| **MSW v2 `http` vs `rest`** — v1 handlers break silently with v2 | All handlers use `import { http } from 'msw'` (v2 API); server.ts uses `setupServer` from `msw/node` |
| **Coverage threshold** — new interceptor/store code must hit ≥80% | Interceptor tests cover both success + failure paths; store tests cover setAuth/clearAuth |

## Task Estimate

~8 tasks, each ≤45 min (within session limit — no subagent delegation required):

1. Package installs + Tailwind/PostCSS config + `index.css` + vite/tsconfig path alias
2. `lib/utils.ts`, `lib/queryClient.ts`, `lib/errorMessages.ts`, `lib/navigation.ts`
3. `stores/authStore.ts`, `stores/forgotPasswordStore.ts`, `hooks/useMinDuration.ts`
4. `lib/api.ts` (Axios instance + both interceptors)
5. shadcn/ui base components (`button`, `input`, `label`, `form`)
6. Layout + routing: `AppHeader`, `AppLayout`, `PrivateRoute`, `NavigationSetter`, `App.tsx`, `main.tsx`
7. Auth pages: `LoginPage/Form`, `RegisterPage/Form`, `ForgotPasswordPage/Wizard`, `OtpInput`
8. MSW setup + all test files
