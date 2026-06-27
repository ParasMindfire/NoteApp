# Review Log — AB-1011 Notes List


## 2026-06-27T00:00:00Z -- Tasks T1-T5

### FR-UI-NOTES-1: Paginated list

[FAIL] FR-UI-NOTES-1 -- Route /notes not wired to NotesList. FRS states: Route /notes, Components NotesList with NoteCard per item. App.tsx line 33: path /notes renders Coming soon div. NotesList exists but is not mounted at /notes route. (T6 not implemented.)

[OK] FR-UI-NOTES-1 -- useInfiniteQuery keyed by [notes, sort, sortedTagIds]: NotesList.tsx line 48. Correctly encodes sort and tag filter in query key.

[OK] FR-UI-NOTES-1 -- Loads first page on mount limit 20: fetchNotesPage sets params.limit=20 with no initial cursor.

[OK] FR-UI-NOTES-1 -- Load more button uses nextCursor: getNextPageParam returns lastPage.nextCursor; button calls fetchNextPage().

[OK] FR-UI-NOTES-1 -- Skeleton screen while loading: NotesList.tsx lines 64-72 render NoteCardSkeleton grid when isLoading is true.

[WARN] FR-UI-NOTES-1 -- UX.md loading indicator within 100ms: no explicit timer enforced; TanStack Query shows loading synchronously on first render so intent is met in practice.

[COVERAGE] FR-UI-NOTES-1 has no test for sub-bullet: query key updates on sort/filter changes. No NotesPage.test.tsx for UI-NOTES-LIST-S1..S3. (T9 not implemented.)

### FR-UI-NOTES-2: Sort dropdown

[OK] FR-UI-NOTES-2 -- shadcn/ui Select used: NotesSortDropdown.tsx imports Select components from @/components/ui/select.

[OK] FR-UI-NOTES-2 -- All four options present: Newest (createdAt:desc), Oldest (createdAt:asc), Recently Updated (updatedAt:desc), Least Recently Updated (updatedAt:asc). Labels and values match FRS exactly.

[OK] FR-UI-NOTES-2 -- Maps to correct sort strings per FRS.

[OK] FR-UI-NOTES-2 -- Zustand notesViewStore: in-memory, no persist middleware, default createdAt:desc. Survives navigation not page reload per FRS.

[OK] FR-UI-NOTES-2 -- Store singleton test covers multiple component instances sharing state at unit level.

[COVERAGE] FR-UI-NOTES-2 has no integration test for state survives navigation away and back (UI-NOTES-SORT-S2). NotesPage.test.tsx does not exist.

### FR-UI-NOTES-3: Tag filter chips

[WARN] FR-UI-NOTES-3 -- FRS and tasks.md T3 specify TagChip uses shadcn/ui Badge variant. TagChip.tsx re-implements the same Tailwind classes inline without wrapping Badge. Visually equivalent but does not use Badge component as specified.

[FAIL] FR-UI-NOTES-3 -- URL is source of truth for tag filter. FRS states: Click chip toggles URL query ?tags=t1,t2; URL is source of truth; reading URL restores filter state. NotesPage (T6) was not implemented. No component reads useSearchParams() or writes ?tags= to URL. URL-based filter state is entirely absent.

[OK] FR-UI-NOTES-3 -- AND semantics matching FR-NOTE-7: NotesList.tsx joins tagIds with commas and passes as tagIds param; backend interprets as AND.

[OK] FR-UI-NOTES-3 -- aria-pressed on toggle chips: TagChip.tsx line 25 sets aria-pressed={active} on interactive button variant.

[COVERAGE] FR-UI-NOTES-3 has no tests for: chip toggles URL (UI-NOTES-FILTER-S1), URL restores filter state (UI-NOTES-FILTER-S3), AND semantics. NotesPage.test.tsx does not exist.

### FR-UI-NOTES-4: Empty state

[OK] FR-UI-NOTES-4 -- lucide-react FileText icon present in NotesEmptyState.tsx.

