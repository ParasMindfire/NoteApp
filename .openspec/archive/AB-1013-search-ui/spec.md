---
ticket: AB-1013
title: Frontend — Search UI
status: DONE
created: 2026-06-28
---

# AB-1013 — Frontend: Search UI

## Overview

Implements the `/search` page with a 300ms-debounced search input, cursor-paginated
results, and highlighted match snippets. The search query is reflected in the URL as
`?q=...` so searches are shareable and survive page refresh. Result headlines from the
backend (`headline` field, per FR-SEARCH-2) are rendered with `<mark>` tags preserved,
but only after `DOMPurify.sanitize(headline, { ALLOWED_TAGS: ['mark'] })` — XSS
prevention is a hard security requirement. A no-results state and a "Load more" button
(cursor-based, matching the AB-1011 notes list pattern) complete the feature.

## Goals

- `/search` route with shadcn/ui Input + lucide `<Search />` icon; 300ms debounce.
- URL `?q=` is source of truth; clears results and skips API call when empty.
- Sanitized highlight rendering: `<mark>` preserved, all other tags stripped.
- No-results state with `<SearchX />` icon (per docs/UX.md Empty States).
- Cursor-based "Load more" pagination (`useInfiniteQuery`, same pattern as AB-1011).
- Add `/search` nav link to `AppHeader`.

## Non-Goals

- Global search bar in the app header (search is a dedicated page only).
- Search filters by tag, date range, or other facets.
- Real-time results before debounce fires.
- Saved/recent searches.

## FRs Covered

- FR-UI-SEARCH-1 — Debounced search input (300ms, URL-based, empty guard)
- FR-UI-SEARCH-2 — Highlighted results (DOMPurify sanitization, `<mark>` only)
- FR-UI-SEARCH-3 — No-results state
- FR-UI-SEARCH-4 — Paginated load more (cursor-based, "Load more" button)

## Pages / Components

| Component | Path | Purpose |
|---|---|---|
| `SearchPage` | `pages/search/SearchPage.tsx` | Route component; reads `?q=` from URL; orchestrates input, results, pagination |
| `SearchInput` | `components/search/SearchInput.tsx` | Controlled input with `<Search />` icon prefix; writes `?q=` to URL after 300ms debounce |
| `SearchResultCard` | `components/search/SearchResultCard.tsx` | Renders one result: note title (linked to `/notes/:id`) + sanitized headline |
| `SearchResultsList` | `components/search/SearchResultsList.tsx` | Maps results array; handles skeleton loading, error, no-results, and "Load more" |

`App.tsx` — add `/search` protected route pointing to `<SearchPage />`.  
`AppHeader` — add a "Search" nav link with lucide `<Search />` icon.

## State Management

### TanStack Query

| Key | Endpoint | Type | Notes |
|---|---|---|---|
| `['search', query]` | `GET /search?q=...&cursor=...&limit=20` | `useInfiniteQuery` | `enabled: query.length > 0`; key changes with query |

- `query` is read from URL `?q=` param (already debounced by `SearchInput`).
- `getNextPageParam`: returns `nextCursor` from last page, or `undefined` when `null`.
- On query change: TanStack Query auto-refetches from page 1 (new cache key).

### URL State

- `?q=<search term>` written by `SearchInput` via React Router `setSearchParams` after 300ms debounce.
- `SearchPage` reads `searchParams.get('q') ?? ''` and passes it to `useInfiniteQuery`.
- Clearing the input calls `setSearchParams({})` (removes `?q=`); `enabled: false` prevents any API call.

No Zustand slice needed — query state lives in URL; server state lives in TanStack Query.

## API Integration

| Endpoint | Consumer | Error mapping |
|---|---|---|
| `GET /search?q=...&cursor=...&limit=20` | `SearchPage` via `useInfiniteQuery` | 400 VALIDATION_FAILED → guarded by empty-check (should not reach API); catch-all → toast "Search failed. Please try again." |
| — | — | 401 → global Axios interceptor from AB-1010 (refresh + redirect) |

**errorMessages.ts additions:**

