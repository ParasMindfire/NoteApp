---
ticket: AB-1015
title: Frontend — Version History
status: APPROVED
created: 2026-06-29
---

## Tasks

- [ ] **T1** — Install shadcn/ui Sheet component _(5 min)_
  - Run `npx shadcn@latest add sheet` from `apps/web/`
  - Verify `apps/web/src/components/ui/sheet.tsx` is created
  - Files touched: `apps/web/src/components/ui/sheet.tsx` (created by CLI)
  - Scenarios: prerequisite for T8

- [ ] **T2** — Create `types/versions.ts` _(5 min)_ [PARALLEL]
  - Define `NoteVersion` (full, with `body`) and `NoteVersionSummary` (list view, no `body`) interfaces per plan type definitions
  - Files touched: `apps/web/src/types/versions.ts` (create)
  - Scenarios: enables T5, T6, T8, T10

- [ ] **T3** — Create `lib/tiptapUtils.ts` _(10 min)_ [PARALLEL]
  - Implement `extractTextFromTipTap(json: Record<string, unknown>): string`
  - Recursively walks TipTap JSON nodes; concatenates `text` leaf values with space separators
  - Export only this one function
  - Files touched: `apps/web/src/lib/tiptapUtils.ts` (create)
  - Scenarios: UI-VER-LIST-S1 (80-char body excerpt in VersionListItem)

- [ ] **T4** — Add `VERSION_NOT_FOUND` to `errorMessages.ts` _(5 min)_ [PARALLEL]
  - Add `VERSION_NOT_FOUND: 'Version not found.'` to the `errorMessages` map
  - Files touched: `apps/web/src/lib/errorMessages.ts` (modify)
  - Scenarios: UI-VER-RESTORE-S1 (error path on 404)

- [ ] **T5** — Create `components/history/VersionListItem.tsx` _(15 min)_ [PARALLEL]
  - Props: `version: NoteVersionSummary`, `isSelected: boolean`, `onClick: (id: string) => void`
  - Renders: version number, `formatDistanceToNow(new Date(savedAt), { addSuffix: true })`, title preview, first 80 chars from `extractTextFromTipTap()`
  - Selected state: highlighted background (`bg-accent`)
  - `data-testid="version-list-item"`
  - Files touched: `apps/web/src/components/history/VersionListItem.tsx` (create)
  - Scenarios: UI-VER-LIST-S1, UI-VER-LIST-S2
  - Depends on: T2, T3

- [ ] **T6** — Create `components/history/VersionPreviewPane.tsx` _(20 min)_ [PARALLEL]
  - Props: `version: NoteVersion`, `currentTitle: string`, `currentBody: Record<string, unknown>`, `onRestore: () => void`, `isRestoring: boolean`
  - Left panel: read-only TipTap (`useEditor({ editable: false, content: currentBody })`) with `currentTitle` heading above
  - Right panel: read-only TipTap (`useEditor({ editable: false, content: version.body })`) with `version.title` heading above
  - "Restore this version" button below right panel; spinner + disabled while `isRestoring` (min 200ms via `useMinDuration`)
  - `data-testid="version-preview-pane"`
  - Files touched: `apps/web/src/components/history/VersionPreviewPane.tsx` (create)
  - Scenarios: UI-VER-PREVIEW-S1, UI-VER-RESTORE-S1
  - Depends on: T2

- [ ] **T7** — Create `components/history/RestoreConfirmDialog.tsx` _(10 min)_ [PARALLEL]
  - Props: `open`, `onOpenChange`, `onConfirm`, `isPending: boolean`, `versionNumber: number`
  - Uses `Dialog` / `DialogContent` / `DialogHeader` / `DialogTitle` / `DialogDescription` / `DialogFooter` (same import path as `RevokeConfirmDialog`)
  - Title: "Restore this version?"
  - Description: "This will create a new version — your current work won't be lost."
  - Cancel button (outline); Restore button (destructive, `aria-label="Confirm restore"`)
  - Spinner on Restore button while `isPending` via `useMinDuration(isPending, 200)`
  - Files touched: `apps/web/src/components/history/RestoreConfirmDialog.tsx` (create)
  - Scenarios: UI-VER-RESTORE-S1, UI-VER-CONFIRM-S1
  - Depends on: T1 (uses Dialog, no Sheet dep)

