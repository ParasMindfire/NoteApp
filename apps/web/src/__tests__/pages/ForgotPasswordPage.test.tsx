/**
 * Tests for ForgotPasswordPage + ForgotPasswordWizard + OtpInput
 * Scenarios: UI-AUTH-FORGOT-S1, UI-AUTH-FORGOT-S2, UI-AUTH-FORGOT-S3, UI-AUTH-FORGOT-S4
 * FRs: FR-UI-AUTH-5
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { useForgotPasswordStore } from '@/stores/forgotPasswordStore';

function renderForgotPasswordPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/forgot-password']}>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    useForgotPasswordStore.setState({ step: 1, email: '' });
    vi.clearAllMocks();
  });

  it('UI-AUTH-FORGOT-S1: always advances to step 2 after email submission (even on 4xx), never leaks account existence', async () => {
    const user = userEvent.setup();

    // Test with 200 response
    renderForgotPasswordPage();

    // Step 1: email field should be visible
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/digit 1 of 6/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/email address/i), 'anyemail@example.com');
    await user.click(screen.getByRole('button', { name: /send reset code/i }));

    // Step 2 should be shown regardless
    await waitFor(() => {
      expect(screen.getByLabelText(/digit 1 of 6/i)).toBeInTheDocument();
    });
  });

  it('UI-AUTH-FORGOT-S1: advances to step 2 even on 429 rate-limited response (no account existence leak)', async () => {
    const user = userEvent.setup();

    // Override to return 429 RATE_LIMITED
    server.use(
      http.post('http://localhost:4000/auth/forgot-password', async () => {
        return HttpResponse.json({ code: 'RATE_LIMITED' }, { status: 429 });
      })
    );

    renderForgotPasswordPage();

    await user.type(screen.getByLabelText(/email address/i), 'ratelimited@example.com');
    await user.click(screen.getByRole('button', { name: /send reset code/i }));

    // Even on 429, step 2 should appear (rate limited code is not a network error)
    await waitFor(() => {
      expect(screen.getByLabelText(/digit 1 of 6/i)).toBeInTheDocument();
    });
  });

  it('UI-AUTH-FORGOT-S2: typing a digit in OTP box advances focus to the next box', async () => {
    const user = userEvent.setup();

    // Jump directly to step 2 by setting the store
    useForgotPasswordStore.setState({ step: 2, email: 'test@example.com' });

    renderForgotPasswordPage();

    // Confirm we're on step 2 - OTP inputs are visible
    await waitFor(() => {
      expect(screen.getByLabelText('Digit 1 of 6')).toBeInTheDocument();
    });

    const digit1 = screen.getByLabelText('Digit 1 of 6');
    const digit2 = screen.getByLabelText('Digit 2 of 6');

    // Type digit into first box
    digit1.focus();
    await user.type(digit1, '5');

    // Focus should advance to the next input
    await waitFor(() => {
      expect(document.activeElement).toBe(digit2);
    });
  });

  it('UI-AUTH-FORGOT-S3: shows "Invalid or expired code. Please try again." on 401 AUTH_OTP_INVALID, stays on step 2', async () => {
    const user = userEvent.setup();

    // Override to return 401 AUTH_OTP_INVALID for wrong OTP
    server.use(
      http.post(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/auth/reset-password`, async () => {
        return HttpResponse.json({ code: 'AUTH_OTP_INVALID' }, { status: 401 });
      })
    );

    // Start on step 2 directly
    useForgotPasswordStore.setState({ step: 2, email: 'test@example.com' });

    renderForgotPasswordPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Digit 1 of 6')).toBeInTheDocument();
    });

    // Type a 6-digit OTP (wrong one)
    const otpInputs = [
      screen.getByLabelText('Digit 1 of 6'),
      screen.getByLabelText('Digit 2 of 6'),
      screen.getByLabelText('Digit 3 of 6'),
      screen.getByLabelText('Digit 4 of 6'),
      screen.getByLabelText('Digit 5 of 6'),
      screen.getByLabelText('Digit 6 of 6'),
    ];

    for (let i = 0; i < 6; i++) {
      otpInputs[i]!.focus();
      await user.type(otpInputs[i]!, String(i));
    }

    // Fill in a new password
    await user.type(screen.getByLabelText(/new password/i), 'NewPassword1');

    // Submit
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    // Error message for wrong OTP
    await waitFor(() => {
      expect(screen.getByText('Invalid or expired code. Please try again.')).toBeInTheDocument();
    });

    // Still on step 2 (OTP input still visible)
    expect(screen.getByLabelText('Digit 1 of 6')).toBeInTheDocument();
  });

  it('UI-AUTH-FORGOT-S4: shows step 3 success screen on valid OTP, then navigates to /login on button click', async () => {
    const user = userEvent.setup();

    // Override to return 204 success
    server.use(
      http.post(`${import.meta.env.VITE_API_URL ?? 'http://localhost:4000'}/auth/reset-password`, async () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    // Start on step 2
    useForgotPasswordStore.setState({ step: 2, email: 'test@example.com' });

    renderForgotPasswordPage();

    await waitFor(() => {
      expect(screen.getByLabelText('Digit 1 of 6')).toBeInTheDocument();
    });

    // Type a valid 6-digit OTP
    const otpInputs = [
      screen.getByLabelText('Digit 1 of 6'),
      screen.getByLabelText('Digit 2 of 6'),
      screen.getByLabelText('Digit 3 of 6'),
      screen.getByLabelText('Digit 4 of 6'),
      screen.getByLabelText('Digit 5 of 6'),
      screen.getByLabelText('Digit 6 of 6'),
    ];

    for (let i = 0; i < 6; i++) {
      otpInputs[i]!.focus();
      await user.type(otpInputs[i]!, String(i + 1));
    }

    await user.type(screen.getByLabelText(/new password/i), 'NewPassword1');
    await user.click(screen.getByRole('button', { name: /reset password/i }));

    // Step 3: success screen shown
    await waitFor(() => {
      expect(screen.getByText(/password reset/i)).toBeInTheDocument();
    });

    // Click "Back to login" navigates to /login
    await user.click(screen.getByRole('button', { name: /back to login/i }));

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });
});
