# Fix Bundles — AB-1015 Frontend: Version History

## Bundle #1 — Spec reconciliation: body excerpt removed from scope

**Status:** APPLIED

**Trigger:** Reviewer FAIL on FR-UI-VER-2 (body excerpt missing).

**Root cause analysis:**  
The spec.md components table and Decision #2 referenced a "first 80 chars of body excerpt" in `<VersionListItem />`. However:
- FR-VER-2 (backend) explicitly states the list endpoint returns `{ id, version, savedAt, title }` — "no body in list view."
- FR-UI-VER-2 (FRS — primary audit document) requires only "version number, savedAt, title preview." No body excerpt.
- The scenario UI-VER-LIST-S1 does not test for body excerpt.
- Adding `body` to the summary would require a backend change out of scope for AB-1015.

The reviewer quoted FRS text that does not appear in the current FRS. The implementation correctly follows the FRS (no body excerpt rendered).

**Changes applied:**
- `spec.md` components table: removed "80-char body excerpt" from VersionListItem row description.
- `spec.md` Decision #2: replaced body-excerpt description with a note explaining why body was excluded (backend contract, out of scope).
- No code changes required — implementation is correct per FRS.

---

## Bundle #2 — Reviewer FAIL 2 closed: ['notes'] invalidation already present

**Status:** APPLIED (no-op — code was already correct)

**Trigger:** Reviewer FAIL on FR-UI-VER-4 (`['notes', noteId]` not invalidated).

**Root cause analysis:**  
The reviewer observed the code before a post-review code update. The current `HistoryDrawer.tsx` line 77 already contains:

```ts
queryClient.invalidateQueries({ queryKey: ['notes'] });
```

This invalidates all queries prefixed with `['notes']`, covering the notes list. `NoteEditor.tsx` line 101 additionally invalidates `['note', note.id]` (the single-note cache). Both invalidations are present and correct.

**Changes applied:** None — implementation was already correct.

---

## Bundle #3 — Coverage gaps closed: all 6 UI-VER-* scenarios tested

**Status:** APPLIED (tests written by tester agent after reviewer ran)

All 6 scenarios are implemented in `apps/web/src/__tests__/components/HistoryDrawer.test.tsx`:

| Scenario | Test name |
|----------|-----------|
| UI-VER-OPEN-S1 | History button in NoteEditor opens Sheet; ESC closes it |
| UI-VER-LIST-S1 | 3 version rows appear newest-first; each shows version number, relative time, and title |
| UI-VER-LIST-S2 | empty state "No versions yet" shown when GET returns [] |
| UI-VER-PREVIEW-S1 | clicking VersionListItem opens split-view; both TipTap containers have contenteditable=false |
| UI-VER-RESTORE-S1 | click "Restore this version" → confirm → POST fired → onRestore called → toast.success |
| UI-VER-CONFIRM-S1 | click "Cancel" → POST not called → preview pane still visible |