[OK] FR-UI-NOTES-4 -- Heading No notes yet rendered as h2 for empty variant.

[OK] FR-UI-NOTES-4 -- Subtext: Start capturing your thoughts and ideas.

[OK] FR-UI-NOTES-4 -- Create your first note button linking to /notes/new for empty variant.

[OK] FR-UI-NOTES-4 -- Shown when API returns empty AND no filters: NotesList.tsx line 92 passes variant empty when tagIds.length is 0.

[OK] FR-UI-NOTES-4 -- Filters applied: No notes match these filters rendered for no-match variant. No CTA in no-match (correct per FRS).

[COVERAGE] FR-UI-NOTES-4 has no tests for UI-NOTES-EMPTY-S1 and UI-NOTES-EMPTY-S2. NotesPage.test.tsx does not exist.

### FR-UI-NOTES-5: Soft-deleted notes hidden

[OK] FR-UI-NOTES-5 -- Frontend defensive check: NotesList.tsx line 88 filters with .filter((n) => !n.deletedAt) before rendering cards.

[OK] FR-UI-NOTES-5 -- deletedAt: string | null present in Note interface at types/notes.ts line 16.

[FAIL] FR-UI-NOTES-5 -- FRS states: Trash view: placeholder in nav menu marked Coming Soon. AppHeader has no Trash Coming Soon placeholder (T7 not implemented). Scenario UI-NOTES-TRASH-S1 cannot pass.

[COVERAGE] FR-UI-NOTES-5 has no test for UI-NOTES-TRASH-S1. NotesPage.test.tsx does not exist.

### UX.md Conventions

[OK] UX.md Loading States (min 200ms) -- NotesList.tsx line 62 calls useMinDuration(isFetchingNextPage, 200) for Load more spinner. Hook holds state visible for at least 200ms.

[OK] UX.md Error States (never raw error.detail) -- NotesList.tsx uses getErrorMessage for toast. General error fallback shows generic text not error.detail.

[FAIL] UX.md Error States -- UX.md requires API errors map via errorMessages.ts dictionary. T7 was supposed to add INVALID_TAG key with value: One or more selected tags are invalid. Filter cleared. Current errorMessages.ts does NOT contain INVALID_TAG key. getErrorMessage(INVALID_TAG) falls back to: Something went wrong. Please try again. Observed keys in file: AUTH_INVALID_CREDENTIALS, USER_EXISTS, AUTH_OTP_INVALID, VALIDATION_FAILED, RATE_LIMITED, AUTH_REFRESH_INVALID, AUTH_TOKEN_INVALID.

[OK] UX.md Empty States -- icon + heading + subtext + primary action all present for empty variant. no-match variant correctly omits CTA.

[OK] UX.md Accessibility -- aria-labels on all interactive elements: Sort notes on SelectTrigger; Filter by tag with role=group; Open note:{title} on NoteCard Link; Share note on share button; aria-pressed on TagChip toggle buttons.

[OK] UX.md Accessibility -- keyboard-reachable: all interactive elements natively focusable. focus-visible:ring-2 ensures visible focus rings.

### Infrastructure / T1

[OK] T1 -- @radix-ui/react-select pinned at 2.1.7 (no ^ or ~) in apps/web/package.json. Satisfies FR-INFRA-11.

[OK] T1 -- select.tsx is proper shadcn/ui wrapper over @radix-ui/react-select with forwardRef and all sub-components.

[OK] T1 -- badge.tsx uses class-variance-authority CVA for variants (default, secondary, destructive, outline).

[OK] T1 -- skeleton.tsx uses Tailwind animate-pulse as required.

### Summary: Tasks T6-T9 not implemented

[FAIL] NotesPage apps/web/src/pages/notes/NotesPage.tsx does not exist. T6 not implemented. FR-UI-NOTES-1 route mounting, FR-UI-NOTES-3 URL filter state, and sort+filter coordination are all absent from the application.

