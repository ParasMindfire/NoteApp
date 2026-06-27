---
ticket: AB-1011
title: Frontend — Notes List
status: DONE
created: 2026-06-27
---

# AB-1011 — Tasks

## Checklist

- [x] **T1 — shadcn/ui primitives + @radix-ui/react-select** [PARALLEL] ~20 min
  - Install `@radix-ui/react-select: 2.1.7` into `apps/web/package.json`
  - Create `apps/web/src/components/ui/select.tsx` (shadcn/ui Select, wraps Radix Select)
  - Create `apps/web/src/components/ui/badge.tsx` (shadcn/ui Badge, CVA variants, Tailwind only)
  - Create `apps/web/src/components/ui/skeleton.tsx` (shadcn/ui Skeleton, Tailwind pulse)
  - Run `pnpm install` from repo root to lock new package
  - **Scenarios:** none (infrastructure)
  - **Files touched:** `apps/web/package.json`, `apps/web/src/components/ui/select.tsx`, `apps/web/src/components/ui/badge.tsx`, `apps/web/src/components/ui/skeleton.tsx`

- [x] **T2 — notesViewStore + noteUtils** [PARALLEL] ~15 min
  - Create `apps/web/src/stores/notesViewStore.ts`
    - `sort: 'createdAt:desc' | 'createdAt:asc' | 'updatedAt:desc' | 'updatedAt:asc'`
    - `setSort(sort)` action; default `'createdAt:desc'`; in-memory only (no persist)
  - Create `apps/web/src/lib/noteUtils.ts`
    - `extractPlainText(json: unknown): string` — recurse `content[].content` collecting `text` nodes; cap at 100 chars
  - Create `apps/web/src/__tests__/stores/notesViewStore.test.ts`
    - Tests: default sort value, `setSort` updates correctly, multiple store accesses share state
  - Create `apps/web/src/__tests__/lib/noteUtils.test.ts`
    - Tests: paragraph node, heading node, nested (list > listItem > paragraph), empty doc, non-JSON input
  - **Scenarios:** UI-NOTES-SORT-S1 (store precondition), UI-NOTES-SORT-S2 (store persistence)
  - **Files touched:** `apps/web/src/stores/notesViewStore.ts`, `apps/web/src/lib/noteUtils.ts`, `apps/web/src/__tests__/stores/notesViewStore.test.ts`, `apps/web/src/__tests__/lib/noteUtils.test.ts`

- [x] **T3 — Leaf presentational components: TagChip, NotesEmptyState, NoteCard** ~25 min
  - _Depends on T1 (Badge, Skeleton)_
  - Create `apps/web/src/components/notes/TagChip.tsx`
    - Props: `id`, `name`, `color`, `active: boolean`, `onToggle(id: string) => void`
    - Uses `<Badge>` with active/inactive variant; `aria-pressed` for accessibility
  - Create `apps/web/src/components/notes/NotesEmptyState.tsx`
    - Props: `variant: 'empty' | 'no-match'`
    - `'empty'`: lucide `<FileText />` + "No notes yet" + "Create your first note" `<Link to="/notes/new">`
    - `'no-match'`: lucide `<FileText />` + "No notes match these filters" (no CTA)
  - Create `apps/web/src/components/notes/NoteCard.tsx`
    - Props: `note: { id, title, body, updatedAt, tags: Tag[] }`
    - Card body is `<Link to={/notes/${id}}>`, title (2-line clamp), `extractPlainText(body)` preview, `formatDistanceToNow(updatedAt)`, read-only `<TagChip>` list, `<Share2>` icon button (no-op `() => {}`, `aria-label="Share note"`)
    - Uses `<Skeleton>` shape for loading variant (passed via `loading?: boolean` prop or separate `<NoteCardSkeleton />` component)
  - **Scenarios:** UI-NOTES-LIST-S1 (card renders correctly)
  - **Files touched:** `apps/web/src/components/notes/TagChip.tsx`, `apps/web/src/components/notes/NotesEmptyState.tsx`, `apps/web/src/components/notes/NoteCard.tsx`

