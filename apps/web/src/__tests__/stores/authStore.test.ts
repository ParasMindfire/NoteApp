import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import { useForgotPasswordStore } from '@/stores/forgotPasswordStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, user: null });
  });

  it('setAuth stores accessToken and user in Zustand state', () => {
    useAuthStore.getState().setAuth('tok-123', { id: '1', email: 'a@b.com' });
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('tok-123');
    expect(state.user).toEqual({ id: '1', email: 'a@b.com' });
  });

  it('clearAuth resets accessToken and user to null', () => {
    useAuthStore.getState().setAuth('tok-123', { id: '1', email: 'a@b.com' });
    useAuthStore.getState().clearAuth();
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('UI-AUTH-LOGIN-S1: localStorage.setItem is never called when storing token (FR-UI-AUTH-2)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    useAuthStore.getState().setAuth('tok-123', { id: '1', email: 'a@b.com' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('forgotPasswordStore', () => {
  beforeEach(() => {
    useForgotPasswordStore.setState({ step: 1, email: '' });
  });

  it('initial state is step=1 and email empty', () => {
    const state = useForgotPasswordStore.getState();
    expect(state.step).toBe(1);
    expect(state.email).toBe('');
  });

  it('setEmail updates the email field', () => {
    useForgotPasswordStore.getState().setEmail('test@example.com');
    expect(useForgotPasswordStore.getState().email).toBe('test@example.com');
  });

  it('advance() increments step 1→2→3', () => {
    const store = useForgotPasswordStore.getState();
    store.advance();
    expect(useForgotPasswordStore.getState().step).toBe(2);
    useForgotPasswordStore.getState().advance();
    expect(useForgotPasswordStore.getState().step).toBe(3);
  });

  it('advance() caps at step 3 (idempotent ceiling)', () => {
    useForgotPasswordStore.setState({ step: 3, email: '' });
    useForgotPasswordStore.getState().advance();
    expect(useForgotPasswordStore.getState().step).toBe(3);
  });

  it('reset() returns to step=1 and email empty', () => {
    useForgotPasswordStore.setState({ step: 3, email: 'x@y.com' });
    useForgotPasswordStore.getState().reset();
    const state = useForgotPasswordStore.getState();
    expect(state.step).toBe(1);
    expect(state.email).toBe('');
  });

  it('reset() is idempotent — calling twice gives same result', () => {
    useForgotPasswordStore.setState({ step: 3, email: 'x@y.com' });
    useForgotPasswordStore.getState().reset();
    useForgotPasswordStore.getState().reset();
    const state = useForgotPasswordStore.getState();
    expect(state.step).toBe(1);
    expect(state.email).toBe('');
  });
});