[FAIL] App.tsx /notes route still renders Coming soon placeholder. T7 not implemented. NotesList component unreachable via the application router.

[FAIL] AppHeader Trash Coming Soon nav item missing. T7 not implemented. FR-UI-NOTES-5 Trash view requirement not met.

[FAIL] INVALID_TAG key absent from apps/web/src/lib/errorMessages.ts. T7 not implemented. getErrorMessage(INVALID_TAG) falls back to generic message.

[FAIL] MSW notes handlers absent: apps/web/src/mocks/handlers/notes.handlers.ts does not exist; server.ts only registers authHandlers. T8 not implemented. Integration tests for notes will fail.

[COVERAGE] No integration tests for FR-UI-NOTES-1..5 scenarios: UI-NOTES-LIST-S1..S3, UI-NOTES-SORT-S1..S2, UI-NOTES-FILTER-S1..S3, UI-NOTES-EMPTY-S1..S2, UI-NOTES-TRASH-S1, UI-AUTH-LOADING-S1. T9 not implemented.

## 2026-06-27 — Tasks T6-T9

### FR-UI-NOTES-1: Paginated list

[OK] Route /notes wired to `<NotesPage />` in App.tsx line 33 — not "Coming soon" placeholder.

[OK] `useInfiniteQuery` keyed by `['notes', sort, sortedTagIds]` (NotesList.tsx:48) — query key updates on sort/filter changes verified by test UI-NOTES-LIST-S3.

[OK] Loads first page on mount with limit 20 — fetchNotesPage sets params.limit='20' with no initial cursor (NotesList.tsx:29).

[OK] Load more button uses nextCursor — getNextPageParam returns lastPage.nextCursor; button calls fetchNextPage() (NotesList.tsx:52, 107).

[OK] Skeleton screen while loading — NotesList.tsx lines 64-72 render NoteCardSkeleton grid when isLoading is true.

[OK] Test UI-NOTES-LIST-S1: first page loads with skeleton then cards — verifies skeleton shows during fetch, cards appear after.

[OK] Test UI-NOTES-LIST-S2: load more appends next page — renders notes 1-20, clicks Load more, notes 21-25 appear, button hidden on final page.

[OK] Test UI-NOTES-LIST-S3: query key updates on sort change — Zustand sort change triggers new query.

### FR-UI-NOTES-2: Sort dropdown

[OK] shadcn/ui Select component used (NotesSortDropdown.tsx:1-7).

[OK] All four options present with correct labels and sort values: Newest (createdAt:desc), Oldest (createdAt:asc), Recently Updated (updatedAt:desc), Least Recently Updated (updatedAt:asc).

[OK] Zustand `notesViewStore` sort passed to NotesList via NotesPage (NotesPage.tsx:11, 45). NotesList includes sort in queryKey (NotesList.tsx:48).

[OK] Persistence: in-memory Zustand store survives navigation away and back; does NOT persist across page reload (by design per FRS).

[OK] Test UI-NOTES-SORT-S1: sort selection triggers refetch — store setState updates sort, list re-renders with new sort value.

[OK] Test UI-NOTES-SORT-S2: sort selection survives navigation away and back — unmount/remount with same QueryClient, Zustand store persists; SelectTrigger displays "Recently Updated".

### FR-UI-NOTES-3: Tag filter chips

[OK] `useSearchParams()` used in NotesPage (NotesPage.tsx:10) — parses URL for source of truth.

[OK] `setSearchParams` with `{ replace: true }` on tag toggle (NotesPage.tsx:21) — does not create browser history entry.

[OK] activeTagIds parsed from URL `?tags=` param (NotesPage.tsx:13-15) — splits comma-separated string, filters empty strings.

[OK] TagFilterChips rendered and onToggle wired (NotesPage.tsx:42).

[OK] AND semantics: NotesList joins multiple tagIds with commas (NotesList.tsx:30); backend filters with AND logic (notes.handlers.ts:52-53).

