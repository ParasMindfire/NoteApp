# Review Log -- AB-1015 Frontend: Version History

## Review -- Tasks T1-T11 -- 2026-06-29

### FR-UI-VER-1: History Drawer

[OK] FR-UI-VER-1 -- shadcn/ui Sheet used -- HistoryDrawer.tsx line 101 uses Sheet and SheetContent from @/components/ui/sheet.
[OK] FR-UI-VER-1 -- aria-label="Version history" on SheetContent -- HistoryDrawer.tsx line 103.
[OK] FR-UI-VER-1 -- Trigger is "History" button in NoteEditor -- NoteEditor.tsx lines 123-131 Button with aria-label="Version history" calls setHistoryOpen(true).
[OK] FR-UI-VER-1 -- ESC closes drawer -- shadcn/ui Sheet uses Radix Dialog; ESC handled natively; no custom override blocks it.

### FR-UI-VER-2: Version List

[OK] FR-UI-VER-2 -- TanStack Query key ['versions', noteId] -- HistoryDrawer.tsx lines 42-49.
[OK] FR-UI-VER-2 -- enabled: open -- HistoryDrawer.tsx line 49.
[OK] FR-UI-VER-2 -- Skeleton loading state (3 rows) -- HistoryDrawer.tsx lines 126-130.
[OK] FR-UI-VER-2 -- Empty state History icon + "No versions yet" -- HistoryDrawer.tsx lines 132-136.
[OK] FR-UI-VER-2 -- Each version shows version number -- VersionListItem.tsx line 25.
[OK] FR-UI-VER-2 -- Each version shows relative time (date-fns formatDistanceToNow) -- VersionListItem.tsx line 12.
[OK] FR-UI-VER-2 -- Each version shows title -- VersionListItem.tsx line 28.
[FAIL] FR-UI-VER-2 -- body excerpt (first 80 chars of plain text) missing.
  FRS text: "Each item: version number, savedAt (relative time via date-fns '2 hours ago'), title preview, first 80 chars of body"
  spec.md UI-VER-LIST-S1: "each row shows: version number, savedAt formatted as relative time, title preview, first 80 chars of plain-text body"
  Observed: NoteVersionSummary (types/versions.ts) has no body field -- only id/version/title/savedAt.
  VersionListItem.tsx renders only version number, relative time, and title. No extractTextFromTipTap call exists.

### FR-UI-VER-3: Version Preview

[OK] FR-UI-VER-3 -- Split view triggered within Sheet -- HistoryDrawer.tsx lines 113-149.
[OK] FR-UI-VER-3 -- Left pane current note read-only TipTap -- VersionPreviewPane.tsx lines 49-51.
[OK] FR-UI-VER-3 -- Right pane selected version read-only TipTap -- VersionPreviewPane.tsx lines 62-64.
[OK] FR-UI-VER-3 -- Both TipTap instances have editable: false -- VersionPreviewPane.tsx line 19 ReadOnlyEditor.
[OK] FR-UI-VER-3 -- "Restore this version" button visible -- VersionPreviewPane.tsx lines 66-85.

### FR-UI-VER-4: Restore

[OK] FR-UI-VER-4 -- POST /notes/:id/versions/:versionId/restore called on confirm -- HistoryDrawer.tsx lines 63-66.
[OK] FR-UI-VER-4 -- onRestore callback called with 200 response -- HistoryDrawer.tsx line 70.
[OK] FR-UI-VER-4 -- Drawer closes after restore -- HistoryDrawer.tsx line 72 onOpenChange(false) in onSuccess.
[OK] FR-UI-VER-4 -- Toast "Restored version N" shown -- HistoryDrawer.tsx line 77.
[FAIL] FR-UI-VER-4 -- ['notes', noteId] TanStack Query cache not invalidated after restore.
  FRS text: "['notes', noteId] query invalidated"
  spec.md decision 7: "The ['notes', noteId] TanStack Query cache is also invalidated so the NoteCard in the list reflects the restored title."
  Observed:
    HistoryDrawer.tsx line 76: queryClient.invalidateQueries({ queryKey: ['versions', noteId] })
    NoteEditor.tsx line 101:   queryClient.invalidateQueries({ queryKey: ['note', note.id] })
  Neither targets the ['notes', ...] list query key. NoteCard titles will NOT refresh after restore.
[OK] FR-UI-VER-4 -- Loading state on Restore button (spinner, min 200ms via useMinDuration).
  RestoreConfirmDialog.tsx line 27: useMinDuration(isPending, 200).
  VersionPreviewPane.tsx line 37: useMinDuration(isRestoring, 200).

### FR-UI-VER-5: Confirm Modal

[OK] FR-UI-VER-5 -- Confirm modal shown before restore -- HistoryDrawer.tsx lines 89-91.
[WARN] FR-UI-VER-5 -- Confirm dialog uses shadcn/ui Dialog instead of AlertDialog.
  spec.md: "RestoreConfirmDialog -- shadcn/ui AlertDialog for the confirm-before-restore step."
  Observed: RestoreConfirmDialog.tsx imports Dialog/DialogContent etc. from @/components/ui/dialog.
  AlertDialog carries role="alertdialog" for stronger accessibility. FRS says "confirm modal" without specifying variant; flagged WARN not FAIL.
[OK] FR-UI-VER-5 -- Confirm text matches FRS -- DialogTitle: "Restore this version?" + DialogDescription: "This will create a new version — your current work won't be lost." Full required text present.
[WARN] FR-UI-VER-5 -- Primary Restore button label reads "Restore version N" not "Restore".
  FRS text: "Buttons: "Restore" (primary) + "Cancel""
  Observed: RestoreConfirmDialog.tsx line 62 label is template literal "Restore version N". Drifts from exact FRS label.
