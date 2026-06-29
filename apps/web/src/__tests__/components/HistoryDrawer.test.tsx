/**
 * Tests for HistoryDrawer component family
 * Scenarios: UI-VER-OPEN-S1, UI-VER-LIST-S1, UI-VER-LIST-S2,
 *            UI-VER-PREVIEW-S1, UI-VER-RESTORE-S1, UI-VER-CONFIRM-S1
 * FRs: FR-UI-VER-1, FR-UI-VER-2, FR-UI-VER-3, FR-UI-VER-4, FR-UI-VER-5
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { HistoryDrawer } from '@/components/history/HistoryDrawer';
import { NoteEditor } from '@/components/editor/NoteEditor';
import type { Note } from '@/types/notes';

// Must match VITE_API_URL in apps/web/.env (used by api.ts and mocks/handlers)
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Mock sonner so we can assert on toast calls
// ---------------------------------------------------------------------------
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Mock @tiptap/react to avoid real TipTap in jsdom
// ---------------------------------------------------------------------------
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => ({
    chain: () => ({
      focus: () => ({
        toggleBold: () => ({ run: vi.fn() }),
        toggleItalic: () => ({ run: vi.fn() }),
        toggleHeading: () => ({ run: vi.fn() }),
        toggleBulletList: () => ({ run: vi.fn() }),
        toggleOrderedList: () => ({ run: vi.fn() }),
        toggleCodeBlock: () => ({ run: vi.fn() }),
      }),
    }),
    isActive: vi.fn(() => false),
    commands: { setContent: vi.fn(), focus: vi.fn() },
    getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
    destroy: vi.fn(),
  })),
  EditorContent: ({ editor: _e, ...props }: Record<string, unknown>) => (
    <div data-testid="editor-content" contentEditable={false} {...(props as object)} />
  ),
}));

// ---------------------------------------------------------------------------
// Polyfills for jsdom
// ---------------------------------------------------------------------------
beforeAll(() => {
  if (typeof window.ResizeObserver === 'undefined') {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

const MOCK_NOTE: Note = {
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

interface HistoryDrawerProps {
  noteId?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  currentTitle?: string;
  currentBody?: Record<string, unknown>;
  onRestore?: (note: Note) => void;
}

function renderHistoryDrawer(props: HistoryDrawerProps = {}, qc?: QueryClient) {
  const client = qc ?? makeQueryClient();
  const {
    noteId = 'note-1',
    open = true,
    onOpenChange = vi.fn(),
    currentTitle = 'Test Note',
    currentBody = { type: 'doc', content: [] },
    onRestore = vi.fn(),
  } = props;

  return {
    qc: client,
    onOpenChange,
    onRestore,
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <HistoryDrawer
            noteId={noteId}
            open={open}
            onOpenChange={onOpenChange}
            currentTitle={currentTitle}
            currentBody={currentBody}
            onRestore={onRestore}
          />
        </MemoryRouter>
      </QueryClientProvider>
    ),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
describe('HistoryDrawer', () => {
  // -------------------------------------------------------------------------
  // UI-VER-OPEN-S1 — History button opens drawer; ESC closes it
  // FR-UI-VER-1
  // -------------------------------------------------------------------------
  it('UI-VER-OPEN-S1: History button in NoteEditor opens Sheet with aria-label="Version history"; ESC closes it', async () => {
    const qc = makeQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <NoteEditor note={MOCK_NOTE} />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // History button must have aria-label="Version history"
    const historyBtn = screen.getByRole('button', { name: 'Version history' });
    expect(historyBtn).toBeInTheDocument();

    // Drawer not visible before click
    expect(screen.queryByRole('dialog', { name: 'Version history' })).not.toBeInTheDocument();

    // Open drawer
    await userEvent.click(historyBtn);

    // Sheet dialog is now visible with correct aria-label
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Version history' })).toBeInTheDocument();
    });

    // ESC closes the drawer
    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Version history' })).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // UI-VER-LIST-S1 — Versions displayed newest-first with relative time
  // FR-UI-VER-2
  // -------------------------------------------------------------------------
  it('UI-VER-LIST-S1: 3 version rows appear newest-first; each shows version number, relative time, and title', async () => {
    renderHistoryDrawer({ noteId: 'note-1', open: true });

    // Wait for list to load
    await waitFor(() => {
      const items = screen.getAllByTestId('version-list-item');
      expect(items).toHaveLength(3);
    });

    const items = screen.getAllByTestId('version-list-item');

    // Newest-first ordering: v3, v2, v1
    expect(items[0]).toHaveTextContent('Version 3');
    expect(items[1]).toHaveTextContent('Version 2');
    expect(items[2]).toHaveTextContent('Version 1');

    // Each item contains its title
    expect(items[0]).toHaveTextContent('My Note (v3)');
    expect(items[1]).toHaveTextContent('My Note (v2)');
    expect(items[2]).toHaveTextContent('My Note (v1)');

    // Each item contains a relative time ("ago" suffix from date-fns addSuffix:true)
    expect(items[0]).toHaveTextContent(/ago/i);
    expect(items[1]).toHaveTextContent(/ago/i);
    expect(items[2]).toHaveTextContent(/ago/i);
  });

  // -------------------------------------------------------------------------
  // UI-VER-LIST-S2 — Empty state when no versions exist
  // FR-UI-VER-2 (edge case)
  // -------------------------------------------------------------------------
  it('UI-VER-LIST-S2: empty state "No versions yet" shown when GET returns []; no list items rendered', async () => {
    renderHistoryDrawer({ noteId: 'note-no-versions', open: true });

    // Wait for empty state to appear
    await waitFor(() => {
      expect(screen.getByText('No versions yet')).toBeInTheDocument();
    });

    // No version list items should be present
    expect(screen.queryAllByTestId('version-list-item')).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // UI-VER-PREVIEW-S1 — Click version shows split view; both panes are read-only
  // FR-UI-VER-3
  // -------------------------------------------------------------------------
  it('UI-VER-PREVIEW-S1: clicking a VersionListItem opens split-view; both TipTap containers have contenteditable="false"', async () => {
    renderHistoryDrawer({ noteId: 'note-1', open: true });

    // Wait for the version list to load
    await waitFor(() => {
      expect(screen.getAllByTestId('version-list-item')).toHaveLength(3);
    });

    // Click the first item (ver-3)
    const items = screen.getAllByTestId('version-list-item');
    await userEvent.click(items[0]!);

    // Split-view preview pane should appear
    await waitFor(() => {
      expect(screen.getByTestId('version-preview-pane')).toBeInTheDocument();
    });

    // "Restore this version" button should be visible in the right pane
    expect(screen.getByRole('button', { name: /restore this version/i })).toBeInTheDocument();

    // Both editor-content containers should have contentEditable=false (read-only)
    const editorContents = screen.getAllByTestId('editor-content');
    expect(editorContents.length).toBeGreaterThanOrEqual(2);
    editorContents.forEach((el) => {
      expect(el).toHaveAttribute('contenteditable', 'false');
    });
  });

  // -------------------------------------------------------------------------
  // UI-VER-RESTORE-S1 — Restore confirmed; onRestore called; toast shown; drawer closes
  // FR-UI-VER-4
  // -------------------------------------------------------------------------
  it('UI-VER-RESTORE-S1: click "Restore this version" → confirm dialog → confirm → POST fired → onRestore called → toast.success "Restored version N"', async () => {
    const postRequests: string[] = [];
    server.use(
      http.post(`${BASE}/notes/:noteId/versions/:versionId/restore`, ({ params }) => {
        const { versionId } = params as { versionId: string };
        postRequests.push(versionId);
        return HttpResponse.json({
          id: 'note-1',
          title: 'My Note (v2)',
          body: { type: 'doc', content: [] },
          tagIds: [],
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          version: 5,
        } satisfies Note);
      })
    );

    const onRestore = vi.fn();
    const onOpenChange = vi.fn();
    renderHistoryDrawer({ noteId: 'note-1', open: true, onRestore, onOpenChange });

    // Wait for version list
    await waitFor(() => {
      expect(screen.getAllByTestId('version-list-item')).toHaveLength(3);
    });

    // Click ver-2 (version 2) to enter preview
    const items = screen.getAllByTestId('version-list-item');
    await userEvent.click(items[1]!); // index 1 = ver-2

    // Wait for preview pane to appear
    await waitFor(() => {
      expect(screen.getByTestId('version-preview-pane')).toBeInTheDocument();
    });

    // Click "Restore this version" button
    const restoreBtn = screen.getByRole('button', { name: /restore this version/i });
    await userEvent.click(restoreBtn);

    // Confirm dialog appears with correct text
    await waitFor(() => {
      expect(screen.getByText('Restore this version?')).toBeInTheDocument();
    });
    expect(
      screen.getByText('This will create a new version — your current work won\'t be lost.')
    ).toBeInTheDocument();

    // "Restore" and "Cancel" buttons must be visible
    expect(screen.getByRole('button', { name: /confirm restore/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

    // Click the confirm Restore button
    const confirmBtn = screen.getByRole('button', { name: /confirm restore/i });
    await userEvent.click(confirmBtn);

    // POST should have been called
    await waitFor(() => {
      expect(postRequests).toHaveLength(1);
    });
    expect(postRequests[0]).toBe('ver-2');

    // onRestore callback should have been called
    await waitFor(() => {
      expect(onRestore).toHaveBeenCalledTimes(1);
    });

    // Drawer should close
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    // Success toast should have been called with "Restored version 2"
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Restored version 2');
    });
  });

  // -------------------------------------------------------------------------
  // UI-VER-CONFIRM-S1 — Cancel restore; POST not called; preview pane still visible
  // FR-UI-VER-5
  // -------------------------------------------------------------------------
  it('UI-VER-CONFIRM-S1: click "Cancel" in confirm dialog → POST not called → preview pane still visible', async () => {
    const postRequests: string[] = [];
    server.use(
      http.post(`${BASE}/notes/:noteId/versions/:versionId/restore`, ({ params }) => {
        const { versionId } = params as { versionId: string };
        postRequests.push(versionId);
        return HttpResponse.json({
          id: 'note-1',
          title: 'My Note (v3)',
          body: { type: 'doc', content: [] },
          tagIds: [],
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          version: 5,
        } satisfies Note);
      })
    );

    renderHistoryDrawer({ noteId: 'note-1', open: true });

    // Wait for version list
    await waitFor(() => {
      expect(screen.getAllByTestId('version-list-item')).toHaveLength(3);
    });

    // Click the first version (ver-3)
    const items = screen.getAllByTestId('version-list-item');
    await userEvent.click(items[0]!);

    // Wait for preview pane
    await waitFor(() => {
      expect(screen.getByTestId('version-preview-pane')).toBeInTheDocument();
    });

    // Click "Restore this version"
    const restoreBtn = screen.getByRole('button', { name: /restore this version/i });
    await userEvent.click(restoreBtn);

    // Confirm dialog appears
    await waitFor(() => {
      expect(screen.getByText('Restore this version?')).toBeInTheDocument();
    });

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await userEvent.click(cancelBtn);

    // Confirm dialog closes
    await waitFor(() => {
      expect(screen.queryByText('Restore this version?')).not.toBeInTheDocument();
    });

    // POST was NOT called
    expect(postRequests).toHaveLength(0);

    // Preview pane is still visible
    expect(screen.getByTestId('version-preview-pane')).toBeInTheDocument();
  });
});
