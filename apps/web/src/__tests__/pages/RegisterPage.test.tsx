/**
 * Tests for RegisterPage + RegisterForm
 * Scenarios: UI-AUTH-REGISTER-S1, UI-AUTH-REGISTER-S2, UI-AUTH-REGISTER-S3
 * FRs: FR-UI-AUTH-4
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { RegisterPage } from '@/pages/auth/RegisterPage';
// http and HttpResponse used via server.use() overrides in specific tests
import { useAuthStore } from '@/stores/authStore';

function renderRegisterPage(initialPath = '/register') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/notes" element={<div>Notes Page</div>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, user: null });
    vi.clearAllMocks();
  });

  it('UI-AUTH-REGISTER-S1: already-authenticated user is redirected to /notes without seeing the register form', () => {
    // Set auth state BEFORE rendering (covers RegisterPage.tsx line 9: if (accessToken) branch)
    useAuthStore.setState({ accessToken: 'existing-token', user: { id: '1', email: 'x@x.com' } });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/register']}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/notes" element={<div>Notes Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // The <Navigate to="/notes" replace /> fires and the register form is replaced
    expect(screen.queryByRole('button', { name: /create account/i })).not.toBeInTheDocument();
    expect(screen.getByText('Notes Page')).toBeInTheDocument();
  });

  it('UI-AUTH-REGISTER-S1: successful register auto-logins and redirects to /notes with token in Zustand', async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();

    // Override the register handler to return 201 for a new email
    server.use(
      http.post(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/auth/register`, async ({ request }) => {
        const body = (await request.json()) as { email: string; password: string };
        if (body.email === 'new@example.com') {
          return new HttpResponse(null, { status: 201 });
        }
        return HttpResponse.json({ code: 'USER_EXISTS' }, { status: 409 });
      }),
      http.post(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/auth/login`, async ({ request }) => {
        const body = (await request.json()) as { email: string; password: string };
        if (body.email === 'new@example.com' && body.password === 'Password1') {
          return HttpResponse.json({
            accessToken: 'new-user-token',
            user: { id: 'new-user-id', email: 'new@example.com' },
          });
        }
        return HttpResponse.json({ code: 'AUTH_INVALID_CREDENTIALS' }, { status: 401 });
      })
    );

    renderRegisterPage('/register');

    const emailInput = screen.getByRole('textbox', { name: /email/i });
    const passwordInput = screen.getByLabelText(/^password$/i);

    await user.type(emailInput, 'new@example.com');
    await user.type(passwordInput, 'Password1');
    // Tab to trigger blur on password and make form valid
    await user.tab();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Should redirect to /notes on success
    await waitFor(
      () => {
        expect(screen.getByText('Notes Page')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Access token stored in Zustand (not localStorage)
    expect(useAuthStore.getState().accessToken).toBe('new-user-token');
    expect(useAuthStore.getState().user).toEqual({ id: 'new-user-id', email: 'new@example.com' });
    expect(localStorageSpy).not.toHaveBeenCalled();

    localStorageSpy.mockRestore();
  });

  it('UI-AUTH-REGISTER-S2: shows "Account already exists. Try logging in." with link on 409 USER_EXISTS', async () => {
    const user = userEvent.setup();

    // 409 does not go through the 401 interceptor, so no refresh override needed
    server.use(
      http.post(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/auth/register`, async () => {
        return HttpResponse.json({ code: 'USER_EXISTS' }, { status: 409 });
      })
    );

    renderRegisterPage('/register');

    const emailInput = screen.getByRole('textbox', { name: /email/i });
    const passwordInput = screen.getByLabelText(/^password$/i);

    await user.type(emailInput, 'existing@example.com');
    await user.type(passwordInput, 'Password1');
    await user.tab();

    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Error message shown — rendered via FormMessage for the email field
    await waitFor(
      () => {
        expect(
          screen.getByText('Account already exists. Try logging in.')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Link to /login is rendered (inside the conditional "Go to login" link)
    const loginLink = screen.getByRole('link', { name: /go to login/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('UI-AUTH-REGISTER-S3: shows password error on blur when password has no number', async () => {
    const user = userEvent.setup();

    renderRegisterPage('/register');

    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitButton = screen.getByRole('button', { name: /create account/i });

    // Initially disabled (form not yet validated)
    expect(submitButton).toBeDisabled();

    // Type a valid email first
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    // Type password without a number
    await user.type(passwordInput, 'NoNumberHere');
    // Blur the password field to trigger validation
    await user.tab();

    // Inline error should appear — from the shared Zod schema (exact message)
    // registerSchema uses .regex(/\d/, 'password must contain at least 1 number')
    await waitFor(
      () => {
        expect(screen.getByText('password must contain at least 1 number')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    // Submit button remains disabled (password validation fails)
    expect(submitButton).toBeDisabled();
  });
});
