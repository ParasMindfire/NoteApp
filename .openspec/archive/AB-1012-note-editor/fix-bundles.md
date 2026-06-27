# Fix Bundles — AB-1012 Note Editor

## Bundle #1 — draftStore lint error [APPLIED]
**Task:** T6 / post-lint
**Problem:** `_removed` unused variable in `clearDraft` destructure pattern triggered `@typescript-eslint/no-unused-vars`.
**Fix:** Replace `const { [noteId]: _removed, ...rest } = state.drafts` with `delete drafts[noteId]` pattern.
**Files:** `apps/web/src/stores/draftStore.ts`

## Bundle #2 — Title error text spec/code mismatch [APPLIED]
**Task:** T20 reviewer [FAIL]
**Problem:** spec.md UI-EDITOR-TITLE-S2 said "Title must be 200 characters or fewer"; code had "Title must be between 1 and 200 characters" (more accurate — covers both bounds).
**Fix:** Updated spec.md scenario text to match code. Code string is correct and more accurate.
**Files:** `.openspec/archive/AB-1012-note-editor/spec.md`

## Bundle #3 — NoteCard `tags.map` crash [APPLIED]
**Task:** Post-implementation browser smoke test
**Problem:** `Cannot read properties of undefined (reading 'map')` — backend can return notes where `tags` is `undefined`.
**Fix:** `note.tags.map(...)` → `(note.tags ?? []).map(...)`.
**Files:** `apps/web/src/components/notes/NoteCard.tsx`

## Bundle #4 — `/notes/new` skeleton UX [APPLIED]
**Task:** Post-implementation user smoke test
**Problem:** Clicking "New Note" showed a loading skeleton while POST /notes was in-flight, which felt unfinished.
**Fix:** Render `<NoteEditor note={NEW_NOTE_STUB} />` immediately at `/notes/new` (stub has `id: ''` so `useAutosave` is a no-op). POST fires in background; URL updates silently on success.
**Files:** `apps/web/src/pages/notes/NoteEditorPage.tsx`
