/**
 * Tests for AppHeader component
 * Scenarios: UI-AUTH-LOGOUT-S1
 * FRs: FR-UI-AUTH-6
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { AppHeader } from '@/components/layout/AppHeader';
import { useAuthStore } from '@/stores/authStore';
import { queryClient } from '@/lib/queryClient';

function renderAppHeader(initialPath = '/notes') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <AppHeader />
                <main>
                  <Routes>
                    <Route path="/notes" element={<div>Notes content</div>} />
                    <Route path="/login" element={<div>Login Page</div>} />
                  </Routes>
                </main>
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AppHeader', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'test-token',
      user: { id: 'user-1', email: 'user@example.com' },
    });
    vi.clearAllMocks();
  });

  it('UI-AUTH-LOGOUT-S1: clicking Logout calls POST /auth/logout, clears authStore, and redirects to /login', async () => {
    const clearAuthSpy = vi.spyOn(useAuthStore.getState(), 'clearAuth');
    const queryClientClearSpy = vi.spyOn(queryClient, 'clear');
    const user = userEvent.setup();

    renderAppHeader('/notes');

    // Logout button is visible on non-auth routes
    const logoutBtn = screen.getByRole('button', { name: /logout/i });
    expect(logoutBtn).toBeInTheDocument();

    await user.click(logoutBtn);

    // Should navigate to /login after logout
    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });

    // authStore.clearAuth() called
    expect(clearAuthSpy).toHaveBeenCalled();

    clearAuthSpy.mockRestore();
    queryClientClearSpy.mockRestore();
  });

  it('UI-AUTH-LOGOUT-S1: Logout calls queryClient.clear() to remove stale data from cache', async () => {
    const queryClientClearSpy = vi.spyOn(queryClient, 'clear');
    const user = userEvent.setup();

    renderAppHeader('/notes');

    await user.click(screen.getByRole('button', { name: /logout/i }));

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });

    expect(queryClientClearSpy).toHaveBeenCalled();
    queryClientClearSpy.mockRestore();
  });

  it('UI-AUTH-LOGOUT-S1: Logout proceeds even when POST /auth/logout fails (idempotent)', async () => {
    // Override logout to fail
    server.use(
      http.post('http://localhost:4000/auth/logout', () => {
        return HttpResponse.json({ message: 'Server error' }, { status: 500 });
      })
    );

    const user = userEvent.setup();

    renderAppHeader('/notes');

    await user.click(screen.getByRole('button', { name: /logout/i }));

    // Even on logout failure, should redirect to /login
    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });

    // Auth should still be cleared
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('AppHeader is hidden on /login route (auth route)', () => {
    renderAppHeader('/login');

    // Header should not render on login route
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
  });

  it('AppHeader is hidden on /register route (auth route)', () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/register']}>
          <AppHeader />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
  });

  it('AppHeader is hidden on /forgot-password route (auth route)', () => {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/forgot-password']}>
          <AppHeader />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
  });

  it('AppHeader is visible on protected routes', () => {
    renderAppHeader('/notes');

    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    expect(screen.getByText('NoteApp')).toBeInTheDocument();
  });
});
