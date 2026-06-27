---
ticket: AB-1013
title: Frontend — Search UI
status: APPROVED
created: 2026-06-28
---

# AB-1013 — Tasks: Frontend Search UI

## Checklist

- [x] **T1** [PARALLEL] Add `SearchResult` and `PaginatedSearchResults` types — 5 min
  - Files: `apps/web/src/types/notes.ts`
  - Add below existing exports:
    ```ts
    export interface SearchResult { note: Note; headline: string }
    export interface PaginatedSearchResults { items: SearchResult[]; nextCursor: string | null }
    ```
  - Satisfies: (foundational — unblocks T3, T4, T5, T6)

- [x] **T2** [PARALLEL] Add `SEARCH_FAILED` to errorMessages — 5 min
  - Files: `apps/web/src/lib/errorMessages.ts`
  - Add: `SEARCH_FAILED: 'Search failed. Please try again.',`
  - Satisfies: FR-UI-SEARCH-1 (catch-all API error path)

- [x] **T3** Create MSW search handler + register in server — 15 min
  - Files:
    - `apps/web/src/mocks/handlers/search.handlers.ts` (create)
    - `apps/web/src/mocks/server.ts` (modify — add `searchHandlers`)
  - Handler supports: substring match on `q`, index-based cursor pagination,
    `<mark>`-wrapped headlines, `q=xss-test` hook, `q=empty-query-test` hook
  - Satisfies: (test infrastructure — unblocks T9)

- [x] **T4** [PARALLEL] Create `SearchInput` component — 15 min
  - Files: `apps/web/src/components/search/SearchInput.tsx` (create)
  - Controlled input; internal `localValue`; 300ms debounce via `useEffect` + `setTimeout`;
    shadcn/ui `<Input>` with lucide `<Search />` icon prefix; `aria-label="Search notes"`
  - Satisfies: FR-UI-SEARCH-1 (UI-SEARCH-INPUT-S1, UI-SEARCH-INPUT-S2)

- [x] **T5** [PARALLEL] Create `SearchResultCard` component — 15 min
  - Files: `apps/web/src/components/search/SearchResultCard.tsx` (create)
  - Props: `{ result: SearchResult }`; title as `<Link to="/notes/:id">`;
    headline via `DOMPurify.sanitize(headline, { ALLOWED_TAGS: ['mark'] })` +
    `dangerouslySetInnerHTML` — only approved use in this ticket
  - Satisfies: FR-UI-SEARCH-2 (UI-SEARCH-HIGHLIGHT-S1)

- [x] **T6** Create `SearchResultsList` component — 25 min
  - Files: `apps/web/src/components/search/SearchResultsList.tsx` (create)
  - `useInfiniteQuery(['search', query])` with `enabled: query.length > 0`;
    `initialPageParam: undefined as string | undefined`;
    `getNextPageParam: (last) => last.nextCursor ?? undefined`;
    skeleton (5 rows) on `isLoading`; no-results state on empty + non-empty query;
    "Load more" button (spinner when `isFetchingNextPage`, hidden when `!hasNextPage`)
  - Depends on: T1 (types), T4 (SearchResultCard), T5 (SearchResultCard)
  - Satisfies: FR-UI-SEARCH-1, FR-UI-SEARCH-3, FR-UI-SEARCH-4
    (UI-SEARCH-INPUT-S2, UI-SEARCH-EMPTY-S1, UI-SEARCH-PAGE-S1)

- [x] **T7** Create `SearchPage` route component — 15 min
  - Files: `apps/web/src/pages/search/SearchPage.tsx` (create)
  - Reads `?q=` via `useSearchParams()`; passes `query` to `SearchInput` + `SearchResultsList`;
    writes URL with `setSearchParams({ q: value }, { replace: true })` or `setSearchParams({})` on clear
  - Depends on: T4 (SearchInput), T6 (SearchResultsList)
  - Satisfies: FR-UI-SEARCH-1 (URL state decision)

- [x] **T8** Wire route in `App.tsx` + add nav link in `AppHeader.tsx` — 10 min
  - Files:
    - `apps/web/src/App.tsx` (modify — replace `/search` stub with `<SearchPage />`)
    - `apps/web/src/components/layout/AppHeader.tsx` (modify — add `<Search />` nav link)
  - Depends on: T7 (SearchPage)
  - Satisfies: FR-UI-SEARCH-1 (route accessible)

- [x] **T9** Write `SearchPage.test.tsx` — all 5 scenarios — 40 min
  - Files: `apps/web/src/__tests__/pages/SearchPage.test.tsx` (create)
  - Scenarios covered:
    - UI-SEARCH-INPUT-S1: `vi.useFakeTimers()` — no API call at <300ms; one call after 300ms
    - UI-SEARCH-INPUT-S2: clear input → no API call; blank results area
    - UI-SEARCH-HIGHLIGHT-S1: `<mark>` in DOM; XSS `<script>` stripped by DOMPurify
    - UI-SEARCH-EMPTY-S1: `<SearchX />` + "No matches for 'query'" + "Try different keywords"
    - UI-SEARCH-PAGE-S1: "Load more" appends results; hidden when `nextCursor` is null
  - Depends on: T1–T8 all complete
  - Satisfies: FR-UI-SEARCH-1, FR-UI-SEARCH-2, FR-UI-SEARCH-3, FR-UI-SEARCH-4
