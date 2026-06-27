---
ticket: AB-1012
title: Frontend — Note Editor
status: DONE
created: 2026-06-27
---

# AB-1012 — Tasks

## Checklist

- [x] **T1** — Install `cmdk` + `@radix-ui/react-popover` at pinned versions (10 min)
  - Verify exact stable versions via Context7 MCP before writing
  - Files: `apps/web/package.json`
  - Run `pnpm install` after edit; confirm lock file updated

- [x] **T2** — Add `apps/web/src/components/ui/command.tsx` shadcn/ui primitive (15 min) [PARALLEL]
  - Wraps `cmdk`; standard shadcn/ui Command + CommandInput + CommandList + CommandItem
  - Files: `apps/web/src/components/ui/command.tsx`

- [x] **T3** — Add `apps/web/src/components/ui/popover.tsx` shadcn/ui primitive (10 min) [PARALLEL]
  - Wraps `@radix-ui/react-popover`; standard shadcn/ui Popover + PopoverTrigger + PopoverContent
  - Files: `apps/web/src/components/ui/popover.tsx`

- [x] **T4** — Add `apps/web/src/lib/tagColors.ts` (5 min) [PARALLEL]
  - 8-color hex palette; `getTagColor(count: number): string` returns `palette[count % 8]`
  - Files: `apps/web/src/lib/tagColors.ts`

- [x] **T5** — Add `apps/web/src/stores/editorStatusStore.ts` (10 min) [PARALLEL]
  - `EditorStatus = 'idle' | 'saving' | 'saved' | 'error'`; Zustand slice with `setStatus`
  - Files: `apps/web/src/stores/editorStatusStore.ts`

- [x] **T6** — Add `apps/web/src/stores/draftStore.ts` (10 min) [PARALLEL]
  - `drafts: Record<string, Draft>`; `setDraft(noteId, draft)` + `clearDraft(noteId)`
  - Files: `apps/web/src/stores/draftStore.ts`

- [x] **T7** — Add `apps/web/src/hooks/useAutosave.ts` (30 min)
  - Depends on: T5, T6
  - 2s combined debounce (title + body + tags); PATCH mutation; retry once after 5s; toast + draftStore on second failure; clearDraft on success; 3s 'saved' → 'idle' timer
  - Exposes `retryNow()` for click-to-retry
  - Files: `apps/web/src/hooks/useAutosave.ts`
  - Scenarios: UI-EDITOR-AUTOSAVE-S1, S2, S3, RETRY-S1, S2

- [x] **T8** — Add `apps/web/src/components/editor/EditorToolbar.tsx` (20 min) [PARALLEL]
  - Bold, italic, H1/H2/H3, bullet list, ordered list, code block
  - Each button: `aria-label`, `aria-pressed={editor.isActive(...)}`, visual ring on active
  - All buttons must be focusable (tabIndex ≥ 0)
  - Files: `apps/web/src/components/editor/EditorToolbar.tsx`
  - Scenarios: UI-EDITOR-S1, UI-EDITOR-S2

- [x] **T9** — Add `apps/web/src/components/editor/EditorStatusIndicator.tsx` (15 min)
  - Depends on: T5
  - Reads `editorStatusStore`; renders nothing for 'idle', "Saving…" for 'saving', "Saved" for 'saved', clickable "Save failed — retry" for 'error'
  - Files: `apps/web/src/components/editor/EditorStatusIndicator.tsx`
  - Scenarios: UI-EDITOR-AUTOSAVE-S1, UI-EDITOR-AUTOSAVE-S3

- [x] **T10** — Add `apps/web/src/components/editor/TagCombobox.tsx` (40 min)
  - Depends on: T2, T3, T4
  - shadcn/ui Command inside Popover; filter existing tags from `GET /tags`; Enter on no-match → `POST /tags` with `getTagColor`; selected tags shown as chips with X; chip X click removes from `tagIds`
  - Files: `apps/web/src/components/editor/TagCombobox.tsx`
  - Scenarios: UI-EDITOR-TAGS-S1, S2, S3