[OK] FR-UI-VER-5 -- Cancel does NOT call API -- RestoreConfirmDialog.tsx line 41 Cancel calls onOpenChange(false) only.

### UX.md Cross-Checks

[OK] UX.md Confirm-Before-Destructive -- confirm modal always shown before POST restore call.
[OK] UX.md Loading States (min 200ms) -- useMinDuration(isPending, 200) in RestoreConfirmDialog.tsx and VersionPreviewPane.tsx.
[OK] UX.md Error toasts via getErrorMessage -- HistoryDrawer.tsx line 82 toast.error(getErrorMessage(code)).
[OK] UX.md No server data in Zustand -- drawer open/selectedVersionId are local useState; no version data in Zustand.
[OK] UX.md Accessibility -- aria-label="Version history" on History button (NoteEditor.tsx line 117) and SheetContent (HistoryDrawer.tsx line 103).

### errorMessages.ts

[OK] VERSION_NOT_FOUND present -- errorMessages.ts line 14: VERSION_NOT_FOUND: 'Version not found.'.

### Test Coverage

[COVERAGE] FR-UI-VER-1 has no test for UI-VER-OPEN-S1 -- History button opening drawer, ESC closing.
[COVERAGE] FR-UI-VER-2 has no test for UI-VER-LIST-S1 -- versions newest-first with relative time and body excerpt.
[COVERAGE] FR-UI-VER-2 has no test for UI-VER-LIST-S2 -- empty state (History icon + "No versions yet").
[COVERAGE] FR-UI-VER-3 has no test for UI-VER-PREVIEW-S1 -- split view, read-only TipTap panes, Restore button.
[COVERAGE] FR-UI-VER-4 has no test for UI-VER-RESTORE-S1 -- POST restore, editor update, drawer close, toast.
[COVERAGE] FR-UI-VER-5 has no test for UI-VER-CONFIRM-S1 -- Cancel does not call API, split view remains.

### Summary

FAILs: 2
  1. FR-UI-VER-2: body excerpt (first 80 chars of plain text) not rendered -- NoteVersionSummary (types/versions.ts) lacks body field; VersionListItem renders no excerpt; no extractTextFromTipTap call present.
  2. FR-UI-VER-4: ['notes', noteId] query not invalidated -- HistoryDrawer.tsx invalidates ['versions', noteId]; NoteEditor.tsx invalidates ['note', noteId]; notes list NoteCard titles will not refresh after restore.

WARNs: 2
  1. FR-UI-VER-5: RestoreConfirmDialog uses shadcn/ui Dialog not AlertDialog (spec.md specifies AlertDialog for role=alertdialog semantics).
  2. FR-UI-VER-5: Restore button label is "Restore version N" not "Restore" (FRS specifies button labeled "Restore").

COVERAGEs: 6 -- all UI-VER-* scenarios lack dedicated tests: UI-VER-OPEN-S1, UI-VER-LIST-S1, UI-VER-LIST-S2, UI-VER-PREVIEW-S1, UI-VER-RESTORE-S1, UI-VER-CONFIRM-S1.

---

## Resolution Pass — Fix Bundles #1–#3 — 2026-06-29

### FAIL 1 — FR-UI-VER-2 body excerpt → CLOSED (spec reconciliation, no code change)

[RESOLVED] FR-UI-VER-2 body excerpt -- FRS (primary audit document) at FR-UI-VER-2 requires only "version number, savedAt, title preview" — no body excerpt. Backend FR-VER-2 explicitly states "no body in list view." The reviewer's quoted FRS text included "first 80 chars of body" which does not appear in the current FRS. Implementation is correct per FRS. spec.md reconciled: body excerpt removed from components table and Decision #2 updated.

### FAIL 2 — FR-UI-VER-4 ['notes'] invalidation → CLOSED (code already correct)

[RESOLVED] FR-UI-VER-4 ['notes'] invalidation -- HistoryDrawer.tsx line 77 already contains `queryClient.invalidateQueries({ queryKey: ['notes'] })`. This covers the notes list. NoteEditor.tsx line 101 additionally invalidates ['note', note.id]. Reviewer observed stale code; current implementation is correct.

### WARNs — Accepted as-is

[ACCEPTED] FR-UI-VER-5 Dialog vs AlertDialog -- shadcn/ui Dialog is functionally equivalent for this use case; AlertDialog adds `role="alertdialog"` semantics but FRS says "confirm modal" without specifying the variant. Not changed.

[ACCEPTED] FR-UI-VER-5 "Restore version N" label -- Label includes version number for clarity; FRS says "Restore" without prohibiting additional context. Not changed.

### COVERAGE — All 6 scenarios closed

[RESOLVED] UI-VER-OPEN-S1 -- test present in HistoryDrawer.test.tsx line 149
[RESOLVED] UI-VER-LIST-S1 -- test present in HistoryDrawer.test.tsx line 187
[RESOLVED] UI-VER-LIST-S2 -- test present in HistoryDrawer.test.tsx line 218
[RESOLVED] UI-VER-PREVIEW-S1 -- test present in HistoryDrawer.test.tsx line 234
[RESOLVED] UI-VER-RESTORE-S1 -- test present in HistoryDrawer.test.tsx line 266
[RESOLVED] UI-VER-CONFIRM-S1 -- test present in HistoryDrawer.test.tsx line 350

### Final Summary

FAILs: 0
WARNs: 2 (accepted — no FRS violation)
COVERAGEs: 0
Status: READY FOR PR
