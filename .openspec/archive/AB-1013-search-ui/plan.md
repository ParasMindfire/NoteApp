---
ticket: AB-1013
title: Frontend — Search UI
status: APPROVED
created: 2026-06-28
---

# AB-1013 — Plan: Frontend Search UI

## Dependencies on Prior Tickets

- **AB-1011 merged** — `AppLayout`, `AppHeader`, `PrivateRoute`, `api.ts`, `queryClient`,
  `errorMessages.ts`, `authStore`, MSW server scaffold all in place.
- **AB-1012 merged** — `/notes/:id` route exists; `SearchResultCard` links there.
- **Backend AB-1007 merged** — `GET /search?q=&cursor=&limit=` returns
  `{ items: [{ note, headline }], nextCursor }` with `headline` containing `<mark>` wrappers.
- **DOMPurify 3.2.6** already installed in `apps/web` — no new package needed.

## Prisma Schema Changes

None — frontend-only ticket.

## New Packages

None — DOMPurify 3.2.6 and `@types/dompurify` 3.0.5 are already in `apps/web/package.json`.

---

## Files to Create

### 1. `apps/web/src/types/notes.ts` ← modify (add types)

Add two new types below existing exports:

```ts
export interface SearchResult {
  note: Note;
  headline: string;
}

export interface PaginatedSearchResults {
  items: SearchResult[];
  nextCursor: string | null;
}
```

### 2. `apps/web/src/pages/search/SearchPage.tsx` ← create

Route component. Responsibilities:
- Read `?q=` from URL via `useSearchParams()`.
- Pass `query` (string) down to `SearchInput` (for pre-population on mount/refresh).
- Pass `query` to `SearchResultsList` which owns the `useInfiniteQuery`.
- No Zustand slice needed.

```tsx
// sketch
const [searchParams, setSearchParams] = useSearchParams()
const query = searchParams.get('q') ?? ''

function handleQueryChange(value: string) {
  if (value) setSearchParams({ q: value }, { replace: true })
  else setSearchParams({}, { replace: true })
}

return (
  <div className="mx-auto max-w-3xl px-4 py-6">
    <h1>Search</h1>
    <SearchInput value={query} onChange={handleQueryChange} />
    <SearchResultsList query={query} />
  </div>
)
```

### 3. `apps/web/src/components/search/SearchInput.tsx` ← create

Controlled input with local debounce. Responsibilities:
- Accepts `value: string` (URL-based) and `onChange: (v: string) => void` from `SearchPage`.
- Maintains internal `localValue` state for responsive typing.
- On mount / when `value` changes externally: sync `localValue` from `value`.
- Debounces `onChange(localValue)` at **300ms** after last keystroke using `useEffect` + `setTimeout` / `clearTimeout`.
- Renders shadcn/ui `<Input>` with lucide `<Search />` icon as prefix.
- `aria-label="Search notes"`.

```tsx
// debounce pattern
useEffect(() => {
  const id = setTimeout(() => onChange(localValue), 300)
  return () => clearTimeout(id)
}, [localValue])   // onChange intentionally excluded (stable ref)
```

### 4. `apps/web/src/components/search/SearchResultCard.tsx` ← create

Renders one result item. Responsibilities:
- Props: `{ result: SearchResult }`.
- Title: React Router `<Link to={/notes/${result.note.id}}>` — primary action.
- Headline: `DOMPurify.sanitize(result.headline, { ALLOWED_TAGS: ['mark'] })` then
  `<span dangerouslySetInnerHTML={{ __html: safeHeadline }} />`.
- This is the **only** approved `dangerouslySetInnerHTML` in AB-1013.

### 5. `apps/web/src/components/search/SearchResultsList.tsx` ← create

Owns `useInfiniteQuery`. Responsibilities:
- Props: `{ query: string }`.
- `useInfiniteQuery`:
  ```ts
  queryKey: ['search', query],
  queryFn: ({ pageParam }) =>
    api.get('/search', { params: { q: query, cursor: pageParam, limit: 20 } })
       .then(r => r.data as PaginatedSearchResults),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) => last.nextCursor ?? undefined,
  enabled: query.length > 0,
  ```
- While `isLoading`: show 5 `<Skeleton />` rows (same height as a result card).
- While `isFetchingNextPage`: "Load more" button is disabled + shows spinner.
- After load, when `query` is empty: blank area (no message).
- When `query` is non-empty + zero total items: no-results state.
- No-results state: `<SearchX />` icon + `"No matches for '${query}'"` heading +
  `"Try different keywords"` subtext.
- "Load more" button hidden when `hasNextPage` is false.
- Results: `pages.flatMap(p => p.items)` → one `<SearchResultCard />` per item.

### 6. `apps/web/src/mocks/handlers/search.handlers.ts` ← create

MSW handler for `GET /search`. Returns `PaginatedSearchResults` shape.
Supports:
- `q` param: simple substring match on mock note titles.
- `cursor` param: index-based pagination (matches existing notes handler pattern).
- Special headline with `<mark>` wrapping on matched term.
- Test hook: `q=xss-test` → returns headline containing `<script>alert(1)</script>` for XSS scenario.
- `q=empty-query-test` → returns `{ items: [], nextCursor: null }` for no-results scenario.

