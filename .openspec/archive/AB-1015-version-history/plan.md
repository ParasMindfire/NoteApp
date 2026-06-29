---
ticket: AB-1015
title: Frontend — Version History
status: APPROVED
created: 2026-06-29
---

## Overview

Wire the version history API (AB-1009) into the frontend. History button in NoteEditor opens a shadcn/ui Sheet; clicking a version widens the Sheet into a split-pane preview; Restore triggers a confirm modal then reloads the editor in-place.

## Dependencies on Prior Tickets

- **AB-1009** (backend): GET /notes/:id/versions, GET /notes/:id/versions/:versionId, POST /notes/:id/versions/:versionId/restore — archived ✓
- **AB-1012** (frontend): `NoteEditor.tsx` with History button stub, TipTap editor instance, `useAutosave`, `draftStore` — archived ✓
- **AB-1014** (frontend): Share modal pattern (Dialog, RevokeConfirmDialog pattern) — current branch, must be archived before this ticket begins

## Prisma Schema Changes

None — AB-1009 already introduced `NoteVersion` in the database.

## New shadcn/ui Components

| Component | Install command | Used by |
|-----------|----------------|---------|
| `Sheet` | `npx shadcn@latest add sheet` | `HistoryDrawer.tsx` |

> `AlertDialog` is NOT needed — `RestoreConfirmDialog` follows the `RevokeConfirmDialog` pattern from AB-1014 which uses `Dialog` from `@/components/ui/dialog`.

## New npm Packages

None — `date-fns` is already installed (AB-1012); TipTap packages are already installed (AB-1012).

## Files to Create

| # | File | Purpose |
|---|------|---------|
| 1 | `apps/web/src/types/versions.ts` | `NoteVersion` TypeScript interface matching backend response shape |
| 2 | `apps/web/src/lib/tiptapUtils.ts` | `extractTextFromTipTap(json)` — recursive TipTap JSON → plain text; used by `VersionListItem` for 80-char body excerpt |
| 3 | `apps/web/src/components/history/VersionListItem.tsx` | Single version row: version number, `formatDistanceToNow` relative time, title preview, 80-char body excerpt |
| 4 | `apps/web/src/components/history/VersionPreviewPane.tsx` | Read-only TipTap render of selected version body; contains "Restore this version" button |
| 5 | `apps/web/src/components/history/RestoreConfirmDialog.tsx` | `Dialog`-based confirm modal — "Restore this version? This will create a new version — your current work won't be lost." — Restore (destructive) + Cancel |
| 6 | `apps/web/src/components/history/HistoryDrawer.tsx` | shadcn/ui `Sheet`; owns `selectedVersionId` state; switches between list mode (`max-w-sm`) and split-pane mode (`w-full max-w-3xl`); queries `['versions', noteId]` and `['version', noteId, versionId]`; fires `restoreVersion` mutation |
| 7 | `apps/web/src/mocks/handlers/version.handlers.ts` | MSW handlers for GET /notes/:noteId/versions, GET /notes/:noteId/versions/:versionId, POST /notes/:noteId/versions/:versionId/restore |
| 8 | `apps/web/src/__tests__/components/HistoryDrawer.test.tsx` | Vitest + RTL tests for all 6 spec scenarios |

## Files to Modify

| File | Change |
|------|--------|
| `apps/web/src/components/editor/NoteEditor.tsx` | (1) Add `historyOpen` state; (2) replace `onClick={() => {}}` on History button with `() => setHistoryOpen(true)`; (3) add `handleRestore` callback that calls `editor?.commands.setContent(note.body)`, updates title state, and calls `queryClient.invalidateQueries(['note', noteId])`; (4) render `<HistoryDrawer>` at the bottom of JSX |
| `apps/web/src/lib/errorMessages.ts` | Add `VERSION_NOT_FOUND: 'Version not found.'` to the `errorMessages` map |
| `apps/web/src/mocks/server.ts` | Import `versionHandlers` from `./handlers/version.handlers` and spread into `setupServer(...)` |

## Type Definitions

### `apps/web/src/types/versions.ts`

```ts
export interface NoteVersion {
  id: string;
  version: number;
  title: string;
  body: Record<string, unknown>;  // only present in GET /versions/:versionId (single fetch)
  savedAt: string;                // ISO 8601
}

export interface NoteVersionSummary {
  id: string;
  version: number;
  title: string;
  savedAt: string;                // body omitted in list view per FR-VER-2
}
```

## Component Interfaces

### `HistoryDrawer`
```ts
interface HistoryDrawerProps {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTitle: string;                        // from NoteEditor title state
  currentBody: Record<string, unknown>;        // from NoteEditor bodyRef.current
  onRestore: (note: Note) => void;             // callback into NoteEditor
}
```

### `VersionListItem`
```ts
interface VersionListItemProps {
  version: NoteVersionSummary;
  isSelected: boolean;
  onClick: (id: string) => void;
}
```

### `VersionPreviewPane`
```ts
interface VersionPreviewPaneProps {
  version: NoteVersion;
  onRestore: () => void;
  isRestoring: boolean;
}
```

### `RestoreConfirmDialog`
```ts
interface RestoreConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
  versionNumber: number;
}
```

## TanStack Query Keys

| Key | Endpoint | Enabled when |
|-----|----------|-------------|
| `['versions', noteId]` | GET /notes/:noteId/versions | `open === true` |
| `['version', noteId, versionId]` | GET /notes/:noteId/versions/:versionId | `!!selectedVersionId` |

**Mutation:** `restoreVersion` — POST /notes/:noteId/versions/:versionId/restore
- `onSuccess`: call `onRestore(data)`, close drawer (set `selectedVersionId` to null, call `onOpenChange(false)`), `toast.success('Restored version N')`
- `onError`: `toast.error(getErrorMessage(error.response?.data?.code))`