- [x] **T11** — Add `apps/web/src/components/editor/NoteEditor.tsx` (30 min)
  - Depends on: T7, T8, T9, T10
  - Wires: shadcn/ui Input (title), TipTap `useEditor` with StarterKit, `EditorToolbar`, `TagCombobox`, `EditorStatusIndicator`, `useAutosave`
  - Title: 1–200 char validation on blur; inline error + red border; Enter key focuses TipTap
  - Editor header: `<Share2 />` stub + `<History />` stub (aria-label, `() => {}` handler)
  - Files: `apps/web/src/components/editor/NoteEditor.tsx`
  - Scenarios: UI-EDITOR-TITLE-S1, UI-EDITOR-TITLE-S2

- [x] **T12** — Add `apps/web/src/pages/notes/NoteEditorPage.tsx` (30 min)
  - Depends on: T11
  - `/notes/new`: `POST /notes` on mount with `{ title: "Untitled", body: {…} }`; show stub editor immediately; on success `navigate(id, { replace: true })`; on failure toast + navigate `/notes`
  - `/notes/:id`: `useQuery(['note', id])`; 404 → toast + navigate `/notes`; check draftStore on mount → show sonner toast with Restore / Dismiss
  - Files: `apps/web/src/pages/notes/NoteEditorPage.tsx`
  - Scenarios: UI-EDITOR-DRAFT-S1, UI-EDITOR-DRAFT-S2

- [x] **T13** — Modify `apps/web/src/App.tsx` (5 min) [PARALLEL]
  - Replace both `<div>Coming soon</div>` placeholders at `/notes/new` and `/notes/:id` with `<NoteEditorPage />`
  - Files: `apps/web/src/App.tsx`

- [x] **T14** — Modify `apps/web/src/lib/errorMessages.ts` (5 min) [PARALLEL]
  - Add `NOTE_NOT_FOUND: 'Note not found.'`
  - Add `TAG_NAME_DUPLICATE: ''` (empty string — combobox handles this silently)
  - Files: `apps/web/src/lib/errorMessages.ts`

- [x] **T15** — Add `apps/web/src/mocks/handlers/editor.handlers.ts` (15 min) [PARALLEL]
  - `GET /notes/:id` → return mock note by id (or 404 for `note-missing`)
  - `POST /notes` → return 201 with new mock note (id: `note-new-1`)
  - `PATCH /notes/:id` → return 200 with updated note; support a special id for error simulation
  - `POST /tags` → return 201 with new tag; 409 for name `"duplicate-tag"`
  - Files: `apps/web/src/mocks/handlers/editor.handlers.ts`

- [x] **T16** — Modify `apps/web/src/mocks/server.ts` (5 min)
  - Depends on: T15
  - Import `editorHandlers` and spread into `handlers` array
  - Files: `apps/web/src/mocks/server.ts`

---

## Watcher tasks (run after T5–T16 are complete)

- [x] **T17** — Store unit tests — `editorStatusStore` + `draftStore` (20 min) [PARALLEL]
  - Tester agent writes and runs tests
  - Files: `apps/web/src/__tests__/stores/editorStatusStore.test.ts`, `apps/web/src/__tests__/stores/draftStore.test.ts`
  - Scenarios: store-level transitions (status set/reset, draft set/clear)

- [x] **T18** — `useAutosave` hook tests (50 min) [SUBAGENT]
  - Tester agent (Sonnet); use `vi.useFakeTimers()`; test debounce, retry, toast, draftStore
  - Files: `apps/web/src/__tests__/hooks/useAutosave.test.ts`
  - Scenarios: UI-EDITOR-AUTOSAVE-S1, S2, S3, UI-EDITOR-RETRY-S1, S2

- [x] **T19** — `NoteEditorPage` integration tests (60 min) [SUBAGENT]
  - Tester agent (Sonnet); mock TipTap `useEditor`; MSW for all editor endpoints
  - Files: `apps/web/src/__tests__/pages/NoteEditorPage.test.tsx`
  - Scenarios: UI-EDITOR-S1, S2, UI-EDITOR-TITLE-S1, S2, UI-EDITOR-DRAFT-S1, S2, UI-EDITOR-TAGS-S1, S2, S3

- [x] **T20** — Reviewer audit (post-implementation) [SUBAGENT]
  - Reviewer agent (Opus); audits all new files vs spec.md + FRS.md FR-UI-EDITOR-1..5
  - Appends findings to `review-log.md`