### 7. `apps/web/src/__tests__/pages/SearchPage.test.tsx` ← create

Integration test file. See Test Strategy section below.

---

## Files to Modify

### `apps/web/src/App.tsx`

Replace existing `/search` stub:
```tsx
// before
{ path: '/search', element: <div>Coming soon</div> },

// after
{ path: '/search', element: <SearchPage /> },
```
Add import: `import { SearchPage } from '@/pages/search/SearchPage';`

### `apps/web/src/components/layout/AppHeader.tsx`

Add a `/search` nav link inside the existing `<nav>` element, before the Trash stub:
```tsx
// add import
import { Search, Trash2 } from 'lucide-react';

// add in nav, before Trash2 span
<Link
  to="/search"
  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
>
  <Search className="h-3.5 w-3.5" aria-hidden="true" />
  Search
</Link>
```

### `apps/web/src/lib/errorMessages.ts`

Add one entry:
```ts
SEARCH_FAILED: 'Search failed. Please try again.',
```

### `apps/web/src/types/notes.ts`

Add `SearchResult` and `PaginatedSearchResults` (see above under Files to Create §1).

### `apps/web/src/mocks/server.ts`

Register `searchHandlers`:
```ts
import { searchHandlers } from './handlers/search.handlers';
export const server = setupServer(...authHandlers, ...notesHandlers, ...editorHandlers, ...searchHandlers);
```

---

## Risk Areas

| # | Risk | Mitigation |
|---|---|---|
| 1 | **XSS via `dangerouslySetInnerHTML`** — reviewer flags unguarded use as `[SEC]` | Wrap every `dangerouslySetInnerHTML` with `DOMPurify.sanitize(…, { ALLOWED_TAGS: ['mark'] })`; add explicit XSS scenario test (UI-SEARCH-HIGHLIGHT-S1) |
| 2 | **TanStack Query v5 `useInfiniteQuery` shape** — `getNextPageParam` must return `undefined` (not `null`) to signal "no more pages"; `initialPageParam` must be typed as `string \| undefined` | Follow exact typing above; verify in tests that "Load more" hides when `hasNextPage = false` |
| 3 | **Debounce test flakiness** — `vi.advanceTimersByTimeAsync` inside `act()` is required for React state updates triggered by timer callbacks | Use `vi.useFakeTimers()` in `beforeEach`; wrap timer advances in `act(async () => { await vi.advanceTimersByTimeAsync(300) })` |
| 4 | **`SearchInput` cursor jitter** — keeping local state + syncing from URL prop on external changes can cause the input cursor to jump | Only sync `localValue` from `value` prop when they differ AND the debounce is not mid-flight (use a ref guard or only sync on mount) |
| 5 | **`<Search />` icon import collision** — `AppHeader.tsx` already imports from lucide; adding `Search` needs the destructured import updated | Update the single import line; no separate import statement |

---

## Test Strategy

All tests in: `apps/web/src/__tests__/pages/SearchPage.test.tsx`

| Scenario | Approach |
|---|---|
| **UI-SEARCH-INPUT-S1** — debounce 300ms | `vi.useFakeTimers()`; type "hello"; assert MSW handler NOT called at 299ms; `act(() => vi.advanceTimersByTime(1))`; assert called exactly once |
| **UI-SEARCH-INPUT-S2** — empty query no API call | Type "hello" → advance 300ms → results shown; then clear input → advance 300ms → no further API call; results area blank |
| **UI-SEARCH-HIGHLIGHT-S1** — `<mark>` rendered; XSS blocked | MSW handler `q=mark-test` returns `headline: "A <mark>match</mark> found"`; assert `document.querySelector('mark')` exists in DOM. Second assertion: `q=xss-test` returns `headline: "<script>alert(1)</script>"`; assert no `<script>` element in DOM and no error thrown |
| **UI-SEARCH-EMPTY-S1** — no-results state | MSW returns `{ items: [], nextCursor: null }` for query; assert `<SearchX />` aria-label/role + "No matches for" text + "Try different keywords" text |
| **UI-SEARCH-PAGE-S1** — load more | MSW first response: 5 items + `nextCursor: 'c2'`; assert 5 cards + "Load more" button; click "Load more"; MSW second response: 3 items + `nextCursor: null`; assert 8 total cards + "Load more" hidden |

**Test render helper pattern** (matches existing `renderNotesPage`):
```ts
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
  )
}
```

**MSW override pattern** for per-test handlers (matches existing test files):
```ts
server.use(
  http.get(`${BASE}/search`, () =>
    HttpResponse.json({ items: [], nextCursor: null })
  )
)
```

---

## Implementation Order

1. `types/notes.ts` — add types (unblocks all other files)
2. `mocks/handlers/search.handlers.ts` + `mocks/server.ts` — unblocks tests
3. `lib/errorMessages.ts` — trivial addition
4. `SearchInput.tsx` — standalone, no cross-component deps
5. `SearchResultCard.tsx` — standalone (imports `SearchResult` type + DOMPurify)
6. `SearchResultsList.tsx` — depends on SearchResultCard + useInfiniteQuery
7. `SearchPage.tsx` — orchestrates all components
8. `App.tsx` — wire route
9. `AppHeader.tsx` — add nav link
10. `SearchPage.test.tsx` — all 5 scenarios
