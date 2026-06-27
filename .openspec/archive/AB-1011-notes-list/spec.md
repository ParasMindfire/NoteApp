---
ticket: AB-1011
title: Frontend — Notes List
status: APPROVED
created: 2026-06-27
---

# AB-1011 — Frontend: Notes List

## Overview

Replaces the `/notes` "Coming Soon" placeholder with the full paginated notes list page. The page renders `<NotesList />` with cursor-based infinite loading (TanStack Query `useInfiniteQuery`), a sort dropdown (Zustand-persisted), tag filter chips (URL-sourced), empty states for both unfiltered and filtered views, and a defensive soft-delete guard. It consumes the existing Axios client, auth store, and query client configured in AB-1010.

## Goals

- Implement `/notes` route with paginated, sortable, filterable note list.
- Introduce `notesViewStore` Zustand slice for persistent sort selection.
- Sync tag filters to/from URL (`?tags=t1,t2`) as source of truth.
- Meet all accessibility, loading, and empty-state UX conventions from docs/UX.md.

## Non-Goals

- Note creation / editing (AB-1012).
- Search UI (AB-1013).
- Share modal (AB-1014) — share icon button on NoteCard is rendered but modal itself is out of scope.
- Version history (AB-1015).
- Trash / restore deleted notes — placeholder nav item only.
- Real-time updates.

## FRs Covered

- FR-UI-NOTES-1 — Paginated list with useInfiniteQuery
- FR-UI-NOTES-2 — Sort dropdown persisted in Zustand
- FR-UI-NOTES-3 — Tag filter chips, URL as source of truth, AND semantics
- FR-UI-NOTES-4 — Empty state (no notes / no filter matches)
- FR-UI-NOTES-5 — Soft-deleted notes hidden; Trash nav placeholder

## Pages / Components

| Component | Path | Purpose |
|---|---|---|
| `NotesPage` | `pages/notes/NotesPage.tsx` | Route component; wires sort + tag filter state to `<NotesList />` |
| `NotesList` | `components/notes/NotesList.tsx` | Renders skeleton → cards → "Load more" button; uses `useInfiniteQuery` |
| `NoteCard` | `components/notes/NoteCard.tsx` | Single note card: title, body preview, relative date, tag chips, share icon |
| `NotesSortDropdown` | `components/notes/NotesSortDropdown.tsx` | shadcn/ui Select; reads/writes `notesViewStore` |
| `TagFilterChips` | `components/notes/TagFilterChips.tsx` | Fetches GET /tags; renders horizontal scroll of `<TagChip />` toggles |
| `TagChip` | `components/notes/TagChip.tsx` | shadcn/ui Badge variant; active/inactive visual states |
| `NotesEmptyState` | `components/notes/NotesEmptyState.tsx` | Two variants: no-notes and no-filter-matches |

`App.tsx` — replace `/notes` placeholder with `<NotesPage />`.

## State Management

### TanStack Query

| Key | Shape | Notes |
|---|---|---|
| `['notes', sort, tagFilter]` | `useInfiniteQuery` | `sort` = `"createdAt:desc"` etc; `tagFilter` = `string[]` of tag IDs from URL |
| `['tags']` | `useQuery` | Fetches GET /tags for the filter chips row |

- `nextPageParam` extracted from `nextCursor` in each page response.
- Query re-fetches automatically when `sort` or `tagFilter` changes (key change).
- `staleTime` inherited from global queryClient (60 s).

### Zustand — `notesViewStore`

New slice at `stores/notesViewStore.ts`:

```ts
interface NotesViewState {
  sort: 'createdAt:desc' | 'createdAt:asc' | 'updatedAt:desc' | 'updatedAt:asc'
  setSort: (sort: NotesViewState['sort']) => void
}
// Default: 'createdAt:desc'
// No persistence to localStorage — survives navigation but not page reload (per FR-UI-NOTES-2)
```

### URL — tag filter

