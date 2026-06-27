/**
 * Tests for LoginPage + LoginForm
 * Scenarios: UI-AUTH-LOGIN-S1, UI-AUTH-LOGIN-S2, UI-AUTH-LOGIN-S3
 * FRs: FR-UI-AUTH-1, FR-UI-AUTH-2, FR-UI-AUTH-3
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from '@/pages/auth/LoginPage';
import { useAuthStore } from '@/stores/authStore';

function renderLoginPage(initialPath = '/login') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/notes" element={<div>Notes Page</div>} />
          <Route path="/notes/123" element={<div>Note 123</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, user: null });
    vi.clearAllMocks();
  });

  it('UI-AUTH-LOGIN-S1: already-authenticated user is redirected to /notes without seeing the login form', () => {
    // Set auth state BEFORE rendering (covers LoginPage.tsx line 9: if (accessToken) branch)
    useAuthStore.setState({ accessToken: 'existing-token', user: { id: '1', email: 'x@x.com' } });

    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/notes" element={<div>Notes Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // The <Navigate to="/notes" replace /> fires and the login form is replaced
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
    expect(screen.getByText('Notes Page')).toBeInTheDocument();
  });

  it('UI-AUTH-LOGIN-S1: submits credentials, stores token in Zustand (not localStorage), and redirects to ?next= path', async () => {
    const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const user = userEvent.setup();

    renderLoginPage('/login?next=/notes/123');

    const emailInput = screen.getByRole('textbox', { name: /email/i });
    const passwordInput = screen.getByLabelText(/^password$/i);

    await user.type(emailInput, 'user@example.com');
    await user.type(passwordInput, 'Password1');
    // Tab to trigger blur on password so formState.isValid becomes true (mode: 'onBlur')
    await user.tab();

    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Wait for the navigation to the next destination (FR-UI-AUTH-2)
    await waitFor(
      () => {
        expect(screen.getByText('Note 123')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Token stored in Zustand, NOT localStorage (FR-UI-AUTH-2)
    expect(useAuthStore.getState().accessToken).toBe('mock-access-token');
    expect(useAuthStore.getState().user).toEqual({ id: 'user-1', email: 'user@example.com' });
    expect(localStorageSpy).not.toHaveBeenCalled();

    localStorageSpy.mockRestore();
  });

  it('UI-AUTH-LOGIN-S1: redirects to /notes when no ?next= param is present', async () => {
    const user = userEvent.setup();

    renderLoginPage('/login');

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password1');
    await user.tab();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(
      () => {
        expect(screen.getByText('Notes Page')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('UI-AUTH-LOGIN-S2: shows "Invalid email or password", clears password field, and retains email on 401 (FR-UI-AUTH-3)', async () => {
    const user = userEvent.setup();

    renderLoginPage('/login');

    const emailInput = screen.getByRole('textbox', { name: /email/i });
    const passwordInput = screen.getByLabelText(/^password$/i);

    await user.type(emailInput, 'user@example.com');
    await user.type(passwordInput, 'WrongPassword1');
    await user.tab();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    // Wait for error to appear (the onError handler sets a form error on password field)
    // NOTE: The api.ts interceptor will first try refresh (MSW returns 200 with new token),
    // then retry login (still gets 401), then clearAuth + reject. onError then fires.
    await waitFor(
      () => {
        expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Email field retains its value (FR-UI-AUTH-3)
    expect(emailInput).toHaveValue('user@example.com');

    // Password field is cleared (onError calls form.setValue('password', ''))
    expect(passwordInput).toHaveValue('');
  });

  it('UI-AUTH-LOGIN-S2: focuses password field after 401 error (FR-UI-AUTH-3)', async () => {
    const user = userEvent.setup();

    renderLoginPage('/login');

    const passwordInput = screen.getByLabelText(/^password$/i);

    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.type(passwordInput, 'WrongPassword1');
    await user.tab();

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(
      () => {
        expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Focus returns to password input (via setTimeout in onError)
    await waitFor(
      () => {
        expect(document.activeElement).toBe(passwordInput);
      },
      { timeout: 1000 }
    );
  });

  it('UI-AUTH-LOGIN-S3: shows inline error on blur with invalid email, submit button stays disabled (FR-UI-AUTH-1)', async () => {
    const user = userEvent.setup();

    renderLoginPage('/login');

    const emailInput = screen.getByRole('textbox', { name: /email/i });
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Initially the button is disabled (form has not been validated yet)
    expect(submitButton).toBeDisabled();

    // Type an invalid email and blur to trigger validation
    await user.click(emailInput);
    await user.type(emailInput, 'not-an-email');
    await user.tab(); // blur → Zod validation fires

    // Inline error: Zod's default email validation message is "Invalid email"
    await waitFor(() => {
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
    });

    // Submit button remains disabled (email is invalid)
    expect(submitButton).toBeDisabled();

    // Email input gains aria-invalid="true"
    expect(emailInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('UI-AUTH-LOGIN-S3: submit button is disabled when form has validation errors (FR-UI-AUTH-1)', async () => {
    const user = userEvent.setup();

    renderLoginPage('/login');

    const passwordInput = screen.getByLabelText(/^password$/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });

    // Type valid email but short password (less than 8 chars), then blur
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'user@example.com');
    await user.type(passwordInput, 'numb3r'); // < 8 chars
    await user.tab();

    await waitFor(() => {
      // Button is disabled when form is invalid
      expect(submitButton).toBeDisabled();
    });
  });
});
