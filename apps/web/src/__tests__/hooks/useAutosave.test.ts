/**
 * Tests for useAutosave hook
 * Covers: FR-UI-EDITOR-3, FR-UI-EDITOR-4
 * Scenarios: UI-EDITOR-AUTOSAVE-S1, UI-EDITOR-AUTOSAVE-S2, UI-EDITOR-AUTOSAVE-S3,
 *            UI-EDITOR-RETRY-S1, UI-EDITOR-RETRY-S2
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '@/hooks/useAutosave';
import { useEditorStatusStore } from '@/stores/editorStatusStore';
import { useDraftStore } from '@/stores/draftStore';
import { api } from '@/lib/api';
import { toast } from 'sonner';

vi.mock('@/lib/api', () => ({
  api: { patch: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

const mockNote = {
  id: 'note-1',
  title: 'T',
  body: {},
  tagIds: [],
  tags: [],
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  version: 1,
};

const sampleData = {
  title: 'Test Note',
  body: { type: 'doc', content: [] },
  tagIds: [],
};

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEditorStatusStore.setState({ status: 'idle' });
    useDraftStore.setState({ drafts: {} });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('UI-EDITOR-AUTOSAVE-S2: no PATCH issued before 2s; exactly one PATCH at 2s after last change', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: mockNote });

    const { result } = renderHook(() => useAutosave({ noteId: 'note-1' }));

    act(() => {
      result.current.scheduleAutoSave(sampleData);
    });

    // advance 1999ms — PATCH must NOT have fired
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(vi.mocked(api.patch)).not.toHaveBeenCalled();

    // advance the remaining 1ms — PATCH must fire
    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(vi.mocked(api.patch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.patch)).toHaveBeenCalledWith('/notes/note-1', sampleData);
  });

  it('UI-EDITOR-AUTOSAVE-S2: debounce resets on subsequent calls', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: mockNote });

    const { result } = renderHook(() => useAutosave({ noteId: 'note-1' }));

    act(() => {
      result.current.scheduleAutoSave(sampleData);
    });

    // advance 1500ms (before 2s), then call again — timer should reset
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    act(() => {
      result.current.scheduleAutoSave({ ...sampleData, title: 'Updated' });
    });

    // advance 1999ms more from last call — still no PATCH
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(vi.mocked(api.patch)).not.toHaveBeenCalled();

    // final 1ms — now PATCH fires with latest data
    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(vi.mocked(api.patch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.patch)).toHaveBeenCalledWith('/notes/note-1', {
      ...sampleData,
      title: 'Updated',
    });
  });

  it('UI-EDITOR-AUTOSAVE-S1: status transitions Saving → Saved → idle after PATCH success', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: mockNote });

    const { result } = renderHook(() => useAutosave({ noteId: 'note-1' }));

    act(() => {
      result.current.scheduleAutoSave(sampleData);
    });

    // trigger the debounce
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // after PATCH resolves: status should be 'saved'
    expect(useEditorStatusStore.getState().status).toBe('saved');

    // advance 3000ms — status should revert to 'idle'
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(useEditorStatusStore.getState().status).toBe('idle');
  });

  it('UI-EDITOR-AUTOSAVE-S1: status is "saving" while PATCH is in-flight', async () => {
    let resolvePatch!: (value: unknown) => void;
    vi.mocked(api.patch).mockReturnValueOnce(
      new Promise((res) => {
        resolvePatch = res;
      }),
    );

    const { result } = renderHook(() => useAutosave({ noteId: 'note-1' }));

    act(() => {
      result.current.scheduleAutoSave(sampleData);
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // PATCH in-flight — status should be 'saving'
    expect(useEditorStatusStore.getState().status).toBe('saving');

    // resolve the promise
    await act(async () => {
      resolvePatch({ data: mockNote });
      await Promise.resolve();
    });

    expect(useEditorStatusStore.getState().status).toBe('saved');
  });

  it('UI-EDITOR-AUTOSAVE-S1: clearDraft is called on successful save', async () => {
    useDraftStore.setState({
      drafts: { 'note-1': { title: 'old', body: {}, tagIds: [] } },
    });
    vi.mocked(api.patch).mockResolvedValueOnce({ data: mockNote });

    const { result } = renderHook(() => useAutosave({ noteId: 'note-1' }));

    act(() => {
      result.current.scheduleAutoSave(sampleData);
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(useDraftStore.getState().drafts['note-1']).toBeUndefined();
  });

  it('UI-EDITOR-AUTOSAVE-S1: onSuccess callback is invoked with the returned note', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: mockNote });
    const onSuccess = vi.fn();

    const { result } = renderHook(() =>
      useAutosave({ noteId: 'note-1', onSuccess }),
    );

    act(() => {
      result.current.scheduleAutoSave(sampleData);
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(onSuccess).toHaveBeenCalledWith(mockNote);
  });

  it('UI-EDITOR-RETRY-S1: first failure schedules auto-retry after 5s', async () => {
    vi.mocked(api.patch)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ data: mockNote });

    const { result } = renderHook(() => useAutosave({ noteId: 'note-1' }));

    act(() => {
      result.current.scheduleAutoSave(sampleData);
    });

    // trigger initial save
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // after first failure, no toast yet, no draft yet
    expect(toast.error).not.toHaveBeenCalled();
    expect(useDraftStore.getState().drafts['note-1']).toBeUndefined();

    // advance 5s — retry fires and succeeds
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    // retry succeeded — status should be 'saved', still no toast
    expect(toast.error).not.toHaveBeenCalled();
    expect(useEditorStatusStore.getState().status).toBe('saved');
  });

  it('UI-EDITOR-RETRY-S1: two failures trigger toast + draftStore entry', async () => {
    vi.mocked(api.patch)
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'));

    const { result } = renderHook(() => useAutosave({ noteId: 'note-1' }));

    act(() => {
      result.current.scheduleAutoSave(sampleData);
    });

    // first save attempt
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // 5s retry fires and fails too
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(toast.error).toHaveBeenCalledWith("Couldn't save your changes");
    expect(useEditorStatusStore.getState().status).toBe('error');

    const draft = useDraftStore.getState().drafts['note-1'];
    expect(draft).toBeDefined();
    expect(draft?.title).toBe(sampleData.title);
    expect(draft?.body).toEqual(sampleData.body);
    expect(draft?.tagIds).toEqual(sampleData.tagIds);
  });

  it('UI-EDITOR-RETRY-S2: draft cleared on next successful save', async () => {
    // pre-seed a draft
    useDraftStore.setState({
      drafts: { 'note-1': { title: 'stale', body: {}, tagIds: [] } },
    });
    vi.mocked(api.patch).mockResolvedValueOnce({ data: mockNote });

    const { result } = renderHook(() => useAutosave({ noteId: 'note-1' }));

    act(() => {
      result.current.scheduleAutoSave(sampleData);
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(useDraftStore.getState().drafts['note-1']).toBeUndefined();
  });

  it('UI-EDITOR-AUTOSAVE-S3: retryNow fires PATCH immediately without waiting for debounce', async () => {
    // Setup: first two calls fail to set error state, then success for retry
    vi.mocked(api.patch)
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ data: mockNote });

    const { result } = renderHook(() => useAutosave({ noteId: 'note-1' }));

    act(() => {
      result.current.scheduleAutoSave(sampleData);
    });

    // first attempt
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // auto-retry after 5s (second failure)
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(useEditorStatusStore.getState().status).toBe('error');

    const callsBefore = vi.mocked(api.patch).mock.calls.length;

    // user clicks retry — retryNow should fire immediately (no debounce)
    await act(async () => {
      result.current.retryNow();
      await Promise.resolve();
    });

    expect(vi.mocked(api.patch).mock.calls.length).toBe(callsBefore + 1);
    expect(useEditorStatusStore.getState().status).toBe('saved');
  });

  it('UI-EDITOR-AUTOSAVE-S2: scheduleAutoSave does nothing if noteId is undefined', async () => {
    const { result } = renderHook(() => useAutosave({ noteId: undefined }));

    act(() => {
      result.current.scheduleAutoSave(sampleData);
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(vi.mocked(api.patch)).not.toHaveBeenCalled();
  });

  it('UI-EDITOR-TITLE-S2: scheduleAutoSave blocks autosave when title is empty', async () => {
    const { result } = renderHook(() => useAutosave({ noteId: 'note-1' }));

    act(() => {
      result.current.scheduleAutoSave({ ...sampleData, title: '' });
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(vi.mocked(api.patch)).not.toHaveBeenCalled();
  });

  it('UI-EDITOR-TITLE-S2: scheduleAutoSave blocks autosave when title exceeds 200 chars', async () => {
    const { result } = renderHook(() => useAutosave({ noteId: 'note-1' }));

    act(() => {
      result.current.scheduleAutoSave({
        ...sampleData,
        title: 'a'.repeat(201),
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(vi.mocked(api.patch)).not.toHaveBeenCalled();
  });
});