- [x] **T4 — NotesSortDropdown + TagFilterChips** ~20 min
  - _Depends on T1 (Select, Badge), T2 (notesViewStore), T3 (TagChip)_
  - Create `apps/web/src/components/notes/NotesSortDropdown.tsx`
    - Uses shadcn/ui `<Select>`; reads `sort` from `notesViewStore`; calls `setSort` on change
    - Options: Newest (`createdAt:desc`), Oldest (`createdAt:asc`), Recently Updated (`updatedAt:desc`), Least Recently Updated (`updatedAt:asc`)
    - `aria-label="Sort notes"`
  - Create `apps/web/src/components/notes/TagFilterChips.tsx`
    - Props: `activeTagIds: string[]`, `onToggle(id: string) => void`
    - `useQuery({ queryKey: ['tags'], queryFn: () => api.get('/tags').then(r => r.data) })`
    - Renders horizontal scroll `div` of `<TagChip>` per tag; shows nothing while loading
    - `aria-label="Filter by tag"`
  - **Scenarios:** UI-NOTES-SORT-S1, UI-NOTES-FILTER-S1, UI-NOTES-FILTER-S2
  - **Files touched:** `apps/web/src/components/notes/NotesSortDropdown.tsx`, `apps/web/src/components/notes/TagFilterChips.tsx`

- [x] **T5 — NotesList** ~30 min
  - _Depends on T1 (Skeleton), T2 (notesViewStore), T3 (NoteCard, NotesEmptyState)_
  - Create `apps/web/src/components/notes/NotesList.tsx`
    - Props: `sort: string`, `tagIds: string[]`
    - `useInfiniteQuery({ queryKey: ['notes', sort, [...tagIds].sort()], queryFn: fetchPage, getNextPageParam: page => page.nextCursor ?? undefined })`
    - `fetchPage` calls `GET /notes?sort=&tagIds=&cursor=&limit=20` via `api.get`
    - Loading state: grid of 4 `<NoteCardSkeleton />` (or `<Skeleton>` shapes)
    - Error state: page-level error message + "Retry" button calling `refetch()`
    - `422 INVALID_TAG` error: `toast.error(errorMessages.INVALID_TAG)` + call `onClearTagFilter()` prop
    - Empty state: `<NotesEmptyState variant={tagIds.length ? 'no-match' : 'empty'} />`
    - Cards: `pages.flatMap(p => p.items).filter(n => !n.deletedAt)` → `<NoteCard>` per item
    - "Load more" button: shown when `hasNextPage`; uses `useMinDuration(isFetchingNextPage, 200)` for spinner
  - **Scenarios:** UI-NOTES-LIST-S1, UI-NOTES-LIST-S2, UI-NOTES-LIST-S3, UI-NOTES-EMPTY-S1, UI-NOTES-EMPTY-S2, UI-AUTH-LOADING-S1
  - **Files touched:** `apps/web/src/components/notes/NotesList.tsx`

- [x] **T6 — NotesPage route component** ~20 min
  - _Depends on T2 (notesViewStore), T4 (NotesSortDropdown, TagFilterChips), T5 (NotesList)_
  - Create `apps/web/src/pages/notes/NotesPage.tsx`
    - `useSearchParams()` → parse `tags` param → `activeTagIds: string[]`
    - `useNotesViewStore(s => s.sort)` → `sort`
    - `onToggle(id)`: toggle ID in URL via `setSearchParams(next.length ? { tags: next.join(',') } : {}, { replace: true })`
    - Renders:
      - Page header row: title "Notes" + `<Link to="/notes/new"><Button><Plus /> New Note</Button></Link>`
      - Controls row: `<NotesSortDropdown />` on left + `<TagFilterChips activeTagIds onToggle />` on right
      - `<NotesList sort tagIds={activeTagIds} onClearTagFilter={() => setSearchParams({}, { replace: true })} />`
  - **Scenarios:** UI-NOTES-FILTER-S1, UI-NOTES-FILTER-S2, UI-NOTES-FILTER-S3, UI-NOTES-SORT-S2
  - **Files touched:** `apps/web/src/pages/notes/NotesPage.tsx`

- [x] **T7 — Wire App.tsx + update AppHeader + errorMessages** ~15 min
  - _Depends on T6 (NotesPage)_
  - `apps/web/src/App.tsx`: import `NotesPage`; replace `/notes` `<div>Coming soon</div>` with `<NotesPage />`
  - `apps/web/src/components/layout/AppHeader.tsx`:
    - Add `<Link to="/notes/new"><Button size="sm"><Plus /> New Note</Button></Link>` in header right area (before Logout)
    - Add `<span aria-disabled="true" className="... cursor-not-allowed opacity-50">Trash (Coming Soon)</span>` in nav
  - `apps/web/src/lib/errorMessages.ts`: add `INVALID_TAG: 'One or more selected tags are invalid. Filter cleared.'`
  - **Scenarios:** UI-NOTES-TRASH-S1
  - **Files touched:** `apps/web/src/App.tsx`, `apps/web/src/components/layout/AppHeader.tsx`, `apps/web/src/lib/errorMessages.ts`