## NoteEditor Modifications (Detail)

```ts
// New state
const [historyOpen, setHistoryOpen] = useState(false);

// handleRestore replaces editor content in-place — no page navigation
const handleRestore = useCallback((restoredNote: Note) => {
  setTitle(restoredNote.title);
  titleRef.current = restoredNote.title;
  editor?.commands.setContent(restoredNote.body);
  bodyRef.current = restoredNote.body as Record<string, unknown>;
  queryClient.invalidateQueries({ queryKey: ['note', note.id] });
}, [editor, note.id]);
```

History button wiring (replaces `onClick={() => {}}`):
```tsx
onClick={() => setHistoryOpen(true)}
```

`<HistoryDrawer>` rendered alongside `<ShareModal>` at the bottom of the JSX:
```tsx
<HistoryDrawer
  noteId={note.id}
  open={historyOpen}
  onOpenChange={setHistoryOpen}
  currentTitle={title}
  currentBody={bodyRef.current}
  onRestore={handleRestore}
/>
```

`queryClient` must be imported from `@/lib/queryClient` (already used in `NoteEditorPage.tsx`).

## MSW Handlers (version.handlers.ts)

```ts
// GET /notes/:noteId/versions
// Returns list ordered newest-first (version DESC)
// Special noteId values:
//   'note-no-versions' → []
//   default → array of 3 NoteVersionSummary fixtures

// GET /notes/:noteId/versions/:versionId
// Returns full NoteVersion including body
// 'bad-version-id' → 404 VERSION_NOT_FOUND

// POST /notes/:noteId/versions/:versionId/restore
// Returns the updated Note (version incremented by 2)
// 'bad-version-id' → 404 VERSION_NOT_FOUND
```

## Test Strategy

**File:** `apps/web/src/__tests__/components/HistoryDrawer.test.tsx`

All 6 spec scenarios in one test file, matching the ShareModal test structure.

| Scenario | Test name | Render target |
|----------|-----------|---------------|
| UI-VER-OPEN-S1 | "History button opens drawer; ESC closes it; aria-label present" | `NoteEditor` (to test the button wiring) |
| UI-VER-LIST-S1 | "Versions displayed newest-first with version number and relative time" | `HistoryDrawer` (open=true) |
| UI-VER-LIST-S2 | "Empty state shown when no versions exist" | `HistoryDrawer` (open=true, noteId='note-no-versions') |
| UI-VER-PREVIEW-S1 | "Click version shows split view; neither pane is editable" | `HistoryDrawer` (open=true) |
| UI-VER-RESTORE-S1 | "Restore confirmed; onRestore called; toast shown; drawer closes" | `HistoryDrawer` (open=true, onRestore=vi.fn()) |
| UI-VER-CONFIRM-S1 | "Cancel restore; POST not called; split view remains" | `HistoryDrawer` (open=true) |

> UI-VER-OPEN-S1 renders `NoteEditor` (with heavy TipTap deps) — use the same SSR-safe approach as `NoteEditorPage.test.tsx` to avoid DOM warnings. All other tests render `HistoryDrawer` directly via a `renderHistoryDrawer()` helper.

## Risk Areas

| Risk | Mitigation |
|------|------------|
| **Sheet Tailwind class purging** — `max-w-3xl` and `w-full` applied conditionally via `cn()` may be purged if not detected by Tailwind's content scan | Use string literals in `cn()` call, not template literals: `cn(isPreview ? 'w-full max-w-3xl' : 'max-w-sm')` so Tailwind can see the full class names |
| **Left pane reads `bodyRef.current`** — unsaved in-flight content must be the left pane baseline, not the server snapshot | Pass `currentBody` and `currentTitle` as props from NoteEditor (refs are always current); do NOT fetch GET /notes/:id again inside HistoryDrawer |
| **Read-only TipTap in split view** — `VersionPreviewPane` needs its own `useEditor` instance with `editable: false` | Create a second `useEditor({ extensions: [StarterKit], content: version.body, editable: false })` inside `VersionPreviewPane`; set `editable: false` also on the left-pane TipTap |
| **`queryClient` import in NoteEditor** — not currently imported there (only in NoteEditorPage) | Import `queryClient` from `@/lib/queryClient` — singleton already exported from that module |
| **`handleRestore` stale closure** | Wrap in `useCallback` with deps `[editor, note.id]`; pass `editor` as stable dep (TipTap's `useEditor` returns stable ref) |
| **Toast version number** — "Restored version N" where N is the old snapshot version (not the new count) | Read `selectedVersion.version` from the `['versions', noteId]` query data inside the mutation's `onSuccess`; pass it to toast before the data re-fetches |

## Task Ordering

```
T1  Install shadcn/ui Sheet               (prerequisite — run before any code)
T2  types/versions.ts                     (no deps)
T3  lib/tiptapUtils.ts                    (no deps)
T4  errorMessages.ts — add VERSION_NOT_FOUND  (no deps)
  [T2, T3, T4 can run in parallel]
T5  components/history/VersionListItem.tsx    (needs T2, T3)
T6  components/history/VersionPreviewPane.tsx (needs T2)
T7  components/history/RestoreConfirmDialog.tsx  (no deps beyond Dialog)
  [T5, T6, T7 can run in parallel after T2/T3]
T8  components/history/HistoryDrawer.tsx      (needs T5, T6, T7)
T9  NoteEditor.tsx modifications              (needs T8)
T10 mocks/handlers/version.handlers.ts        (needs T2)
T11 mocks/server.ts — add versionHandlers     (needs T10)
T12 __tests__/components/HistoryDrawer.test.tsx  (needs T8, T9, T11)
```