- Source of truth for active tag filter: `?tags=<id1>,<id2>`.
- `NotesPage` reads `useSearchParams()` and passes parsed array to `NotesList`.
- Clicking a `TagChip` calls `setSearchParams` to toggle the ID in/out of the `tags` param.
- On navigation away and back, URL restores filter exactly.

## API Integration

| Endpoint | Consumer | Query / Mutation |
|---|---|---|
| `GET /notes?sort=&tagIds=&cursor=&limit=20` | `NotesList` | `useInfiniteQuery` |
| `GET /tags` | `TagFilterChips` | `useQuery(['tags'])` |

**Error mappings (errorMessages.ts additions):**

| HTTP status / code | User-facing message |
|---|---|
| `401 AUTH_TOKEN_INVALID` | Handled globally by Axios interceptor (redirect to /login) |
| `400 VALIDATION_FAILED` | "Something went wrong. Please reload." (page-level error) |
| `422 INVALID_TAG` | "One or more selected tags are invalid. Filter cleared." (toast, clears tag params) |
| Network error | "Couldn't load your notes. Check your connection." (page-level error with retry) |

## NoteCard Design Decisions

Fields displayed on each card (not specified in FRS — decided here):

| Field | Detail |
|---|---|
| Title | Full title, truncated to 2 lines with ellipsis |
| Body preview | First ~100 chars of plain-text extracted from TipTap JSON (strip marks/formatting) |
| Updated date | Relative time via `date-fns` `formatDistanceToNow` ("2 hours ago") |
| Tags | Colored `<TagChip />` badges (read-only, non-clickable on card) |
| Share icon | `lucide-react <Share2 />` icon button; `aria-label="Share note"`; navigates/opens share modal (AB-1014 wires the handler — for now: no-op with console.log) |

Clicking the card body navigates to `/notes/:id`.

## New Note Button

A persistent "New Note" button (`lucide <Plus />` + label) is rendered in the top-right of the notes page header — always visible regardless of whether notes exist. Navigates to `/notes/new`. This supplements (not replaces) the empty-state CTA.

## Ticket-Specific UX Decisions

1. **Tag filter chips scope:** All user tags from `GET /tags` are shown, not just tags present on the current page. Rationale: user may filter to find notes with a specific tag even when currently sorted/paginated such that those notes are off-screen.

2. **Sort dropdown default:** `createdAt:desc` ("Newest"). Selecting a new option triggers immediate query re-fetch (key change).

3. **"Load more" button vs infinite scroll:** Button-driven per FR-UI-NOTES-1. Button is hidden once `hasNextPage === false`. Button shows spinner during fetch (per docs/UX.md loading pattern; min 200 ms display).

4. **Share icon on NoteCard (AB-1011 scope):** Rendered and keyboard-reachable, but the click handler is a no-op stub (`() => {}`). AB-1014 will wire the real modal. This avoids a dependency on AB-1014 while meeting the layout requirement.

5. **Trash nav placeholder (FR-UI-NOTES-5):** A disabled nav menu item labelled "Trash (Coming Soon)" is added to `AppHeader`/sidebar. It has `aria-disabled="true"` and no click handler.

6. **Body preview extraction:** A pure utility `extractPlainText(tipTapJson): string` is added to `apps/web/src/lib/noteUtils.ts`. It recursively collects `text` leaf nodes from TipTap JSON. No external dependency.

## Scenarios

### UI-NOTES-LIST-S1 — First page loads with skeleton then cards
**Validates:** FR-UI-NOTES-1  
Given the user navigates to `/notes`,  
When the `GET /notes` request is in-flight,  
Then a skeleton screen (shadcn/ui Skeleton) is shown;  
And when the response resolves, note cards are rendered with title, preview, date, and tags.

### UI-NOTES-LIST-S2 — "Load more" appends next page
**Validates:** FR-UI-NOTES-1  
Given 25 notes exist and the first page (20) is loaded,  
When the user clicks "Load more",  
Then the remaining 5 notes are appended below existing cards;  
And the "Load more" button is hidden once `nextCursor` is null.