| Code | User-facing message |
|---|---|
| `SEARCH_FAILED` (synthetic catch-all) | "Search failed. Please try again." |

**DOMPurify usage (FR-UI-SEARCH-2 — only approved `dangerouslySetInnerHTML` in this ticket):**

```ts
import DOMPurify from 'dompurify'

const safeHeadline = DOMPurify.sanitize(result.headline, { ALLOWED_TAGS: ['mark'] })
// renders as:
<span dangerouslySetInnerHTML={{ __html: safeHeadline }} />
```

Reviewer will flag `dangerouslySetInnerHTML` without the `DOMPurify.sanitize` wrapper as `[SEC]`.

## Ticket-Specific UX Decisions

1. **URL as source of truth for `?q=`:** `SearchInput` holds a local controlled value and runs a 300ms debounce internally. Only after the debounce fires does it call `setSearchParams({ q: value })`. On mount, the input is pre-populated from `?q=` so direct URL visits and refreshes work. Clearing the input removes `?q=` entirely.

2. **No skeleton cards for "Load more":** When `isFetchingNextPage` is true, the "Load more" button shows a spinner and is disabled (per UX.md loading pattern). No new skeleton rows are appended — avoids layout shift for pagination vs. initial load.

3. **No-results guard:** The no-results state (FR-UI-SEARCH-3) only renders when query is non-empty AND the API returns zero items. When query is empty, the results area is blank with no message.

4. **Result card navigation:** `SearchResultCard` wraps the note title in a React Router `<Link to={/notes/${id}}>`. This is the primary action — there is no secondary "preview" for search results in this ticket.

5. **Skeleton on initial load:** While `isLoading` (first fetch), show 5 shadcn/ui `<Skeleton />` rows in place of result cards (matches UX.md skeleton pattern; same height as a result card).

## Scenarios

### UI-SEARCH-INPUT-S1 — Query fires after 300ms debounce
**Validates:** FR-UI-SEARCH-1  
Given the user is on `/search`,  
When the user types "hello" and stops,  
Then no `GET /search` request is made within 300ms;  
And exactly one `GET /search?q=hello` request fires after 300ms have elapsed.

### UI-SEARCH-INPUT-S2 — Empty query clears results without API call
**Validates:** FR-UI-SEARCH-1  
Given the user has typed "hello" and results are showing,  
When the user clears the input,  
Then no API call is issued;  
And the results area becomes blank (no results, no no-results message).

### UI-SEARCH-HIGHLIGHT-S1 — `<mark>` tags rendered; XSS blocked
**Validates:** FR-UI-SEARCH-2  
Given the backend returns a result with `headline: "A <mark>match</mark> was found"`,  
When `SearchResultCard` renders,  
Then the word "match" is wrapped in a `<mark>` element and visually highlighted;  
And given a headline containing `<script>alert(1)</script>`,  
Then the script tag is stripped by DOMPurify and no alert fires.

### UI-SEARCH-EMPTY-S1 — No-results state shown
**Validates:** FR-UI-SEARCH-3  
Given the user types a query that returns zero items from the API,  
When the response arrives,  
Then a `<SearchX />` icon is shown with the heading "No matches for '<query>'"  
And the subtext "Try different keywords".

### UI-SEARCH-PAGE-S1 — Load more fetches next page
**Validates:** FR-UI-SEARCH-4  
Given a search returns results with a non-null `nextCursor`,  
When the user clicks "Load more",  
Then `GET /search` is called with `cursor=<nextCursor>`;  
And new result cards are appended below the existing results;  
And "Load more" is hidden when `nextCursor` is `null`.

## Dependencies

- **AB-1011 merged** — `AppLayout`, `AppHeader`, `authStore`, Axios client, `queryClient`, `errorMessages.ts` established.
- **AB-1012 merged** — `/notes/:id` route exists so result cards can link to it.
- **Backend AB-1007 merged** — `GET /search` available with `headline` field and cursor pagination.
- **DOMPurify 3.2.6** already installed in `apps/web` (no new dependency).

## Open Questions

None — all ambiguities resolved above.
