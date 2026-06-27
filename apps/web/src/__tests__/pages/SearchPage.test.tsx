/**
 * Tests for SearchPage and search components
 * Scenarios: UI-SEARCH-INPUT-S1, UI-SEARCH-INPUT-S2,
 *            UI-SEARCH-HIGHLIGHT-S1,
 *            UI-SEARCH-EMPTY-S1,
 *            UI-SEARCH-PAGE-S1
 * FRs: FR-UI-SEARCH-1, FR-UI-SEARCH-2, FR-UI-SEARCH-3, FR-UI-SEARCH-4
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { SearchPage } from '@/pages/search/SearchPage';
import type { PaginatedSearchResults } from '@/types/notes';

// Must match VITE_API_URL in apps/web/.env (used by api.ts and mocks/handlers)
const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

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

function renderSearchPage(initialPath = '/search', qc?: QueryClient) {
  return render(
    <QueryClientProvider client={qc ?? makeQueryClient()}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/search" element={<SearchPage />} />
          <Route path="/notes/:id" element={<div>Note Detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}


describe('SearchPage', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  // ---------------------------------------------------------------------------
  // UI-SEARCH-INPUT-S1 — Query fires after 300ms debounce (FR-UI-SEARCH-1)
  // ---------------------------------------------------------------------------
  it('UI-SEARCH-INPUT-S1: no API call within 300ms; exactly one GET /search fires after 300ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const requests: Request[] = [];
      server.use(
        http.get(`${BASE}/search`, ({ request }) => {
          requests.push(request);
          return HttpResponse.json({
            items: [],
            nextCursor: null,
          } satisfies PaginatedSearchResults);
        })
      );

      renderSearchPage();

      const input = screen.getByRole('textbox', { name: /search notes/i });

      // Change the input value without advancing timers
      act(() => {
        fireEvent.change(input, { target: { value: 'Search Note' } });
      });

      // Immediately after change — debounce has NOT fired, no requests yet
      expect(requests).toHaveLength(0);

      // Advance fake clock by 300ms — debounce fires, URL ?q= is set, query is enabled
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Now allow React Query to fire the fetch and MSW to respond
      await waitFor(() => {
        expect(requests).toHaveLength(1);
      }, { timeout: 3000 });

      const url = new URL(requests[0]!.url);
      expect(url.pathname).toBe('/search');
      expect(url.searchParams.get('q')).toBe('Search Note');
    } finally {
      vi.useRealTimers();
    }
  });

  // ---------------------------------------------------------------------------
  // UI-SEARCH-INPUT-S2 — Empty query clears results without API call (FR-UI-SEARCH-1)
  // ---------------------------------------------------------------------------
  it('UI-SEARCH-INPUT-S2: clearing input removes results and issues no new API call', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      renderSearchPage();

      const input = screen.getByRole('textbox', { name: /search notes/i });

      // Set a query value and fire debounce
      act(() => {
        fireEvent.change(input, { target: { value: 'Search Note' } });
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Wait for results to appear
      await waitFor(() => {
        expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
      }, { timeout: 3000 });

      // Track requests after the clear
      const requestsAfterClear: Request[] = [];
      server.use(
        http.get(`${BASE}/search`, ({ request }) => {
          requestsAfterClear.push(request);
          return HttpResponse.json({ items: [], nextCursor: null } satisfies PaginatedSearchResults);
        })
      );

      // Clear the input (empty value → setSearchParams({}) → query removed → enabled: false)
      act(() => {
        fireEvent.change(input, { target: { value: '' } });
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Give extra time to confirm no stray request fires
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(requestsAfterClear).toHaveLength(0);

      // Results area should be blank — SearchResultsList returns null when query is empty
      expect(screen.queryAllByRole('link', { name: /search note/i })).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  // ---------------------------------------------------------------------------
  // UI-SEARCH-HIGHLIGHT-S1 — <mark> tags rendered (FR-UI-SEARCH-2)
  // ---------------------------------------------------------------------------
  it('UI-SEARCH-HIGHLIGHT-S1: <mark> elements rendered for matching terms in results', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      // The default search handler returns headlines with <mark> tags for matching terms
      renderSearchPage();

      const input = screen.getByRole('textbox', { name: /search notes/i });

      act(() => {
        fireEvent.change(input, { target: { value: 'Search Note' } });
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Wait for results to load (links appear)
      await waitFor(() => {
        expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
      }, { timeout: 3000 });

      // At least one <mark> element should be in the DOM (DOMPurify allows <mark> through)
      const markElements = document.querySelectorAll('mark');
      expect(markElements.length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  // ---------------------------------------------------------------------------
  // UI-SEARCH-HIGHLIGHT-S1 (XSS) — script tags stripped by DOMPurify (FR-UI-SEARCH-2)
  // ---------------------------------------------------------------------------
  it('UI-SEARCH-HIGHLIGHT-S1 (XSS): script tags stripped by DOMPurify for xss-test query', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      // The built-in handler for q=xss-test returns: '<script>alert(1)</script> some text'
      renderSearchPage();

      const input = screen.getByRole('textbox', { name: /search notes/i });

      act(() => {
        fireEvent.change(input, { target: { value: 'xss-test' } });
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Wait for results to render (a link to the note should appear)
      await waitFor(() => {
        expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
      }, { timeout: 3000 });

      // No <script> element with alert(1) content should exist in the rendered DOM
      // DOMPurify strips <script> from the dangerouslySetInnerHTML span
      const dangerousScripts = Array.from(document.querySelectorAll('script')).filter((el) =>
        el.textContent?.includes('alert(1)')
      );
      expect(dangerousScripts).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  // ---------------------------------------------------------------------------
  // UI-SEARCH-EMPTY-S1 — No-results state shown (FR-UI-SEARCH-3)
  // ---------------------------------------------------------------------------
  it('UI-SEARCH-EMPTY-S1: no-results state shows correct text when API returns empty items', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      // The built-in handler for q=empty-query-test returns { items: [], nextCursor: null }
      renderSearchPage();

      const input = screen.getByRole('textbox', { name: /search notes/i });

      act(() => {
        fireEvent.change(input, { target: { value: 'empty-query-test' } });
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Wait for the no-results state to appear
      await waitFor(() => {
        expect(screen.getByText(/no matches for/i)).toBeInTheDocument();
      }, { timeout: 3000 });

      // "Try different keywords" subtext is visible
      expect(screen.getByText('Try different keywords')).toBeInTheDocument();

      // No result link cards are shown
      expect(screen.queryAllByRole('link', { name: /search note/i })).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  // ---------------------------------------------------------------------------
  // UI-SEARCH-PAGE-S1 — Load more fetches next page (FR-UI-SEARCH-4)
  // ---------------------------------------------------------------------------
  it('UI-SEARCH-PAGE-S1: load more appends second page; button hidden when nextCursor is null', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const FIRST_PAGE = Array.from({ length: 3 }, (_, i) => ({
        note: {
          id: `page-note-${i + 1}`,
          title: `Page Note ${i + 1}`,
          body: { type: 'doc', content: [] },
          tagIds: [] as string[],
          tags: [] as { id: string; name: string; color: string }[],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          version: 1,
        },
        headline: `Page Note ${i + 1}`,
      }));

      const SECOND_PAGE = Array.from({ length: 2 }, (_, i) => ({
        note: {
          id: `page-note-${i + 4}`,
          title: `Page Note ${i + 4}`,
          body: { type: 'doc', content: [] },
          tagIds: [] as string[],
          tags: [] as { id: string; name: string; color: string }[],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deletedAt: null,
          version: 1,
        },
        headline: `Page Note ${i + 4}`,
      }));

      server.use(
        http.get(`${BASE}/search`, ({ request }) => {
          const url = new URL(request.url);
          const cursor = url.searchParams.get('cursor');

          if (!cursor) {
            return HttpResponse.json({
              items: FIRST_PAGE,
              nextCursor: '3',
            } satisfies PaginatedSearchResults);
          } else {
            return HttpResponse.json({
              items: SECOND_PAGE,
              nextCursor: null,
            } satisfies PaginatedSearchResults);
          }
        })
      );

      renderSearchPage();

      const input = screen.getByRole('textbox', { name: /search notes/i });

      act(() => {
        fireEvent.change(input, { target: { value: 'Page Note' } });
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Wait for first 3 result cards (link elements)
      await waitFor(() => {
        expect(screen.getAllByRole('link', { name: /page note 1/i }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole('link', { name: /page note 2/i }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole('link', { name: /page note 3/i }).length).toBeGreaterThan(0);
      }, { timeout: 3000 });

      // "Load more" button should be visible (nextCursor: '3')
      const loadMoreBtn = screen.getByRole('button', { name: /load more/i });
      expect(loadMoreBtn).toBeInTheDocument();

      // Click "Load more"
      fireEvent.click(loadMoreBtn);

      // Wait for second page results to appear (link elements)
      await waitFor(() => {
        expect(screen.getAllByRole('link', { name: /page note 4/i }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole('link', { name: /page note 5/i }).length).toBeGreaterThan(0);
      }, { timeout: 3000 });

      // All 5 result link cards now visible
      const links = screen.getAllByRole('link', { name: /page note \d/i });
      expect(links).toHaveLength(5);

      // "Load more" button should be gone (nextCursor is null)
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /load more/i })).not.toBeInTheDocument();
      }, { timeout: 3000 });
    } finally {
      vi.useRealTimers();
    }
  });

  // ---------------------------------------------------------------------------
  // UI-SEARCH-PAGE-S1 (bonus) — Pre-populated query from URL loads results on mount
  // ---------------------------------------------------------------------------
  it('UI-SEARCH-PAGE-S1 (url): pre-populated ?q= in URL loads results on mount without debounce', async () => {
    // No fake timers needed — URL-driven query bypasses SearchInput debounce
    renderSearchPage('/search?q=Search%20Note');

    // SearchPage reads ?q= directly and passes to useInfiniteQuery (enabled: true)
    await waitFor(() => {
      expect(screen.getAllByRole('link').length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // Input should be pre-populated with the query value
    const input = screen.getByRole('textbox', { name: /search notes/i });
    expect(input).toHaveValue('Search Note');
  });
});
