---
ticket: AB-1011
title: Frontend — Notes List
status: APPROVED
created: 2026-06-27
---

# AB-1011 — Implementation Plan: Notes List

## Dependencies

- AB-1010 merged (Axios client, authStore, PrivateRoute, AppLayout, queryClient, errorMessages.ts, AppHeader) ✅
- Backend AB-1005 merged (`GET /notes` cursor-paginated with sort + tagIds) — required at runtime
- Backend AB-1006 merged (`GET /tags`) — required at runtime
- MSW mocks stand in for backend during tests

---

## New Packages

| Package | Version | Why |
|---|---|---|
| `@radix-ui/react-select` | `2.1.7` | Radix primitive for shadcn/ui `Select` component (sort dropdown). Pinned to match existing `@radix-ui/react-label: 2.1.0` major. |

Install location: `apps/web/package.json` dependencies.

---

## Files to Create

### shadcn/ui primitives (no logic, copy-paste pattern)

| File | Purpose |
|---|---|
| `apps/web/src/components/ui/select.tsx` | shadcn/ui Select wrapping `@radix-ui/react-select` |
| `apps/web/src/components/ui/badge.tsx` | shadcn/ui Badge (Tailwind-only CVA variants — no Radix) |
| `apps/web/src/components/ui/skeleton.tsx` | shadcn/ui Skeleton (Tailwind pulse animation — no Radix) |

### State

| File | Purpose |
|---|---|
| `apps/web/src/stores/notesViewStore.ts` | Zustand slice: `sort` + `setSort`. Default `'createdAt:desc'`. In-memory only (no persist). |

### Lib / Utilities

| File | Purpose |
|---|---|
| `apps/web/src/lib/noteUtils.ts` | `extractPlainText(json: unknown): string` — recursively collects `text` leaf nodes from TipTap JSON doc; capped at 100 chars. Pure function, no deps. |

### Feature components

| File | Purpose |
|---|---|
| `apps/web/src/components/notes/TagChip.tsx` | shadcn/ui `Badge` variant wrapper; `active` prop controls highlight; click emits `onToggle(id)` |
| `apps/web/src/components/notes/NotesEmptyState.tsx` | Two variants via `variant: 'empty' \| 'no-match'`; lucide `<FileText />` icon; CTA button only on `'empty'` |
| `apps/web/src/components/notes/NoteCard.tsx` | Card with title (2-line clamp), body preview, relative `updatedAt`, read-only tag chips, share icon (no-op stub). Entire card body is `<Link to="/notes/:id">`. |
| `apps/web/src/components/notes/NotesSortDropdown.tsx` | `Select` reading/writing `notesViewStore`. Four options: Newest / Oldest / Recently Updated / Least Recently Updated. |
| `apps/web/src/components/notes/TagFilterChips.tsx` | `useQuery(['tags'])` → horizontal scroll row of `<TagChip />`. Reads active IDs from `activeTagIds` prop; calls `onToggle` prop. |
| `apps/web/src/components/notes/NotesList.tsx` | `useInfiniteQuery(['notes', sort, tagIds])` → skeleton (loading) / error (retry) / empty state / card grid + "Load more" button. |

### Page

| File | Purpose |
|---|---|
| `apps/web/src/pages/notes/NotesPage.tsx` | Route component. Reads `useSearchParams` for `tags` param; reads `notesViewStore` for `sort`. Renders `<NotesSortDropdown>`, `<TagFilterChips>`, "New Note" button, `<NotesList>`. |

### MSW mocks

| File | Purpose |
|---|---|
| `apps/web/src/mocks/handlers/notes.handlers.ts` | MSW handlers for `GET /notes` (paginated, respects `sort`/`tagIds`/`cursor`/`limit`) and `GET /tags` |

### Tests

| File | Scenarios covered |
|---|---|
| `apps/web/src/__tests__/pages/NotesPage.test.tsx` | UI-NOTES-LIST-S1, S2, S3; UI-NOTES-SORT-S1, S2; UI-NOTES-FILTER-S1, S2, S3; UI-NOTES-EMPTY-S1, S2; UI-NOTES-TRASH-S1; UI-AUTH-LOADING-S1 |
| `apps/web/src/__tests__/lib/noteUtils.test.ts` | Unit tests for `extractPlainText` (paragraph, heading, nested, empty, non-JSON) |
| `apps/web/src/__tests__/stores/notesViewStore.test.ts` | Default sort, `setSort` updates, survives re-access |

---

## Files to Modify

