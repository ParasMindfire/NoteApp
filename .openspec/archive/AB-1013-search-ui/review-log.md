# Review Log — AB-1013 Frontend Search UI

## 2026-06-28T00:00:00Z -- Tasks T1–T8

### Files Audited
- T1: `apps/web/src/types/notes.ts`
- T2: `apps/web/src/lib/errorMessages.ts`
- T3: `apps/web/src/mocks/handlers/search.handlers.ts`, `apps/web/src/mocks/server.ts`
- T4: `apps/web/src/components/search/SearchInput.tsx`
- T5: `apps/web/src/components/search/SearchResultCard.tsx`
- T6: `apps/web/src/components/search/SearchResultsList.tsx`
- T7: `apps/web/src/pages/search/SearchPage.tsx`
- T8: `apps/web/src/App.tsx`, `apps/web/src/components/layout/AppHeader.tsx`

---

### FR-UI-SEARCH-1 — Debounced search input

[OK] FR-UI-SEARCH-1 — Route `/search` is declared as a child of `PrivateRoute` in App.tsx (line 38: `{ path: '/search', element: <SearchPage /> }`)

[OK] FR-UI-SEARCH-1 — shadcn/ui `<Input />` component used in SearchInput.tsx; lucide `<Search />` icon present as prefix

[OK] FR-UI-SEARCH-1 — Debounce is exactly 300ms: `setTimeout(() => { onChange(localValue); }, 300)` in SearchInput.tsx lines 19-25

[OK] FR-UI-SEARCH-1 — Empty query guard: `enabled: query.length > 0` in SearchResultsList.tsx line 32; `setSearchParams({}, { replace: true })` removes `?q=` when value is empty (SearchPage.tsx line 13)

[OK] FR-UI-SEARCH-1 — URL `?q=` is source of truth: SearchPage reads `searchParams.get('q') ?? ''`; SearchInput syncs local state from prop via useEffect on mount/URL change

[OK] FR-UI-SEARCH-1 — `<Search />` icon has `aria-hidden="true"` (SearchInput.tsx line 31)

[OK] FR-UI-SEARCH-1 — `<Input />` has `aria-label="Search notes"` (SearchInput.tsx line 34)

---

### FR-UI-SEARCH-2 — Highlighted results

[OK] FR-UI-SEARCH-2 — `DOMPurify.sanitize(result.headline, { ALLOWED_TAGS: ['mark'] })` called before `dangerouslySetInnerHTML` (SearchResultCard.tsx line 10)

[OK] FR-UI-SEARCH-2 — `dangerouslySetInnerHTML={{ __html: safeHeadline }}` uses the sanitized value, not the raw headline (SearchResultCard.tsx line 22)

[OK] FR-UI-SEARCH-2 — FRS states "NEVER use dangerouslySetInnerHTML without sanitization" — satisfied; no unsanitized innerHTML found

---

### FR-UI-SEARCH-3 — No-results state

[OK] FR-UI-SEARCH-3 — `<SearchX />` lucide icon rendered in no-results state (SearchResultsList.tsx line 61)

[OK] FR-UI-SEARCH-3 — Subtext "Try different keywords" present (SearchResultsList.tsx line 65)

[OK] FR-UI-SEARCH-3 — No-results state only shown when query is non-empty AND results are empty (`if (!query) return null` guard at line 42; `if (allItems.length === 0)` at line 58)

[WARN] FR-UI-SEARCH-3 — Heading uses curly/typographic quotes (`&lsquo;` and `&rsquo;`) producing "No matches for 'query'" instead of the straight single quotes specified in FRS: `"No matches for '<query>'"`. Visually similar but not a literal match to the spec. Scenario UI-SEARCH-EMPTY-S1 tests for exact text match which may fail depending on assertion.

---

### FR-UI-SEARCH-4 — Paginated load more

[OK] FR-UI-SEARCH-4 — `useInfiniteQuery` used (SearchResultsList.tsx line 18)

[OK] FR-UI-SEARCH-4 — `initialPageParam: undefined as string | undefined` (SearchResultsList.tsx line 30)

