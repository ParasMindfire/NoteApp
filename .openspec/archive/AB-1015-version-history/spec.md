---
ticket: AB-1015
title: Frontend — Version History
status: APPROVED
created: 2026-06-29
---

## Overview

AB-1015 wires the version history API (merged in AB-1009) into the frontend. A "History" button in the note editor toolbar opens a shadcn/ui Sheet that slides in from the right, listing all saved versions newest-first with relative timestamps. Clicking a version switches the Sheet into a wider split-pane mode: the current (live) note rendered read-only on the left, and the selected historical version rendered as a read-only TipTap instance on the right. A "Restore this version" button triggers a confirm modal; on confirm, the backend creates a new version snapshot, the editor reloads with the restored content, and the drawer closes. This ticket modifies `NoteEditor.tsx` and introduces the `HistoryDrawer` component family.

## Goals

- Let users browse all saved snapshots of a note and identify the one they want to review or restore.
- Allow a non-destructive restore: the current draft is snapshot-preserved by the backend before any overwrite.
- Enforce the confirm-before-destructive pattern to prevent accidental restores.

## Non-Goals

- No diff/highlight of changes between versions — side-by-side render only.
- No ability to delete or export individual versions.
- No version browser outside the note editor (the Sheet is editor-only).
- No manual versioning trigger — versions are created exclusively by autosave (FR-VER-1 / FR-NOTE-3).

## FRs Covered

- FR-UI-VER-1: History drawer
- FR-UI-VER-2: Version list
- FR-UI-VER-3: Version preview
- FR-UI-VER-4: Restore creates new version
- FR-UI-VER-5: Confirm modal before restore

## Pages / Components

| Component | Location | Role |
|-----------|----------|------|
| `<HistoryDrawer />` | `components/history/HistoryDrawer.tsx` | shadcn/ui Sheet wrapper; owns `selectedVersionId` state; toggles list vs. split-pane mode |
| `<VersionListItem />` | `components/history/VersionListItem.tsx` | Single row: version number, relative time, title preview; clickable |
| `<VersionPreviewPane />` | `components/history/VersionPreviewPane.tsx` | Read-only TipTap render of the selected version's body; includes "Restore this version" button |
| `<RestoreConfirmDialog />` | `components/history/RestoreConfirmDialog.tsx` | shadcn/ui AlertDialog for the confirm-before-restore step |

**Modified components:**
- `NoteEditor.tsx` — "History" button stub (added in AB-1012) wired to `setHistoryOpen(true)` + `<HistoryDrawer noteId={noteId} open={historyOpen} onOpenChange={setHistoryOpen} onRestore={handleRestore} />`

## State Management

**TanStack Query**

| Key | Endpoint | Notes |
|-----|----------|-------|
| `['versions', noteId]` | GET /notes/:noteId/versions | Fetched when drawer opens (`enabled: open`) |
| `['version', noteId, versionId]` | GET /notes/:noteId/versions/:versionId | Fetched when a version is selected (`enabled: !!selectedVersionId`) |

**Mutations**
- `restoreVersion` — POST /notes/:noteId/versions/:versionId/restore → on 200: call `onRestore(data)` callback to reload editor content, close drawer, show success toast "Restored version N"

**Zustand — none.** Drawer open/close state is local `useState` in `NoteEditor`. `selectedVersionId` is local `useState` in `HistoryDrawer`. No server data goes into Zustand (per UX.md state management rule).

## API Integration

| Method | Endpoint | Triggered by | Success | Error |
|--------|----------|--------------|---------|-------|
| GET | /notes/:id/versions | Drawer opens | 200 → render `<VersionListItem />` list | 401 → interceptor; 404 → toast "Note not found" |
| GET | /notes/:id/versions/:versionId | Version item clicked | 200 → render `<VersionPreviewPane />` | 401 → interceptor; 404 → toast "Version not found" |
| POST | /notes/:id/versions/:versionId/restore | Restore confirmed | 200 → editor reload + toast + close drawer | 401 → interceptor; 404 → toast "Version not found" |

**Error code → message mappings to add in `errorMessages.ts`:**

| Code | User-facing message |
|------|---------------------|
| `VERSION_NOT_FOUND` | "Version not found." |

## Ticket-Specific UX Decisions

1. **Split view triggered within the Sheet.** When the user clicks a version, the Sheet widens from a narrow list view (`max-w-sm`) into split-pane mode (`w-full max-w-3xl`). The left panel shows the current live note content sourced from the already-loaded editor state (no extra API call, rendered as read-only TipTap with `editable: false`). The right panel shows the selected version fetched from GET /notes/:id/versions/:versionId. This keeps the split view self-contained in the Sheet without restructuring the editor layout behind it.