[OK] INVALID_TAG error handling: NotesList.tsx:56 detects INVALID_TAG error code, calls onClearTagFilter, shows toast with mapped message.

[OK] Test UI-NOTES-FILTER-S1: clicking tag chip adds to URL and filters — clicks Work chip, aria-pressed becomes true, filtered notes appear.

[OK] Test UI-NOTES-FILTER-S2: clicking active chip removes from URL — chip is initially active in URL, click deactivates, aria-pressed becomes false.

[OK] Test UI-NOTES-FILTER-S3: URL tag filter restored on back-navigation — render with ?tags=tag-1,tag-2 in URL, both chips have aria-pressed=true.

### FR-UI-NOTES-4: Empty state

[OK] NotesPage renders NotesList (NotesPage.tsx:45) which renders NotesEmptyState (NotesList.tsx:92).

[OK] lucide-react `<FileText />` icon present (NotesEmptyState.tsx:12).

[OK] Heading "No notes yet" rendered as h2 for empty variant (NotesEmptyState.tsx:15).

[OK] Subtext "Start capturing your thoughts and ideas." (NotesEmptyState.tsx:16-18).

[OK] "Create your first note" button links to /notes/new (NotesEmptyState.tsx:20).

[OK] Shown when API returns empty AND no filters (NotesList.tsx:92 — variant empty when tagIds.length === 0).

[OK] Filter empty state: "No notes match these filters" with no CTA for no-match variant (NotesEmptyState.tsx:24-29).

[OK] Test UI-NOTES-EMPTY-S1: no-notes empty state when no filters applied — MSW returns empty list, "No notes yet" heading visible, CTA button present.

[OK] Test UI-NOTES-EMPTY-S2: filter empty state when filters applied — render with ?tags=tag-empty in URL, "No notes match these filters" visible, no CTA.

### FR-UI-NOTES-5: Soft-deleted notes hidden

[OK] Frontend defensive check: NotesList.tsx:88 filters with `.filter((n) => !n.deletedAt)` before rendering cards.

[OK] Trash (Coming Soon) placeholder in AppHeader with `aria-disabled="true"` (AppHeader.tsx:37-43).

[OK] Test UI-NOTES-TRASH-S1: trash nav item present but disabled — finds "Trash (Coming Soon)" element, confirms aria-disabled="true".

### UX.md Conventions

[OK] INVALID_TAG key present in errorMessages.ts (line 9) with value "One or more selected tags are invalid. Filter cleared."

[OK] Min 200ms loading indicator: NotesList.tsx:62 calls useMinDuration(isFetchingNextPage, 200) on Load more button (UX.md line 8).

[OK] Empty states follow convention: icon + heading + subtext + primary action (NotesList.tsx:92; NotesEmptyState.tsx).

[OK] Accessibility: aria-labels on SelectTrigger (NotesSortDropdown.tsx:23), group role on filter chips (TagFilterChips.tsx:24), aria-pressed on toggles (TagChip.tsx).

### Test Coverage (T9)

[OK] 12 named tests covering all 12 required scenarios:
- UI-NOTES-LIST-S1, S2, S3 ✓
- UI-NOTES-SORT-S1, S2 ✓
- UI-NOTES-FILTER-S1, S2, S3 ✓
- UI-NOTES-EMPTY-S1, S2 ✓
- UI-NOTES-TRASH-S1 ✓
- UI-AUTH-LOADING-S1 ✓

[OK] Fresh QueryClient per test: makeQueryClient() returns new QueryClient with retry: false, staleTime: 0, gcTime: 0 (lines 24-35).

[OK] MSW handlers wired: notesHandlers in server.ts (mocks/server.ts:5), notes.handlers.ts provides GET /notes and GET /tags with cursor-based pagination, tag filtering, empty-list simulation for test scenarios.

### Summary: All FR-UI-NOTES-1 through FR-UI-NOTES-5 complete and passing

All acceptance criteria met. All test scenarios pass. All UX conventions honored.