- [ ] **T8** — Create `components/history/HistoryDrawer.tsx` _(30 min)_
  - Props: `noteId`, `open`, `onOpenChange`, `currentTitle`, `currentBody`, `onRestore`
  - Sheet width: `cn(selectedVersionId ? 'w-full max-w-3xl' : 'max-w-sm')` on `SheetContent`
  - `aria-label="Version history"` on `SheetContent`
  - Query `['versions', noteId]` (enabled when `open`); skeleton (3 `<Skeleton />` rows) while loading
  - Empty state: lucide `<History />` icon + "No versions yet" when list is empty
  - Clicking `<VersionListItem />` sets `selectedVersionId`; triggers query `['version', noteId, selectedVersionId]`
  - When `selectedVersionId` set and version detail loaded: render `<VersionPreviewPane />`
  - `restoreVersion` mutation: POST /notes/:noteId/versions/:versionId/restore
    - `onSuccess`: call `onRestore(data)`, `onOpenChange(false)`, `setSelectedVersionId(null)`, `toast.success('Restored version N')` where N = version number looked up from versions list query data
    - `onError`: `toast.error(getErrorMessage(...))`
  - Renders `<RestoreConfirmDialog />` for the confirm step
  - Files touched: `apps/web/src/components/history/HistoryDrawer.tsx` (create)
  - Scenarios: UI-VER-OPEN-S1, UI-VER-LIST-S1, UI-VER-LIST-S2, UI-VER-PREVIEW-S1, UI-VER-RESTORE-S1, UI-VER-CONFIRM-S1
  - Depends on: T1, T5, T6, T7

- [ ] **T9** — Modify `NoteEditor.tsx` to wire the History button _(15 min)_
  - Add `import { queryClient } from '@/lib/queryClient'`
  - Add `import { HistoryDrawer } from '@/components/history/HistoryDrawer'`
  - Add `const [historyOpen, setHistoryOpen] = useState(false)`
  - Replace History button `onClick={() => {}}` with `onClick={() => setHistoryOpen(true)}`
  - Add `handleRestore` callback (per plan detail): `setTitle`, `titleRef.current`, `editor?.commands.setContent`, `bodyRef.current`, `queryClient.invalidateQueries`
  - Render `<HistoryDrawer noteId={note.id} open={historyOpen} onOpenChange={setHistoryOpen} currentTitle={title} currentBody={bodyRef.current} onRestore={handleRestore} />` alongside `<ShareModal>`
  - Files touched: `apps/web/src/components/editor/NoteEditor.tsx` (modify)
  - Scenarios: UI-VER-OPEN-S1, UI-VER-RESTORE-S1
  - Depends on: T8

- [ ] **T10** — Create `mocks/handlers/version.handlers.ts` _(15 min)_
  - GET /notes/:noteId/versions: `noteId === 'note-no-versions'` → `[]`; default → 3 `NoteVersionSummary` fixtures (versions 3, 2, 1 newest-first)
  - GET /notes/:noteId/versions/:versionId: `versionId === 'bad-version-id'` → 404 VERSION_NOT_FOUND; default → full `NoteVersion` fixture with TipTap body
  - POST /notes/:noteId/versions/:versionId/restore: `versionId === 'bad-version-id'` → 404; default → returns updated `Note` fixture (version incremented)
  - Files touched: `apps/web/src/mocks/handlers/version.handlers.ts` (create)
  - Scenarios: all 6 (test infrastructure)
  - Depends on: T2

- [ ] **T11** — Register `versionHandlers` in `mocks/server.ts` _(5 min)_
  - Import `versionHandlers` from `./handlers/version.handlers`
  - Spread into `setupServer(...)` call
  - Files touched: `apps/web/src/mocks/server.ts` (modify)
  - Scenarios: all 6 (test infrastructure)
  - Depends on: T10

- [ ] **T12** — Write `__tests__/components/HistoryDrawer.test.tsx` _(40 min)_
  - 6 `it()` blocks, one per scenario, each named with its scenario ID
  - `renderHistoryDrawer()` helper renders `<HistoryDrawer>` inside `QueryClientProvider` + `MemoryRouter` with `open={true}` and stub props
  - UI-VER-OPEN-S1: renders `NoteEditor` (full component), clicks History button, asserts Sheet appears + ESC closes + aria-label
  - UI-VER-LIST-S1: asserts 3 `version-list-item` rows, newest first, version numbers correct, relative time present
  - UI-VER-LIST-S2: uses `noteId='note-no-versions'`; asserts "No versions yet" and History icon visible; no rows
  - UI-VER-PREVIEW-S1: clicks a version item; asserts `version-preview-pane` appears; asserts both TipTap containers have `contenteditable="false"`
  - UI-VER-RESTORE-S1: clicks version → clicks "Restore this version" → confirm dialog appears → clicks "Confirm restore" → asserts POST fired, `onRestore` mock called, `toast.success` called with "Restored version"
  - UI-VER-CONFIRM-S1: clicks version → clicks "Restore this version" → confirm dialog → clicks "Cancel" → asserts POST not fired; preview pane still visible
  - Mock `sonner` (same pattern as `ShareModal.test.tsx`)
  - Files touched: `apps/web/src/__tests__/components/HistoryDrawer.test.tsx` (create)
  - Scenarios: UI-VER-OPEN-S1, UI-VER-LIST-S1, UI-VER-LIST-S2, UI-VER-PREVIEW-S1, UI-VER-RESTORE-S1, UI-VER-CONFIRM-S1
  - Depends on: T8, T9, T11