| File | Change |
|---|---|
| `apps/web/package.json` | Add `"@radix-ui/react-select": "2.1.7"` to dependencies |
| `apps/web/src/App.tsx` | Import `NotesPage`; replace `<div>Coming soon</div>` on `/notes` route with `<NotesPage />` |
| `apps/web/src/components/layout/AppHeader.tsx` | Add `<Link to="/notes/new">` "New Note" button (lucide `<Plus />`); add `aria-disabled` "Trash (Coming Soon)" nav item |
| `apps/web/src/lib/errorMessages.ts` | Add `INVALID_TAG: "One or more selected tags are invalid. Filter cleared."` |
| `apps/web/src/mocks/server.ts` | Import `notesHandlers`; spread into `setupServer(...)` |

---

## Prisma Schema Changes

None — this is a frontend-only ticket.

---

## Architecture Notes

### Data flow
```
NotesPage
  ├── useSearchParams()          → activeTagIds: string[]
  ├── notesViewStore             → sort: string
  ├── <NotesSortDropdown />      → writes sort to store
  ├── <TagFilterChips />         → reads ['tags'] query; calls setSearchParams on toggle
  └── <NotesList sort tagIds />
        └── useInfiniteQuery(['notes', sort, tagIds])
              └── GET /notes?sort=&tagIds=&cursor=&limit=20
```

### Query key stability
`tagIds` in the query key must be a stable reference (sorted + joined string or sorted array). Sort the IDs before putting them in the key to prevent spurious refetches: `[...tagIds].sort()`.

### `useInfiniteQuery` shape
```ts
getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
// pages[].items flattened for rendering
```

### "Load more" spinner
Reuse existing `useMinDuration(isFetchingNextPage, 200)` hook for 200 ms anti-flicker guarantee.

### Body preview
`extractPlainText` is called inside `NoteCard` at render time — no memoization needed (cards only re-render on data change). Cap output at 100 chars with `slice(0, 100)`.

### Tag chip URL sync
```ts
// toggle tag in URL
const next = activeTagIds.includes(id)
  ? activeTagIds.filter(t => t !== id)
  : [...activeTagIds, id];
setSearchParams(next.length ? { tags: next.join(',') } : {});
```

### Error handling in `NotesList`
- `isError` → page-level error component with "Retry" button (`refetch()`).
- `422 INVALID_TAG` from `GET /notes` → toast via sonner + `setSearchParams({})` to clear tags param.
- Both handled in `NotesList` `onError` / catch in query config.

---

## Task Order

Tasks are designed to be atomic (each independently completable and testable):

1. **[T1] Add Select/Badge/Skeleton + install @radix-ui/react-select**
   - `package.json`, `ui/select.tsx`, `ui/badge.tsx`, `ui/skeleton.tsx`

2. **[T2] notesViewStore + noteUtils**
   - `stores/notesViewStore.ts`, `lib/noteUtils.ts`
   - Unit tests: `notesViewStore.test.ts`, `noteUtils.test.ts`

3. **[T3] Leaf components: TagChip, NotesEmptyState, NoteCard**
   - No queries; pure presentational + props

4. **[T4] NotesSortDropdown + TagFilterChips**
   - Query-connected components; depend on T1 + T2 + T3

5. **[T5] NotesList**
   - `useInfiniteQuery`; depends on T3 + T4

6. **[T6] NotesPage**
   - Route component wiring everything; depends on T4 + T5

7. **[T7] App.tsx + AppHeader + errorMessages wiring**
   - Plug `NotesPage` into router; add New Note button + Trash placeholder

8. **[T8] MSW notes handlers + update server.ts**
   - Mock `GET /notes` + `GET /tags`

9. **[T9] Tests — NotesPage integration tests**
   - All 12 scenario tests; depends on T6 + T8

---

## Risk Areas

| Risk | Mitigation |
|---|---|
| `@radix-ui/react-select` version mismatch with React 19 | Pin `2.1.7`; matches existing Radix `2.x` packages in repo |
| `useInfiniteQuery` key causing infinite refetch | Sort `tagIds` before including in key; use primitive join string |
| URL param changes triggering full re-mount | Use `setSearchParams` with `{ replace: true }` to avoid pushing to history on every chip click |
| TipTap JSON nested deeply (blockquote inside list) | `extractPlainText` must recurse through `content` at every level |
| `INVALID_TAG` 422 from `GET /notes` (stale URL params) | Handle in NotesList `onError`; clear tags param + show toast |
| AppHeader modification breaking AB-1010 auth tests | Add tests for new header elements; keep existing logout test passing |

---

## Test Strategy

**Unit tests** (fast, no DOM):
- `noteUtils.test.ts` — pure function, multiple TipTap JSON shapes
- `notesViewStore.test.ts` — Zustand slice state transitions

**Integration tests** (jsdom + MSW + Testing Library):
- `NotesPage.test.tsx` — each scenario gets one named test matching the scenario ID

**No new Playwright tests** — E2E coverage is AB-1016's scope.

**Coverage target:** ≥ 80% on all new files (enforced by existing vitest coverage config).
