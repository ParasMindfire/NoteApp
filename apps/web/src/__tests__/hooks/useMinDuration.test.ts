import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMinDuration } from '@/hooks/useMinDuration';

describe('useMinDuration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('UI-AUTH-LOADING-S1: isVisible is true while isPending is true', () => {
    const { result } = renderHook(() => useMinDuration(true, 200));
    expect(result.current).toBe(true);
  });

  it('UI-AUTH-LOADING-S1: isVisible stays true for 200ms after isPending becomes false', () => {
    const { result, rerender } = renderHook(
      ({ isPending }: { isPending: boolean }) => useMinDuration(isPending, 200),
      { initialProps: { isPending: true } }
    );
    expect(result.current).toBe(true);

    rerender({ isPending: false });
    // At 0ms after flip — still visible (min duration not elapsed)
    expect(result.current).toBe(true);

    act(() => { vi.advanceTimersByTime(199); });
    expect(result.current).toBe(true);

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(false);
  });

  it('UI-AUTH-LOADING-S1: isVisible becomes false after the minimum duration', () => {
    const { result, rerender } = renderHook(
      ({ isPending }: { isPending: boolean }) => useMinDuration(isPending, 200),
      { initialProps: { isPending: true } }
    );
    rerender({ isPending: false });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe(false);
  });
});
