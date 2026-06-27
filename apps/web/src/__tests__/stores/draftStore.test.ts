/**
 * draftStore tests
 * FR-UI-EDITOR-4: Autosave failure recovery — draft persistence in Zustand draftStore
 * Scenarios: UI-EDITOR-RETRY-S1, UI-EDITOR-RETRY-S2, UI-EDITOR-DRAFT-S1, UI-EDITOR-DRAFT-S2
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useDraftStore, type Draft } from '@/stores/draftStore';

const FIXTURE_DRAFT: Draft = {
  title: 'My unsaved note',
  body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello' }] }] },
  tagIds: ['tag-1', 'tag-2'],
};

describe('draftStore (FR-UI-EDITOR-4)', () => {
  beforeEach(() => {
    useDraftStore.setState({ drafts: {} });
  });

  // ── UI-EDITOR-RETRY-S1 ─────────────────────────────────────────────────
  it('UI-EDITOR-RETRY-S1: initial drafts map is empty', () => {
    const { drafts } = useDraftStore.getState();
    expect(drafts).toEqual({});
  });

  it('UI-EDITOR-RETRY-S1: setDraft stores a draft keyed by noteId', () => {
    useDraftStore.getState().setDraft('note-abc', FIXTURE_DRAFT);
    const { drafts } = useDraftStore.getState();
    expect(drafts['note-abc']).toEqual(FIXTURE_DRAFT);
  });

  it('UI-EDITOR-RETRY-S1: setDraft persists title, body, and tagIds correctly', () => {
    const draft: Draft = {
      title: 'Test title',
      body: { type: 'doc', content: [] },
      tagIds: ['t1'],
    };
    useDraftStore.getState().setDraft('note-xyz', draft);
    const stored = useDraftStore.getState().drafts['note-xyz'];
    expect(stored?.title).toBe('Test title');
    expect(stored?.body).toEqual({ type: 'doc', content: [] });
    expect(stored?.tagIds).toEqual(['t1']);
  });

  it('UI-EDITOR-RETRY-S1: setDraft overwrites an existing draft for the same noteId', () => {
    useDraftStore.getState().setDraft('note-abc', FIXTURE_DRAFT);
    const updated: Draft = { title: 'Updated', body: { type: 'doc', content: [] }, tagIds: [] };
    useDraftStore.getState().setDraft('note-abc', updated);
    expect(useDraftStore.getState().drafts['note-abc']?.title).toBe('Updated');
  });

  // ── UI-EDITOR-RETRY-S2 ─────────────────────────────────────────────────
  it('UI-EDITOR-RETRY-S2: clearDraft removes the draft for the given noteId', () => {
    useDraftStore.getState().setDraft('note-abc', FIXTURE_DRAFT);
    useDraftStore.getState().clearDraft('note-abc');
    expect(useDraftStore.getState().drafts['note-abc']).toBeUndefined();
  });

  it('UI-EDITOR-RETRY-S2: clearDraft leaves drafts for other noteIds intact', () => {
    useDraftStore.getState().setDraft('note-1', FIXTURE_DRAFT);
    useDraftStore.getState().setDraft('note-2', { title: 'Other', body: {}, tagIds: [] });
    useDraftStore.getState().clearDraft('note-1');
    expect(useDraftStore.getState().drafts['note-1']).toBeUndefined();
    expect(useDraftStore.getState().drafts['note-2']).toBeDefined();
    expect(useDraftStore.getState().drafts['note-2']?.title).toBe('Other');
  });

  it('UI-EDITOR-RETRY-S2: clearDraft is idempotent — clearing a non-existent key does not throw', () => {
    expect(() => useDraftStore.getState().clearDraft('nonexistent-note')).not.toThrow();
    expect(useDraftStore.getState().drafts).toEqual({});
  });

  // ── UI-EDITOR-DRAFT-S1 ─────────────────────────────────────────────────
  it('UI-EDITOR-DRAFT-S1: draft for a noteId is detectable after a failed autosave', () => {
    // Simulate: two PATCH failures → draftStore populated
    useDraftStore.getState().setDraft('note-abc', FIXTURE_DRAFT);
    const hasDraft = 'note-abc' in useDraftStore.getState().drafts;
    expect(hasDraft).toBe(true);
  });

  it('UI-EDITOR-DRAFT-S1: draft is not present for a noteId that was never set', () => {
    const hasDraft = 'note-never-saved' in useDraftStore.getState().drafts;
    expect(hasDraft).toBe(false);
  });

  // ── UI-EDITOR-DRAFT-S2 ─────────────────────────────────────────────────
  it('UI-EDITOR-DRAFT-S2: restored draft values match what was stored', () => {
    const draft: Draft = {
      title: 'Restored title',
      body: { type: 'doc', content: [{ type: 'paragraph' }] },
      tagIds: ['tag-a', 'tag-b'],
    };
    useDraftStore.getState().setDraft('note-restore', draft);
    const stored = useDraftStore.getState().drafts['note-restore'];
    // Simulating what NoteEditorPage would do on "Restore": read these values out
    expect(stored?.title).toBe('Restored title');
    expect(stored?.body).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] });
    expect(stored?.tagIds).toEqual(['tag-a', 'tag-b']);
  });

  it('UI-EDITOR-DRAFT-S2: after restore, clearDraft removes the draft (Dismiss or successful save path)', () => {
    useDraftStore.getState().setDraft('note-restore', FIXTURE_DRAFT);
    // Simulate user clicks Restore → reads draft, then clears it
    useDraftStore.getState().clearDraft('note-restore');
    expect(useDraftStore.getState().drafts['note-restore']).toBeUndefined();
  });

  // ── Multi-note isolation ────────────────────────────────────────────────
  it('UI-EDITOR-RETRY-S1: multiple drafts for different noteIds coexist', () => {
    useDraftStore.getState().setDraft('note-1', { title: 'A', body: {}, tagIds: [] });
    useDraftStore.getState().setDraft('note-2', { title: 'B', body: {}, tagIds: [] });
    useDraftStore.getState().setDraft('note-3', { title: 'C', body: {}, tagIds: [] });
    const { drafts } = useDraftStore.getState();
    expect(Object.keys(drafts)).toHaveLength(3);
    expect(drafts['note-1']?.title).toBe('A');
    expect(drafts['note-2']?.title).toBe('B');
    expect(drafts['note-3']?.title).toBe('C');
  });

  it('UI-EDITOR-RETRY-S2: clearing one draft from a multi-draft map leaves others intact', () => {
    useDraftStore.getState().setDraft('note-1', { title: 'A', body: {}, tagIds: [] });
    useDraftStore.getState().setDraft('note-2', { title: 'B', body: {}, tagIds: [] });
    useDraftStore.getState().clearDraft('note-1');
    const { drafts } = useDraftStore.getState();
    expect(Object.keys(drafts)).toHaveLength(1);
    expect(drafts['note-2']?.title).toBe('B');
  });
});
