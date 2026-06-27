# Review Log — AB-1012 Note Editor

## 2026-06-27T16:45:37Z -- Task T20-REVIEW

Audited against docs/FRS.md (FR-UI-EDITOR-1..5) PRIMARY, spec.md SECONDARY.

### FR-UI-EDITOR-1 -- TipTap rich editor
[OK] Route /notes/:id and /notes/new registered in App.tsx under PrivateRoute/AppLayout (lines 35-36).
[OK] NoteEditor wraps TipTap with StarterKit -- useEditor({ extensions: [StarterKit], content: note.body }).
[OK] Toolbar bold, italic, h1/h2/h3, bullet list, ordered list, code block -- all 8 buttons in EditorToolbar.tsx with correct toggle commands.
[OK] Output format TipTap JSON -- onUpdate reads e.getJSON(); POST /notes seeds doc node; PATCH sends body JSON.
[OK] Accessibility: each toolbar button has aria-label and aria-pressed; native button keyboard-reachable; role=toolbar.

### FR-UI-EDITOR-2 -- Title input
[OK] shadcn/ui Input above editor (lines 119-133).
[OK] Focus moves to editor on Enter -- handleTitleKeyDown calls editor.commands.focus() (lines 77-82).
[OK] Inline error + red border -- title-error paragraph + border-destructive + ring + aria-invalid (lines 127-138).
[FAIL] FR-UI-EDITOR-2 / spec UI-EDITOR-TITLE-S2 error-text mismatch. spec requires inline error "Title must be 200 characters or fewer". Code (handleTitleBlur) sets "Title must be between 1 and 200 characters". Test asserts only /title must be/i so drift is hidden. Decision: fix code string OR update spec.
[WARN] FR-UI-EDITOR-2 validation 1-200 hardcoded in NoteEditor + useAutosave rather than importing createNoteSchema/updateNoteSchema from packages/shared. FRS does not mandate shared schema here, but duplicated bounds risk divergence.
[WARN] FR-UI-EDITOR-2: title input has no maxLength; user can type 201+ chars (intended so blur error shows; autosave correctly blocked).

### FR-UI-EDITOR-3 -- Autosave with status indicator
[OK] Debounce 2s after last change (title OR body) -- scheduleAutoSave setTimeout(save,2000); onUpdate, handleTitleChange, handleTagsChange all reschedule. Combined timer confirmed.
[OK] Saving indicator during request -- setStatus(saving) before api.patch.
[OK] Saved then blank 3s after success -- setStatus(saved); setTimeout idle 3000; idle renders null.
[OK] Status state in Zustand editorStatusStore.
[OK] Click-to-retry fires PATCH immediately -- retry button wired to retryNow; clears timers, resets failure count, calls save(lastDataRef) no debounce.
[WARN] FR-UI-EDITOR-3: retryNow no-ops if lastDataRef null (only possible before any save attempt); low risk.

### FR-UI-EDITOR-4 -- Autosave failure recovery
[OK] Retry once after 5s -- first failure schedules setTimeout(save,5000) (lines 50-52).
[OK] Second failure: toast "Couldnt save your changes" (text matches FRS) + setDraft(noteId,data) (lines 45-49).
[OK] On successful save clearDraft(noteId) (line 38).
[OK] Draft recovery toast with Restore + Dismiss on note open when draft exists -- NoteEditorPage useEffect, duration Infinity, guarded by draftToastShownRef (lines 88-106).
[OK] Restore replaces editor content -- draftToRestore -> NoteEditor effect applies title/tagIds/body + editor.commands.setContent (lines 50-59).
[WARN] FR-UI-EDITOR-4: spec API table lists AUTOSAVE_FAILED errorMessages mapping but no such key exists in errorMessages.ts; toast hardcoded in useAutosave. Text matches FRS; drift between spec table and code.
[WARN] FR-UI-EDITOR-4: Dismiss calls clearDraft(id); Restore does NOT (draft cleared only on next successful save). Intentional and consistent with FRS.

### FR-UI-EDITOR-5 -- Inline tag selector
[OK] Filter existing tags via GET /tags -- useQuery(tags) + substring filter (lines 30-42).
[OK] Enter with no match -> POST /tags with palette color via getTagColor(allTags.length) from lib/tagColors.ts (8-color palette).
[OK] Selected tags as chips with X to remove -- Badge + X button aria-label; handleRemove + handleTagsChange reschedules autosave.
[OK] 409 TAG_NAME_DUPLICATE -> silently select existing -- onError matches code, finds existing tag by name, adds it, no toast (lines 59-73).
[OK] Color deterministic count % 8 (spec decision 5).
[WARN] FR-UI-EDITOR-5: palette index uses allTags.length vs spec wording existingTagCount % 8; equivalent. Naming note only.

### Security
[OK][SEC] No dangerouslySetInnerHTML/innerHTML in any AB-1012 file. TipTap EditorContent sanitized by ProseMirror schema; no raw HTML injection. Tag color via style backgroundColor from server hex, not user free-text into HTML.
[OK][SEC] No tokens in localStorage in AB-1012 code; editor uses in-memory api client (AB-1010).
[OK][SEC] POST/PATCH send JSON bodies; only encoded route-param noteId in URL.

### Test coverage
[OK] FR-UI-EDITOR-1: UI-EDITOR-S1 + S2 covered (NoteEditorPage.test.tsx).
[OK] FR-UI-EDITOR-2: UI-EDITOR-TITLE-S1 + S2 covered; autosave block on empty/over-200 in useAutosave.test.ts.
[OK] FR-UI-EDITOR-3: AUTOSAVE-S1/S2/S3 covered (useAutosave.test.ts 1999/2000ms boundary, editorStatusStore.test.ts).
[OK] FR-UI-EDITOR-4: RETRY-S1/S2 + DRAFT-S1/S2 covered (useAutosave, draftStore, NoteEditorPage tests).
[OK] FR-UI-EDITOR-5: TAGS-S1/S2/S3 covered (NoteEditorPage.test.tsx).
[COVERAGE] FR-UI-EDITOR-5: no test for 409 TAG_NAME_DUPLICATE silent-select branch; handler exists in editor.handlers.ts (duplicate-tag) but never exercised.
[COVERAGE] FR-UI-EDITOR-5: no test asserts the palette color value (getTagColor); lib/tagColors.ts has no unit test.
[COVERAGE] FR-UI-EDITOR-2: exact inline-error string not asserted (regex /title must be/i), hiding the FAIL drift.
[COVERAGE] FR-UI-EDITOR-4: no test of real-NoteEditor restore path (setContent); DRAFT-S2 mocks NoteEditor and only checks toast action does not throw.

### Summary
- 1 [FAIL]: inline title-error string vs spec UI-EDITOR-TITLE-S2 wording.
- WARNs: hardcoded title bounds vs shared schema; missing AUTOSAVE_FAILED errorMessages key; palette index naming.
- 4 [COVERAGE] gaps.
- No [SEC] issues.

## 2026-06-27 — [FAIL] Resolution (Fix Bundle #2)
[RESOLVED] FR-UI-EDITOR-2 / UI-EDITOR-TITLE-S2: spec.md updated to "Title must be between 1 and 200 characters" — matches code exactly. Code string is more accurate (covers both bounds). Approved by user.

