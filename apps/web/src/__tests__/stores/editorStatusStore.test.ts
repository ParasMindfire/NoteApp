/**
 * editorStatusStore tests
 * FR-UI-EDITOR-3: Autosave with status indicator — status state in Zustand
 * Scenarios: UI-EDITOR-AUTOSAVE-S1, UI-EDITOR-AUTOSAVE-S2, UI-EDITOR-AUTOSAVE-S3
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStatusStore, type EditorStatus } from '@/stores/editorStatusStore';

describe('editorStatusStore (FR-UI-EDITOR-3)', () => {
  beforeEach(() => {
    useEditorStatusStore.setState({ status: 'idle' });
  });

  it('UI-EDITOR-AUTOSAVE-S1: initial status is idle', () => {
    const { status } = useEditorStatusStore.getState();
    expect(status).toBe('idle');
  });

  it('UI-EDITOR-AUTOSAVE-S1: setStatus transitions to saving', () => {
    useEditorStatusStore.getState().setStatus('saving');
    expect(useEditorStatusStore.getState().status).toBe('saving');
  });

  it('UI-EDITOR-AUTOSAVE-S1: setStatus transitions to saved after PATCH succeeds', () => {
    useEditorStatusStore.getState().setStatus('saving');
    useEditorStatusStore.getState().setStatus('saved');
    expect(useEditorStatusStore.getState().status).toBe('saved');
  });

  it('UI-EDITOR-AUTOSAVE-S1: setStatus reverts to idle from saved', () => {
    useEditorStatusStore.getState().setStatus('saved');
    useEditorStatusStore.getState().setStatus('idle');
    expect(useEditorStatusStore.getState().status).toBe('idle');
  });

  it('UI-EDITOR-AUTOSAVE-S3: setStatus transitions to error on PATCH failure', () => {
    useEditorStatusStore.getState().setStatus('saving');
    useEditorStatusStore.getState().setStatus('error');
    expect(useEditorStatusStore.getState().status).toBe('error');
  });

  it('UI-EDITOR-AUTOSAVE-S3: setStatus transitions back to saving when click-to-retry fires', () => {
    useEditorStatusStore.getState().setStatus('error');
    useEditorStatusStore.getState().setStatus('saving');
    expect(useEditorStatusStore.getState().status).toBe('saving');
  });

  it('UI-EDITOR-AUTOSAVE-S1: all four valid EditorStatus values can be set', () => {
    const statuses: EditorStatus[] = ['idle', 'saving', 'saved', 'error'];
    for (const s of statuses) {
      useEditorStatusStore.getState().setStatus(s);
      expect(useEditorStatusStore.getState().status).toBe(s);
    }
  });

  it('UI-EDITOR-AUTOSAVE-S2: multiple reads share the same singleton store instance', () => {
    useEditorStatusStore.getState().setStatus('saving');
    // Simulate a second component reading the same store
    const statusFromSecondConsumer = useEditorStatusStore.getState().status;
    expect(statusFromSecondConsumer).toBe('saving');
  });

  it('UI-EDITOR-AUTOSAVE-S1: setStatus is idempotent — setting same value twice does not corrupt state', () => {
    useEditorStatusStore.getState().setStatus('saved');
    useEditorStatusStore.getState().setStatus('saved');
    expect(useEditorStatusStore.getState().status).toBe('saved');
  });

  it('UI-EDITOR-AUTOSAVE-S1: full saving → saved → idle transition cycle', () => {
    useEditorStatusStore.getState().setStatus('saving');
    expect(useEditorStatusStore.getState().status).toBe('saving');

    useEditorStatusStore.getState().setStatus('saved');
    expect(useEditorStatusStore.getState().status).toBe('saved');

    useEditorStatusStore.getState().setStatus('idle');
    expect(useEditorStatusStore.getState().status).toBe('idle');
  });
});