### UI-NOTES-LIST-S3 — Query key updates on sort/filter change
**Validates:** FR-UI-NOTES-1  
Given notes are loaded with sort `createdAt:desc`,  
When the user changes sort to `updatedAt:asc`,  
Then a new query with key `['notes', 'updatedAt:asc', []]` is issued and the list re-fetches.

### UI-NOTES-SORT-S1 — Sort selection triggers refetch in new order
**Validates:** FR-UI-NOTES-2  
Given the notes list is loaded,  
When the user selects "Oldest" from the sort dropdown,  
Then `GET /notes?sort=createdAt:asc` is called and results reorder.

### UI-NOTES-SORT-S2 — Sort selection survives navigation away and back
**Validates:** FR-UI-NOTES-2  
Given the user selects "Recently Updated" and then navigates to `/search` and back,  
When `/notes` remounts,  
Then the sort dropdown shows "Recently Updated" and the query uses `updatedAt:desc`.

### UI-NOTES-FILTER-S1 — Clicking a tag chip adds it to URL and filters
**Validates:** FR-UI-NOTES-3  
Given the tag filter chips row is rendered,  
When the user clicks a chip for tag ID `t1`,  
Then `?tags=t1` appears in the URL and `GET /notes?tagIds=t1` is issued.

### UI-NOTES-FILTER-S2 — Clicking an active chip removes it from URL
**Validates:** FR-UI-NOTES-3  
Given `?tags=t1` is in the URL and the chip for `t1` is highlighted,  
When the user clicks that chip again,  
Then `?tags=` is removed from the URL and the unfiltered list reloads.

### UI-NOTES-FILTER-S3 — URL tag filter restored on back-navigation
**Validates:** FR-UI-NOTES-3  
Given the user navigated away with `?tags=t1,t2` in the URL,  
When they navigate back,  
Then both chips are shown as active and the filtered query is reissued.

### UI-NOTES-EMPTY-S1 — No-notes empty state (no filters applied)
**Validates:** FR-UI-NOTES-4  
Given the user has no notes and no tag filter is active,  
When `/notes` loads,  
Then the `<NotesEmptyState />` shows the `<FileText />` icon, heading "No notes yet", and a "Create your first note" button that navigates to `/notes/new`.

### UI-NOTES-EMPTY-S2 — Filter empty state (filters applied, no matches)
**Validates:** FR-UI-NOTES-4  
Given the user has notes but none match the active tag filter,  
When the filtered query returns an empty list,  
Then the `<NotesEmptyState />` shows "No notes match these filters" (no CTA button).

### UI-NOTES-TRASH-S1 — Trash nav item present but disabled
**Validates:** FR-UI-NOTES-5  
Given the user is on any protected page,  
When they inspect the navigation,  
Then a "Trash (Coming Soon)" item is visible with `aria-disabled="true"` and clicking it has no effect.

### UI-AUTH-LOADING-S1 — "Load more" shows spinner during fetch
**Validates:** FR-UI-AUTH-7 (loading state pattern applied to Load More)  
Given the user clicks "Load more",  
When the next-page request is in-flight,  
Then the button label is replaced with a spinner for at least 200 ms and the button width does not shift.

## Dependencies

- **AB-1010 merged** — Axios client, authStore, PrivateRoute, AppLayout, queryClient, errorMessages.ts, AppHeader all in place.
- **Backend AB-1005 merged** — `GET /notes` (cursor-paginated, sort, tagIds filter) available.
- **Backend AB-1006 merged** — `GET /tags` available for filter chips.
- **packages/shared** — `loginSchema` / `registerSchema` already exported; no new shared schemas needed for this ticket (NoteCard renders raw API response shapes — full typed Note interface may be added to shared if not already present).

## Open Questions

- None — all ambiguities resolved via spec decisions above.
