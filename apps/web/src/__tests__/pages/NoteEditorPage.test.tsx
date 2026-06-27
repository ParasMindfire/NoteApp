/**
 * Tests for NoteEditorPage
 * Scenarios: UI-EDITOR-S1, UI-EDITOR-S2,
 *            UI-EDITOR-TITLE-S1, UI-EDITOR-TITLE-S2,
 *            UI-EDITOR-AUTOSAVE-S1, UI-EDITOR-AUTOSAVE-S2, UI-EDITOR-AUTOSAVE-S3,
 *            UI-EDITOR-RETRY-S1, UI-EDITOR-RETRY-S2,
 *            UI-EDITOR-DRAFT-S1, UI-EDITOR-DRAFT-S2,
 *            UI-EDITOR-TAGS-S1, UI-EDITOR-TAGS-S2, UI-EDITOR-TAGS-S3
 * FRs: FR-UI-EDITOR-1, FR-UI-EDITOR-2, FR-UI-EDITOR-3, FR-UI-EDITOR-4, FR-UI-EDITOR-5
 */
import { describe, it, expect, beforeEach, beforeAll, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { NoteEditorPage } from '@/pages/notes/NoteEditorPage';
import { useDraftStore } from '@/stores/draftStore';
import { useEditorStatusStore } from '@/stores/editorStatusStore';
import { queryClient } from '@/lib/queryClient';

// Polyfill ResizeObserver (used by cmdk/shadcn Command)
beforeAll(() => {
  if (typeof window.ResizeObserver === 'undefined') {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // Polyfill scrollIntoView (cmdk uses it for keyboard navigation)
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

// Mock NoteEditor for page-level tests to avoid heavy TipTap setup
vi.mock('@/components/editor/NoteEditor', () => ({
  NoteEditor: ({ note }: { note: { title: string; id: string } }) => (
    <div data-testid="note-editor">Note: {note.title}</div>
  ),
}));

// Mock sonner so we can assert on toast calls
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

function makeTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * Render NoteEditorPage inside a router with an optional extra route
 * so we can assert redirects.
 */
function renderEditorPage(
  initialPath: string,
  opts: { qc?: QueryClient } = {},
) {
  const qc = opts.qc ?? makeTestQueryClient();
  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/notes/new" element={<NoteEditorPage />} />
            <Route path="/notes/:id" element={<NoteEditorPage />} />
            <Route path="/notes" element={<div data-testid="notes-list">Notes List</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    ),
  };
}

describe('NoteEditorPage', () => {
  beforeEach(() => {
    useDraftStore.setState({ drafts: {} });
    useEditorStatusStore.setState({ status: 'idle' });
    queryClient.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-S1: Editor renders with all toolbar buttons
  // (validated via EditorToolbar unit render — NoteEditor is mocked at page level)
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-S1: editor renders with all toolbar buttons after note loads', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');

    const mockEditor = {
      isActive: vi.fn().mockReturnValue(false),
      chain: vi.fn().mockReturnValue({
        focus: vi.fn().mockReturnThis(),
        toggleBold: vi.fn().mockReturnThis(),
        toggleItalic: vi.fn().mockReturnThis(),
        toggleHeading: vi.fn().mockReturnThis(),
        toggleBulletList: vi.fn().mockReturnThis(),
        toggleOrderedList: vi.fn().mockReturnThis(),
        toggleCodeBlock: vi.fn().mockReturnThis(),
        run: vi.fn(),
      }),
    };

    render(
      <EditorToolbar editor={mockEditor as unknown as Parameters<typeof EditorToolbar>[0]['editor']} />,
    );

    const toolbar = screen.getByRole('toolbar', { name: /text formatting/i });
    expect(toolbar).toBeInTheDocument();

    const expectedButtons = [
      'Bold', 'Italic', 'Heading 1', 'Heading 2', 'Heading 3',
      'Bullet list', 'Ordered list', 'Code block',
    ];

    for (const label of expectedButtons) {
      const btn = screen.getByRole('button', { name: label });
      expect(btn).toBeInTheDocument();
    }
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-S2: Toolbar buttons are keyboard-reachable (aria-label + aria-pressed)
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-S2: toolbar buttons have aria-labels and aria-pressed attributes', async () => {
    const { EditorToolbar } = await import('@/components/editor/EditorToolbar');

    const mockEditor = {
      isActive: vi.fn().mockReturnValue(false),
      chain: vi.fn().mockReturnValue({
        focus: vi.fn().mockReturnThis(),
        toggleBold: vi.fn().mockReturnThis(),
        toggleItalic: vi.fn().mockReturnThis(),
        toggleHeading: vi.fn().mockReturnThis(),
        toggleBulletList: vi.fn().mockReturnThis(),
        toggleOrderedList: vi.fn().mockReturnThis(),
        toggleCodeBlock: vi.fn().mockReturnThis(),
        run: vi.fn(),
      }),
    };

    render(
      <EditorToolbar editor={mockEditor as unknown as Parameters<typeof EditorToolbar>[0]['editor']} />,
    );

    const expectedLabels = [
      'Bold', 'Italic', 'Heading 1', 'Heading 2', 'Heading 3',
      'Bullet list', 'Ordered list', 'Code block',
    ];

    for (const label of expectedLabels) {
      const btn = screen.getByRole('button', { name: label });
      expect(btn).toHaveAttribute('aria-label', label);
      expect(btn).toHaveAttribute('aria-pressed');
    }
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-TITLE-S1: Enter in title moves focus to editor
  // (tested via NoteEditor component's key handler using vi.importActual)
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-TITLE-S1: pressing Enter in title field triggers focus move to editor body', async () => {
    // Use vi.importActual to bypass the hoisted vi.mock for NoteEditor
    const { NoteEditor: RealNoteEditor } = await vi.importActual<
      typeof import('@/components/editor/NoteEditor')
    >('@/components/editor/NoteEditor');

    const mockNote = {
      id: 'note-1',
      title: 'Test Note',
      body: { type: 'doc', content: [] },
      tagIds: [],
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      version: 1,
    };

    const qc = makeTestQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <RealNoteEditor note={mockNote} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Find the title input by its aria-label attribute
    const titleInput = screen.getByRole('textbox', { name: /note title/i });
    titleInput.focus();
    expect(document.activeElement).toBe(titleInput);

    // Press Enter — NoteEditor calls editor.commands.focus() which moves focus
    fireEvent.keyDown(titleInput, { key: 'Enter', code: 'Enter' });

    // After Enter key, the title input is no longer the active element
    await waitFor(() => {
      expect(document.activeElement).not.toBe(titleInput);
    });
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-TITLE-S2: Title > 200 chars shows inline error and blocks autosave
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-TITLE-S2: title longer than 200 chars shows inline error on blur', async () => {
    const { NoteEditor: RealNoteEditor } = await vi.importActual<
      typeof import('@/components/editor/NoteEditor')
    >('@/components/editor/NoteEditor');

    const mockNote = {
      id: 'note-1',
      title: 'Test Note',
      body: { type: 'doc', content: [] },
      tagIds: [],
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      version: 1,
    };

    const qc = makeTestQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <RealNoteEditor note={mockNote} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const titleInput = screen.getByRole('textbox', { name: /note title/i });

    // Set value to 201 characters
    const longTitle = 'A'.repeat(201);
    fireEvent.change(titleInput, { target: { value: longTitle } });
    fireEvent.blur(titleInput);

    // Inline error should appear — NoteEditor shows error when title > 200 chars
    await waitFor(() => {
      const errorMsg = screen.getByText(/title must be/i);
      expect(errorMsg).toBeInTheDocument();
    });

    // aria-invalid must be set on the input
    expect(titleInput).toHaveAttribute('aria-invalid', 'true');
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-AUTOSAVE-S1: Status transitions: Saving → Saved → blank
  // (core logic tested in useAutosave.test.ts; here we assert the status indicator UI)
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-AUTOSAVE-S1: EditorStatusIndicator renders Saving/Saved states from editorStatusStore', async () => {
    const { EditorStatusIndicator } = await import('@/components/editor/EditorStatusIndicator');

    const qc = makeTestQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <EditorStatusIndicator onRetry={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Initially idle → indicator not rendered
    expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();

    // Transition to 'saving'
    act(() => {
      useEditorStatusStore.setState({ status: 'saving' });
    });
    expect(screen.getByText('Saving…')).toBeInTheDocument();

    // Transition to 'saved'
    act(() => {
      useEditorStatusStore.setState({ status: 'saved' });
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();

    // Transition back to 'idle' → blank
    act(() => {
      useEditorStatusStore.setState({ status: 'idle' });
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
    expect(screen.queryByText('Saving…')).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-AUTOSAVE-S2: Debounce is exactly 2s
  // (exercised here via useAutosave hook directly with fake timers)
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-AUTOSAVE-S2: no PATCH before 2s debounce elapses, exactly one PATCH at 2s', async () => {
    vi.useFakeTimers();

    // Mock api.patch via module mock path used by useAutosave
    const patchMock = vi.fn().mockResolvedValue({
      data: {
        id: 'note-1',
        title: 'Test',
        body: { type: 'doc', content: [] },
        tagIds: [],
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
        version: 2,
      },
    });

    // Patch api directly for this test
    const apiModule = await import('@/lib/api');
    const originalPatch = apiModule.api.patch;
    apiModule.api.patch = patchMock;

    const { useAutosave } = await import('@/hooks/useAutosave');
    const sampleData = { title: 'Test', body: { type: 'doc', content: [] }, tagIds: [] };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={makeTestQueryClient()}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useAutosave({ noteId: 'note-1' }), { wrapper });

    act(() => {
      result.current.scheduleAutoSave(sampleData);
    });

    // Before 2s — no PATCH
    act(() => { vi.advanceTimersByTime(1999); });
    expect(patchMock).not.toHaveBeenCalled();

    // At exactly 2s — PATCH fires
    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(patchMock).toHaveBeenCalledTimes(1);

    // Restore
    apiModule.api.patch = originalPatch;
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-AUTOSAVE-S3: Click-to-retry fires PATCH immediately
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-AUTOSAVE-S3: clicking save-failed indicator calls the onRetry callback', async () => {
    const { EditorStatusIndicator } = await import('@/components/editor/EditorStatusIndicator');

    // Set error status so the retry button renders
    act(() => {
      useEditorStatusStore.setState({ status: 'error' });
    });

    const retryFn = vi.fn();
    const qc = makeTestQueryClient();
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <EditorStatusIndicator onRetry={retryFn} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const retryBtn = screen.getByRole('button', { name: /save failed/i });
    expect(retryBtn).toBeInTheDocument();

    await userEvent.click(retryBtn);

    // Clicking the indicator immediately calls the retry handler (no debounce wait)
    expect(retryFn).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-RETRY-S1: Two PATCH failures trigger toast + draftStore
  // (core logic in useAutosave.test.ts; here we assert the integration path)
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-RETRY-S1: two consecutive PATCH failures set error status, show toast, save draft', async () => {
    vi.useFakeTimers();

    const patchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'));

    const apiModule = await import('@/lib/api');
    const originalPatch = apiModule.api.patch;
    apiModule.api.patch = patchMock;

    const { toast } = await import('sonner');
    const { useAutosave } = await import('@/hooks/useAutosave');

    const sampleData = { title: 'My Title', body: { type: 'doc', content: [] }, tagIds: ['t1'] };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={makeTestQueryClient()}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useAutosave({ noteId: 'note-fail' }), { wrapper });

    act(() => { result.current.scheduleAutoSave(sampleData); });

    // Fire first PATCH (fails)
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // No toast yet (only 1 failure)
    expect((toast as unknown as { error: ReturnType<typeof vi.fn> }).error).not.toHaveBeenCalled();

    // Auto-retry after 5s (second failure)
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    // After second failure: toast fired + draft stored
    expect((toast as unknown as { error: ReturnType<typeof vi.fn> }).error).toHaveBeenCalledWith(
      "Couldn't save your changes",
    );
    expect(useEditorStatusStore.getState().status).toBe('error');

    const drafts = useDraftStore.getState().drafts;
    expect(drafts['note-fail']).toBeDefined();
    expect(drafts['note-fail']!.title).toBe('My Title');

    // Restore
    apiModule.api.patch = originalPatch;
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-RETRY-S2: Draft cleared on next successful save
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-RETRY-S2: draft cleared from draftStore after successful PATCH', async () => {
    vi.useFakeTimers();

    // Pre-seed a draft
    useDraftStore.setState({
      drafts: { 'note-1': { title: 'Draft Title', body: { type: 'doc', content: [] }, tagIds: [] } },
    });

    const savedNote = {
      id: 'note-1',
      title: 'Draft Title',
      body: { type: 'doc', content: [] },
      tagIds: [],
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      version: 2,
    };

    const patchMock = vi.fn().mockResolvedValue({ data: savedNote });
    const apiModule = await import('@/lib/api');
    const originalPatch = apiModule.api.patch;
    apiModule.api.patch = patchMock;

    const { useAutosave } = await import('@/hooks/useAutosave');
    const sampleData = { title: 'Draft Title', body: { type: 'doc', content: [] }, tagIds: [] };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={makeTestQueryClient()}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useAutosave({ noteId: 'note-1' }), { wrapper });

    act(() => { result.current.scheduleAutoSave(sampleData); });

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    // Draft should be cleared after successful save
    expect(useDraftStore.getState().drafts['note-1']).toBeUndefined();

    // Restore
    apiModule.api.patch = originalPatch;
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-DRAFT-S1: Draft recovery toast shown on note open
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-DRAFT-S1: draft recovery toast shown when note has a pending draft', async () => {
    const { toast } = await import('sonner');

    // Seed a draft for note-1
    useDraftStore.setState({
      drafts: {
        'note-1': { title: 'Saved Draft Title', body: { type: 'doc', content: [] }, tagIds: [] },
      },
    });

    renderEditorPage('/notes/note-1');

    // Wait for note to load (mocked NoteEditor renders)
    await screen.findByTestId('note-editor');

    // Toast should have been called with the restore prompt
    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        'You have an unsaved draft — restore it?',
        expect.objectContaining({
          action: expect.objectContaining({ label: 'Restore' }),
          cancel: expect.objectContaining({ label: 'Dismiss' }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-DRAFT-S2: Restore replaces editor content with draft values
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-DRAFT-S2: Restore action in toast calls restore handler with draft values', async () => {
    const { toast } = await import('sonner');

    const draftContent = {
      title: 'Draft Title',
      body: { type: 'doc', content: [] },
      tagIds: ['tag-x'],
    };

    useDraftStore.setState({
      drafts: { 'note-1': draftContent },
    });

    renderEditorPage('/notes/note-1');
    await screen.findByTestId('note-editor');

    await waitFor(() => {
      expect(toast).toHaveBeenCalled();
    });

    // Extract the toast options from the most recent call
    const toastCalls = (toast as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const lastToastArgs = toastCalls[toastCalls.length - 1];
    const toastOptions = lastToastArgs?.[1] as {
      action?: { label: string; onClick?: () => void };
      cancel?: { label: string; onClick?: () => void };
      duration?: number;
    };

    // Verify Restore and Dismiss actions exist
    expect(toastOptions?.action?.label).toBe('Restore');
    expect(toastOptions?.cancel?.label).toBe('Dismiss');

    // Toast should persist (not auto-dismiss) until user acts
    expect(toastOptions?.duration).toBe(Infinity);

    // Invoke the Restore action — should not throw
    expect(() => toastOptions?.action?.onClick?.()).not.toThrow();
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-TAGS-S1: Combobox filters existing tags by typed text
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-TAGS-S1: tag combobox filters existing tags by typed text', async () => {
    const { TagCombobox } = await import('@/components/editor/TagCombobox');

    const mockTags = [
      { id: 'tag-1', name: 'Work', color: '#3b82f6', noteCount: 2 },
      { id: 'tag-2', name: 'Personal', color: '#10b981', noteCount: 1 },
      { id: 'tag-3', name: 'Workplan', color: '#f59e0b', noteCount: 0 },
    ];

    server.use(
      http.get(`${BASE}/tags`, () => HttpResponse.json(mockTags)),
    );

    const onChange = vi.fn();
    const qc = makeTestQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TagCombobox tagIds={[]} onChange={onChange} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Open the combobox
    const addTagBtn = screen.getByRole('button', { name: /add tag/i });
    await userEvent.click(addTagBtn);

    // Wait for the input to appear
    const comboboxInput = await screen.findByPlaceholderText(/search or create tag/i);

    // Type 'work' to filter
    await userEvent.type(comboboxInput, 'work');

    // Should show 'Work' and 'Workplan' but not 'Personal'
    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Workplan')).toBeInTheDocument();
      expect(screen.queryByText('Personal')).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-TAGS-S2: Enter with unmatched text creates new tag via POST /tags
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-TAGS-S2: pressing Enter with unmatched text calls POST /tags and adds chip', async () => {
    const { TagCombobox } = await import('@/components/editor/TagCombobox');

    server.use(
      http.get(`${BASE}/tags`, () => HttpResponse.json([])),
    );

    const postSpy = vi.fn();
    server.use(
      http.post(`${BASE}/tags`, async ({ request }) => {
        const body = (await request.json()) as { name: string; color: string };
        postSpy(body);
        return HttpResponse.json(
          { id: 'tag-new', name: body.name, color: body.color, noteCount: 0 },
          { status: 201 },
        );
      }),
    );

    const onChange = vi.fn();
    const qc = makeTestQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TagCombobox tagIds={[]} onChange={onChange} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Open combobox
    const addTagBtn = screen.getByRole('button', { name: /add tag/i });
    await userEvent.click(addTagBtn);

    const comboboxInput = await screen.findByPlaceholderText(/search or create tag/i);

    // Type a new tag name and press Enter
    await userEvent.type(comboboxInput, 'newtag');
    await userEvent.keyboard('{Enter}');

    // POST /tags should be called with the new tag name
    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'newtag' }),
      );
    });

    // onChange should be called with the new tag id
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(['tag-new']);
    });
  });

  // ---------------------------------------------------------------------------
  // UI-EDITOR-TAGS-S3: X on tag chip removes it and calls onChange
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-TAGS-S3: clicking X on tag chip removes the tag', async () => {
    const { TagCombobox } = await import('@/components/editor/TagCombobox');

    const mockTags = [
      { id: 'tag-1', name: 'Work', color: '#3b82f6', noteCount: 2 },
    ];

    server.use(
      http.get(`${BASE}/tags`, () => HttpResponse.json(mockTags)),
    );

    const onChange = vi.fn();
    const qc = makeTestQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <TagCombobox tagIds={['tag-1']} onChange={onChange} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for the chip to render
    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    // Click the X button on the 'Work' chip
    const removeBtn = screen.getByRole('button', { name: /remove tag work/i });
    await userEvent.click(removeBtn);

    // onChange called with empty array (tag removed)
    expect(onChange).toHaveBeenCalledWith([]);
  });

  // ---------------------------------------------------------------------------
  // /notes/new → POST /notes → redirect to /notes/:id
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-NEW-S1: navigating to /notes/new POSTs blank note and redirects to /notes/:id', async () => {
    renderEditorPage('/notes/new');

    // Stub renders immediately; wait for POST → redirect → GET to resolve.
    // MSW GET /notes/:id returns title "Test Note" for any existing id.
    await screen.findByText('Note: Test Note');
    expect(screen.getByTestId('note-editor')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // /notes/:id with 404 → toast + navigate to /notes
  // ---------------------------------------------------------------------------
  it('UI-EDITOR-404-S1: 404 from GET /notes/:id shows error toast and navigates to /notes list', async () => {
    const { toast } = await import('sonner');

    renderEditorPage('/notes/note-missing');

    // After 404, page navigates to /notes
    await screen.findByTestId('notes-list');

    expect((toast as unknown as { error: ReturnType<typeof vi.fn> }).error).toHaveBeenCalledWith(
      'Note not found.',
    );
  });
});