- [x] **T8 — MSW notes handlers + update server.ts** [PARALLEL with T3–T6] ~20 min
  - Create `apps/web/src/mocks/handlers/notes.handlers.ts`
    - `GET /notes`: returns paginated mock notes (20 items first page, 5 second page, `nextCursor: null` on last). Respects `limit` param. Ignores `sort`/`tagIds` in mock (tests assert query key, not ordering).
    - Include a variant for empty response (controlled by query param or separate handler override in tests).
    - `GET /tags`: returns array of 3 mock tags `[{ id, name, color, noteCount }]`
  - Update `apps/web/src/mocks/server.ts`: import `notesHandlers`; add to `setupServer(...authHandlers, ...notesHandlers)`
  - **Scenarios:** all test scenarios depend on these handlers
  - **Files touched:** `apps/web/src/mocks/handlers/notes.handlers.ts`, `apps/web/src/mocks/server.ts`

- [x] **T9 — Integration tests: NotesPage** [SUBAGENT] ~50 min
  - _Depends on T6, T7, T8 all complete_
  - Create `apps/web/src/__tests__/pages/NotesPage.test.tsx`
  - One named test per scenario ID:

    | Test name | Scenario |
    |---|---|
    | `UI-NOTES-LIST-S1 first page loads with skeleton then cards` | Skeleton shown during fetch; cards rendered after |
    | `UI-NOTES-LIST-S2 load more appends next page` | Click "Load more"; 5 more cards appended; button hidden after |
    | `UI-NOTES-LIST-S3 query key updates on sort change` | Change sort; new query issued with updated key |
    | `UI-NOTES-SORT-S1 sort selection triggers refetch` | Select "Oldest"; GET /notes called with `sort=createdAt:asc` |
    | `UI-NOTES-SORT-S2 sort survives navigation away and back` | Unmount + remount; store retains sort selection |
    | `UI-NOTES-FILTER-S1 clicking tag chip adds to URL` | Click chip; `?tags=tag-1` in URL; GET /notes called with `tagIds=tag-1` |
    | `UI-NOTES-FILTER-S2 clicking active chip removes from URL` | Click active chip; `tags` param removed from URL |
    | `UI-NOTES-FILTER-S3 URL tag filter restored on back-navigation` | Render with `?tags=tag-1,tag-2`; both chips highlighted; query issued |
    | `UI-NOTES-EMPTY-S1 no-notes empty state when no filters` | Empty response + no filter → "No notes yet" + "Create your first note" button |
    | `UI-NOTES-EMPTY-S2 filter empty state when filters applied` | Empty response + filter active → "No notes match these filters"; no CTA |
    | `UI-NOTES-TRASH-S1 trash nav item present but disabled` | "Trash (Coming Soon)" in header; `aria-disabled="true"` |
    | `UI-AUTH-LOADING-S1 load more shows spinner min 200ms` | `isFetchingNextPage` true → spinner; false → spinner persists ≥200ms |

  - Use `@testing-library/react`, `userEvent`, MSW server from `mocks/server.ts`
  - Wrap render in `QueryClientProvider` + `MemoryRouter` (with `initialEntries`)
  - Reset `notesViewStore` between tests via `useNotesViewStore.setState({ sort: 'createdAt:desc' })`
  - **Scenarios:** UI-NOTES-LIST-S1..S3, UI-NOTES-SORT-S1..S2, UI-NOTES-FILTER-S1..S3, UI-NOTES-EMPTY-S1..S2, UI-NOTES-TRASH-S1, UI-AUTH-LOADING-S1
  - **Files touched:** `apps/web/src/__tests__/pages/NotesPage.test.tsx`

---

## Summary

| Task | Estimate | Parallel? | Subagent? |
|---|---|---|---|
| T1 — shadcn/ui primitives + package | 20 min | ✅ (with T2) | — |
| T2 — notesViewStore + noteUtils + unit tests | 15 min | ✅ (with T1) | — |
| T3 — TagChip, NotesEmptyState, NoteCard | 25 min | — | — |
| T4 — NotesSortDropdown, TagFilterChips | 20 min | — | — |
| T5 — NotesList | 30 min | — | — |
| T6 — NotesPage | 20 min | — | — |
| T7 — App.tsx + AppHeader + errorMessages | 15 min | — | — |
| T8 — MSW handlers + server.ts | 20 min | ✅ (with T3–T6) | — |
| T9 — Integration tests | 50 min | — | ✅ |
| **Total** | **~215 min** | | |