[OK] FR-UI-SEARCH-4 — `getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined` — returns `undefined` (not `null`) when no more pages (SearchResultsList.tsx line 31)

[OK] FR-UI-SEARCH-4 — "Load more" button hidden when `hasNextPage` is false: `{hasNextPage && (...)}` (SearchResultsList.tsx line 78)

[OK] FR-UI-SEARCH-4 — Button disabled and shows spinner (`<Loader2 ... animate-spin />`) when `isFetchingNextPage` is true (SearchResultsList.tsx lines 84-91)

---

### UX.md Conventions

[OK] UX.md Loading States — 5 `<Skeleton />` rows shown while `isLoading` (SearchResultsList.tsx lines 46-53); matches "show skeleton screens, not blank space"

[OK] UX.md Error States — Error mapped via `getErrorMessage(code ?? 'SEARCH_FAILED')` and displayed as `toast.error(...)` (SearchResultsList.tsx lines 35-40); raw `error.detail` never shown directly

[OK] UX.md State Management — No Zustand slice created for search state; query lives in URL; server state in TanStack Query

[OK] UX.md Accessibility — Interactive elements keyboard-reachable; `aria-label` on SearchInput; `aria-hidden="true"` on decorative icons; `aria-busy="true"` on loading skeleton container

[WARN] UX.md Empty States — Global UX.md pattern requires: "Icon + Heading + Subtext + Primary action button". The no-results state in SearchResultsList.tsx has icon + heading + subtext but NO primary action button. The spec.md explicitly defines the no-results content (SearchX icon + heading + subtext) without a primary action button, which constitutes an intentional ticket-level override. The override is documented in spec.md but not formally noted in UX.md. Per CLAUDE.md: "Override only with explicit justification in spec.md (and update UX.md via fix bundle if the override is reusable)." UX.md has not been updated.

---

### T1 — Types

[OK] T1 — `SearchResult` interface defined with `note: Note` and `headline: string` (notes.ts lines 25-28)

[OK] T1 — `PaginatedSearchResults` interface defined with `items: SearchResult[]` and `nextCursor: string | null` (notes.ts lines 30-33)

---

### T2 — errorMessages.ts

[OK] T2 — `SEARCH_FAILED: 'Search failed. Please try again.'` entry present (errorMessages.ts line 12), matching spec.md error mapping exactly

---

### T3 — MSW Handlers

[OK] T3 — `searchHandlers` registered in `server.ts` (line 7: `...searchHandlers`)

[OK] T3 — MSW handler covers `GET /search` with `q`, `cursor`, and `limit` params

[OK] T3 — XSS test fixture returns `headline: '<script>alert(1)</script> some text'` for `q=xss-test` — enables scenario UI-SEARCH-HIGHLIGHT-S1 XSS assertion

---

### T8 — AppNav vs AppHeader

[WARN] T8 — spec.md (lines 27, 53) states "Add `/search` nav link to `AppNav`" but no `AppNav` component exists in the codebase. The Search nav link is implemented inside `AppHeader.tsx` (lines 37-43). The link is present and functional, but the component name diverges from the spec's terminology. The spec should be updated to reflect `AppHeader` as the correct component name.

---

### Coverage

[COVERAGE] FR-UI-SEARCH-1 — Scenario UI-SEARCH-INPUT-S1 ("Query fires after 300ms debounce"): no test file found for `SearchInput.tsx` or `SearchPage.tsx`

[COVERAGE] FR-UI-SEARCH-1 — Scenario UI-SEARCH-INPUT-S2 ("Empty query clears results without API call"): no test file found

[COVERAGE] FR-UI-SEARCH-2 — Scenario UI-SEARCH-HIGHLIGHT-S1 ("<mark> tags rendered; XSS blocked"): no test file found for `SearchResultCard.tsx`

[COVERAGE] FR-UI-SEARCH-3 — Scenario UI-SEARCH-EMPTY-S1 ("No-results state shown"): no test file found for `SearchResultsList.tsx`

[COVERAGE] FR-UI-SEARCH-4 — Scenario UI-SEARCH-PAGE-S1 ("Load more fetches next page"): no test file found for `SearchResultsList.tsx`

