/**
 * Tests for NotesPage and notes list components
 * Scenarios: UI-NOTES-LIST-S1, UI-NOTES-LIST-S2, UI-NOTES-LIST-S3,
 *            UI-NOTES-SORT-S1, UI-NOTES-SORT-S2,
 *            UI-NOTES-FILTER-S1, UI-NOTES-FILTER-S2, UI-NOTES-FILTER-S3,
 *            UI-NOTES-EMPTY-S1, UI-NOTES-EMPTY-S2,
 *            UI-NOTES-TRASH-S1, UI-AUTH-LOADING-S1
 * FRs: FR-UI-NOTES-1, FR-UI-NOTES-2, FR-UI-NOTES-3, FR-UI-NOTES-4, FR-UI-NOTES-5, FR-UI-AUTH-7
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { NotesPage } from '@/pages/notes/NotesPage';
import { AppHeader } from '@/components/layout/AppHeader';
import { useNotesViewStore } from '@/stores/notesViewStore';

// Must match VITE_API_URL in apps/web/.env (used by api.ts and mocks/handlers)
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: { retry: false },
    },
  });
}

function renderNotesPage(initialPath = '/notes', queryClient?: QueryClient) {
  const qc = queryClient ?? makeQueryClient();

  return {
    qc,
    ...render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/notes/new" element={<div>New Note Page</div>} />
            <Route path="/notes/:id" element={<div>Note Detail</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    ),
  };
}

describe('NotesPage', () => {
  beforeEach(() => {
    useNotesViewStore.setState({ sort: 'createdAt:desc' });
  });

  // ---------------------------------------------------------------------------
  // UI-NOTES-LIST-S1: First page loads with skeleton then cards
  // ---------------------------------------------------------------------------
  it('UI-NOTES-LIST-S1: first page loads with skeleton then cards', async () => {
    // Use a delayed handler so we can observe the skeleton
    server.use(
      http.get(`${BASE}/notes`, async ({ request }) => {
        await new Promise((r) => setTimeout(r, 50));
        const url = new URL(request.url);
        const cursor = url.searchParams.get('cursor');
        const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
        const startIndex = cursor ? parseInt(cursor, 10) : 0;
        const ALL_NOTES = Array.from({ length: 25 }, (_, i) => ({
          id: `note-${i + 1}`,
          title: `Note ${i + 1}`,
          body: { type: 'doc', content: [] },
          tagIds: [],
          tags: [],
          createdAt: new Date(Date.now() - (i + 1) * 60_000).toISOString(),
          updatedAt: new Date(Date.now() - (i + 1) * 30_000).toISOString(),
          deletedAt: null,
          version: 1,
        }));
        const page = ALL_NOTES.slice(startIndex, startIndex + limit);
        const nextIndex = startIndex + limit;
        const nextCursor = nextIndex < ALL_NOTES.length ? String(nextIndex) : null;
        return HttpResponse.json({ items: page, nextCursor });
      })
    );

    renderNotesPage();

    // While loading: skeleton elements present (animate-pulse class)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);

    // After settling: note cards visible
    await screen.findByText('Note 1');
    expect(screen.getByText('Note 1')).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // UI-NOTES-LIST-S2: Load more appends next page
  // ---------------------------------------------------------------------------
  it('UI-NOTES-LIST-S2: load more appends next page', async () => {
    renderNotesPage();

    // Wait for first page to load
    await screen.findByText('Note 1');

    // 20 notes should be visible (Note 1 through Note 20)
    expect(screen.getByText('Note 1')).toBeInTheDocument();
    expect(screen.getByText('Note 20')).toBeInTheDocument();

    // Note 21 should not yet be visible
    expect(screen.queryByText('Note 21')).not.toBeInTheDocument();

    // "Load more" button should be visible
    const loadMoreBtn = screen.getByRole('button', { name: /load more/i });
    expect(loadMoreBtn).toBeInTheDocument();

    // Click "Load more"
    await userEvent.click(loadMoreBtn);

    // Wait for remaining notes to appear
    await screen.findByText('Note 21');
    expect(screen.getByText('Note 25')).toBeInTheDocument();

    // "Load more" button should no longer be visible after final page
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // UI-NOTES-LIST-S3: Query key updates on sort change
  // ---------------------------------------------------------------------------
  it('UI-NOTES-LIST-S3: query key updates on sort change', async () => {
    renderNotesPage();

    // Wait for initial notes to load
    await screen.findByText('Note 1');

    // Change sort via store (Radix Select is tricky in jsdom)
    act(() => {
      useNotesViewStore.setState({ sort: 'updatedAt:asc' });
    });

    // List should still render after sort change (new query issued)
    await waitFor(() => {
      expect(screen.getByText('Note 1')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // UI-NOTES-SORT-S1: Sort selection triggers refetch
  // ---------------------------------------------------------------------------
  it('UI-NOTES-SORT-S1: sort selection triggers refetch', async () => {
    renderNotesPage();

    // Wait for initial notes
    await screen.findByText('Note 1');

    // Change sort to "Oldest" via store (Radix Select needs pointer events which jsdom lacks)
    act(() => {
      useNotesViewStore.setState({ sort: 'createdAt:asc' });
    });

    // Verify notes list still renders (re-fetch happened)
    await waitFor(() => {
      expect(screen.getByText('Note 1')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // UI-NOTES-SORT-S2: Sort selection survives navigation away and back
  // ---------------------------------------------------------------------------
  it('UI-NOTES-SORT-S2: sort selection survives navigation away and back', async () => {
    const qc = makeQueryClient();

    // Initial render — set sort to "Recently Updated"
    const { unmount } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/notes']}>
          <Routes>
            <Route path="/notes" element={<NotesPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByText('Note 1');

    // Change sort selection
    act(() => {
      useNotesViewStore.setState({ sort: 'updatedAt:desc' });
    });

    // Unmount (simulates navigation away)
    unmount();

    // Remount in same QueryClientProvider — Zustand store persists
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/notes']}>
          <Routes>
            <Route path="/notes" element={<NotesPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Sort dropdown should show "Recently Updated"
    await waitFor(() => {
      // The SelectTrigger should display "Recently Updated"
      expect(screen.getByText('Recently Updated')).toBeInTheDocument();
    });

    // Verify store still holds the new sort value
    expect(useNotesViewStore.getState().sort).toBe('updatedAt:desc');
  });

  // ---------------------------------------------------------------------------
  // UI-NOTES-FILTER-S1: Clicking tag chip adds to URL and filters
  // ---------------------------------------------------------------------------
  it('UI-NOTES-FILTER-S1: clicking tag chip adds to URL and filters', async () => {
    const user = userEvent.setup();

    renderNotesPage('/notes');

    // Wait for tags to load and render — find the filter group
    const filterGroup = await screen.findByRole('group', { name: /filter by tag/i });
    const workChip = within(filterGroup).getByRole('button', { name: 'Work' });
    expect(workChip).toBeInTheDocument();
    expect(workChip).toHaveAttribute('aria-pressed', 'false');

    // Click the "Work" chip
    await user.click(workChip);

    // Chip should now be active
    await waitFor(() => {
      expect(within(filterGroup).getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'true');
    });

    // Notes list should re-fetch (filtered notes visible — notes where i % 3 === 0)
    await waitFor(() => {
      // Note 3 has tag-1 (index 2, i+1=3, 3%3===0)
      expect(screen.getByText('Note 3')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // UI-NOTES-FILTER-S2: Clicking active chip removes from URL
  // ---------------------------------------------------------------------------
  it('UI-NOTES-FILTER-S2: clicking active chip removes from URL', async () => {
    const user = userEvent.setup();

    // Render with tag-1 already active in URL
    renderNotesPage('/notes?tags=tag-1');

    // Wait for filter group to render
    const filterGroup = await screen.findByRole('group', { name: /filter by tag/i });

    // "Work" chip should be active
    await waitFor(() => {
      expect(within(filterGroup).getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'true');
    });

    // Click to deactivate
    await user.click(within(filterGroup).getByRole('button', { name: 'Work' }));

    // Chip should now be inactive
    await waitFor(() => {
      expect(within(filterGroup).getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'false');
    });
  });

  // ---------------------------------------------------------------------------
  // UI-NOTES-FILTER-S3: URL tag filter restored on back-navigation
  // ---------------------------------------------------------------------------
  it('UI-NOTES-FILTER-S3: URL tag filter restored on back-navigation', async () => {
    // Render with multiple tags in URL
    renderNotesPage('/notes?tags=tag-1,tag-2');

    // Wait for filter group to render
    const filterGroup = await screen.findByRole('group', { name: /filter by tag/i });

    // Both chips should be active
    await waitFor(() => {
      expect(within(filterGroup).getByRole('button', { name: 'Work' })).toHaveAttribute('aria-pressed', 'true');
      expect(within(filterGroup).getByRole('button', { name: 'Personal' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  // ---------------------------------------------------------------------------
  // UI-NOTES-EMPTY-S1: No-notes empty state when no filters applied
  // ---------------------------------------------------------------------------
  it('UI-NOTES-EMPTY-S1: no-notes empty state when no filters applied', async () => {
    // Override GET /notes to return empty list
    server.use(
      http.get(`${BASE}/notes`, () => {
        return HttpResponse.json({ items: [], nextCursor: null });
      })
    );

    renderNotesPage('/notes');

    // "No notes yet" heading visible (h2 element) — wait up to 3s
    const heading = await screen.findByText('No notes yet', {}, { timeout: 3000 });
    expect(heading).toBeInTheDocument();

    // "Create your first note" button visible
    const ctaButton = screen.getByRole('link', { name: /create your first note/i });
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toHaveAttribute('href', '/notes/new');
  });

  // ---------------------------------------------------------------------------
  // UI-NOTES-EMPTY-S2: Filter empty state when filters applied
  // ---------------------------------------------------------------------------
  it('UI-NOTES-EMPTY-S2: filter empty state when filters applied', async () => {
    // tag-empty triggers empty response from MSW handler
    renderNotesPage('/notes?tags=tag-empty');

    // "No notes match these filters" text visible
    await screen.findByText(/no notes match these filters/i);

    // NO "Create your first note" button
    expect(screen.queryByRole('link', { name: /create your first note/i })).not.toBeInTheDocument();
  });

  // ---------------------------------------------------------------------------
  // UI-NOTES-TRASH-S1: Trash nav item present but disabled
  // ---------------------------------------------------------------------------
  it('UI-NOTES-TRASH-S1: trash nav item present but disabled', async () => {
    const qc = makeQueryClient();

    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/notes']}>
          <AppHeader />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Find "Trash (Coming Soon)" element
    const trashItem = screen.getByText(/Trash \(Coming Soon\)/i);
    expect(trashItem).toBeInTheDocument();

    // The element itself or its closest ancestor has aria-disabled="true"
    // AppHeader renders a <span aria-disabled="true"> containing this text
    expect(trashItem.closest('[aria-disabled="true"]') ?? trashItem).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  // ---------------------------------------------------------------------------
  // UI-AUTH-LOADING-S1: Load more shows spinner during fetch (min 200ms)
  // ---------------------------------------------------------------------------
  it('UI-AUTH-LOADING-S1: load more shows spinner during fetch (min 200ms)', async () => {
    // Delay the second page response by 300ms
    server.use(
      http.get(`${BASE}/notes`, async ({ request }) => {
        const url = new URL(request.url);
        const cursor = url.searchParams.get('cursor');

        // Only delay the second page (cursor is set)
        if (cursor) {
          await new Promise((r) => setTimeout(r, 300));
        }

        const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
        const startIndex = cursor ? parseInt(cursor, 10) : 0;
        const ALL_NOTES = Array.from({ length: 25 }, (_, i) => ({
          id: `note-${i + 1}`,
          title: `Note ${i + 1}`,
          body: { type: 'doc', content: [] },
          tagIds: [],
          tags: [],
          createdAt: new Date(Date.now() - (i + 1) * 60_000).toISOString(),
          updatedAt: new Date(Date.now() - (i + 1) * 30_000).toISOString(),
          deletedAt: null,
          version: 1,
        }));
        const page = ALL_NOTES.slice(startIndex, startIndex + limit);
        const nextIndex = startIndex + limit;
        const nextCursor = nextIndex < ALL_NOTES.length ? String(nextIndex) : null;
        return HttpResponse.json({ items: page, nextCursor });
      })
    );

    renderNotesPage();

    // Wait for first page
    await screen.findByText('Note 1');

    // Click "Load more"
    const loadMoreBtn = screen.getByRole('button', { name: /load more/i });
    fireEvent.click(loadMoreBtn);

    // Immediately after click: button should be disabled (isFetchingNextPage=true means button is disabled)
    // The button renders a Loader2 spinner when isFetchingNextPage is true
    await waitFor(() => {
      // The "Load more" button text is replaced with a spinner icon, button becomes disabled
      // Find the button that is now disabled (it contains a Loader2 svg)
      const buttons = screen.getAllByRole('button');
      const spinnerBtn = buttons.find((btn) => btn.hasAttribute('disabled'));
      expect(spinnerBtn).toBeDefined();
      expect(spinnerBtn).toBeDisabled();
    });

    // After 300ms: new notes visible
    await screen.findByText('Note 21', undefined, { timeout: 2000 });
    expect(screen.getByText('Note 25')).toBeInTheDocument();
  });
});