2. **Body excerpt removed from scope.** `GET /notes/:id/versions` returns `[{ id, version, savedAt, title }]` — no body field (per FR-VER-2: "no body in list view"). Showing an excerpt would require a backend change outside this ticket's scope. `<VersionListItem />` shows version number, relative time, and title only. The `extractTextFromTipTap` utility (`lib/tiptapUtils.ts`) exists from AB-1012 and remains available.

3. **Relative timestamps via date-fns.** `formatDistanceToNow(new Date(savedAt), { addSuffix: true })` produces "2 hours ago" format. `date-fns` is already installed (AB-1012). No additional dependency needed.

4. **Empty state for version list.** If the API returns an empty list (edge case: note was never autosaved), show a lucide `<History />` icon + "No versions yet" text — consistent with UX.md empty-state pattern but without a primary action button (the user cannot trigger a version save directly).

5. **Restore toast version number.** The 200 response from POST /notes/:id/versions/:versionId/restore returns the updated note including its new `version` field (per FR-NOTE-3). However, the toast reads "Restored version N" where N is the `version` field of the snapshot that was applied (the old snapshot being restored), obtained from the `selectedVersionId` item in the already-fetched `['versions', noteId]` query data — not the new incremented count.

6. **Restore button loading state.** While POST is in-flight, the "Restore" button in the confirm dialog replaces its label with a spinner and is disabled (per UX.md "Loading States"). Minimum 200ms display enforced.

7. **Editor reload on restore.** The `onRestore(note)` callback in `NoteEditor` calls `editor.commands.setContent(note.body)` to replace the TipTap content in-place and sets the title input value to `note.title` — no full page navigation. The `['notes', noteId]` TanStack Query cache is also invalidated so the NoteCard in the list reflects the restored title.

8. **Left pane in split view.** The current note content is read from the TipTap editor instance directly (via `editor.getJSON()`) rather than re-fetching GET /notes/:id. This avoids a round-trip and ensures the user sees their in-progress draft (including any unsaved changes) as the "current" baseline.

## Scenarios

### UI-VER-OPEN-S1 — History button opens drawer; ESC closes it
**Validates:** FR-UI-VER-1

```
Given the user is on /notes/:id
When the user clicks the "History" button in the editor toolbar
Then a Sheet slides in from the right (role="dialog" with aria-label="Version history")
 And the sheet displays a list of saved versions
 And pressing ESC closes the sheet
 And the "History" button has aria-label="Version history"
```

### UI-VER-LIST-S1 — Versions displayed newest-first with relative time
**Validates:** FR-UI-VER-2

```
Given a note has 3 saved versions
When the history drawer opens
Then 3 VersionListItem rows appear ordered newest-first (highest version number first)
 And each row shows: version number, savedAt formatted as relative time ("2 hours ago"), title preview
```

### UI-VER-LIST-S2 — Empty state when no versions exist
**Validates:** FR-UI-VER-2 (edge case)

```
Given GET /notes/:id/versions returns []
When the history drawer opens
Then the drawer body shows a lucide History icon and "No versions yet" text
 And no VersionListItem rows are rendered
```

### UI-VER-PREVIEW-S1 — Click version shows split view; preview is read-only
**Validates:** FR-UI-VER-3

```
Given the history drawer is open with at least one version listed
When the user clicks a VersionListItem
Then GET /notes/:id/versions/:versionId is called
 And the Sheet widens into split-pane mode
 And the left pane shows the current note content as a read-only TipTap render
 And the right pane shows the selected version's title and body as a read-only TipTap render
 And a "Restore this version" button is visible in the right pane
 And neither pane accepts keyboard input (editable: false on both TipTap instances)
```

### UI-VER-RESTORE-S1 — Restore confirmed; editor updates with restored content; toast shown
**Validates:** FR-UI-VER-4

```
Given the version preview split view is open
When the user clicks "Restore this version"
Then a confirm modal appears with text "Restore this version? This will create a new version — your current work won't be lost."
 And a primary "Restore" button and a "Cancel" button are visible
When the user clicks "Restore"
Then POST /notes/:id/versions/:versionId/restore is called
 And on 200, the NoteEditor title input and TipTap body update with the restored content
 And the history drawer closes
 And a success toast "Restored version N" appears (where N is the version number of the restored snapshot)
```

### UI-VER-CONFIRM-S1 — Cancel restore; no API call; split view remains
**Validates:** FR-UI-VER-5

```
Given the restore confirm modal is open
When the user clicks "Cancel"
Then POST /notes/:id/versions/:versionId/restore is NOT called
 And the confirm modal closes
 And the split-view preview remains open showing the same selected version
```

## Dependencies

- **AB-1009** (backend version history API: GET/POST /notes/:id/versions, POST /notes/:id/versions/:versionId/restore) — archived ✓
- **AB-1012** (NoteEditor with History button stub, TipTap editor instance, `lib/tiptapUtils.ts` candidate) — archived ✓
- **AB-1014** (current branch — must be merged and archived before this ticket begins)

## Open Questions

_None — all decisions resolved above._
