---
ticket: AB-1012
title: Frontend — Note Editor
status: APPROVED
created: 2026-06-27
---

# AB-1012 — Plan: Note Editor

## Dependency Verification

Before any implementation:

- `packages/shared` — `createNoteSchema`, `updateNoteSchema`, `createTagSchema` already exported ✓ (confirmed in index.ts)
- `@tiptap/react` 2.11.7, `@tiptap/starter-kit` 2.11.7 — already in `apps/web/package.json` ✓
- `sonner` 1.5.0 — already installed ✓
- `App.tsx` — placeholder routes `/notes/new` and `/notes/:id` already exist (need replacement) ✓
- `AppHeader` — "New Note" button linking to `/notes/new` already rendered ✓

## New Packages Required

| Package | Pinned version | Reason |
|---|---|---|
| `cmdk` | `1.0.4` | shadcn/ui Command component dependency (TagCombobox) |
| `@radix-ui/react-popover` | `1.1.8` | shadcn/ui Popover dependency (TagCombobox wrapper) |

> **Verify exact versions with Context7 MCP** before writing to `package.json` (FR-INFRA-11: no `^`, `~`, `@latest`).

## Prisma Schema Changes

None — this is a frontend-only ticket. All backend models are in place via AB-1004 (Note) and AB-1006 (Tag).

## Files to Create

### Pages
| File | Purpose |
|---|---|
| `apps/web/src/pages/notes/NoteEditorPage.tsx` | Route component; POSTs blank note on `/notes/new`; loads note for `/notes/:id`; shows draft recovery toast |

### Components (editor)
| File | Purpose |
|---|---|
| `apps/web/src/components/editor/NoteEditor.tsx` | Orchestrates title input, TipTap body, TagCombobox, useAutosave, EditorStatusIndicator |
| `apps/web/src/components/editor/EditorToolbar.tsx` | Bold, italic, H1/H2/H3, bullet list, ordered list, code block buttons; aria-pressed |
| `apps/web/src/components/editor/EditorStatusIndicator.tsx` | Renders 'idle'/'saving'/'saved'/'error' from editorStatusStore; 'error' state is clickable |
| `apps/web/src/components/editor/TagCombobox.tsx` | shadcn/ui Command + Popover combobox; filter + create-on-the-fly + chips |

### shadcn/ui primitives
| File | Purpose |
|---|---|
| `apps/web/src/components/ui/command.tsx` | shadcn/ui Command component (wraps cmdk) |
| `apps/web/src/components/ui/popover.tsx` | shadcn/ui Popover component (wraps @radix-ui/react-popover) |

### Zustand stores
| File | Purpose |
|---|---|
| `apps/web/src/stores/editorStatusStore.ts` | `EditorStatus` ('idle' \| 'saving' \| 'saved' \| 'error') + setStatus |
| `apps/web/src/stores/draftStore.ts` | `drafts: Record<string, Draft>` + setDraft / clearDraft |

### Hooks & lib
| File | Purpose |
|---|---|
| `apps/web/src/hooks/useAutosave.ts` | 2s debounce, PATCH mutation, retry-once after 5s, toast on second failure, draftStore |
| `apps/web/src/lib/tagColors.ts` | Fixed 8-color hex palette; `getTagColor(count: number): string` |

### Test files
| File | Scenarios covered |
|---|---|
| `apps/web/src/__tests__/pages/NoteEditorPage.test.tsx` | UI-EDITOR-S1, S2, TITLE-S1, S2, DRAFT-S1, S2, TAGS-S1, S2, S3 |
| `apps/web/src/__tests__/hooks/useAutosave.test.ts` | UI-EDITOR-AUTOSAVE-S1, S2, S3, RETRY-S1, S2 |
| `apps/web/src/__tests__/stores/editorStatusStore.test.ts` | Store unit — status transitions |
| `apps/web/src/__tests__/stores/draftStore.test.ts` | Store unit — setDraft / clearDraft |

### MSW handlers
| File | Purpose |
|---|---|
| `apps/web/src/mocks/handlers/editor.handlers.ts` | `GET /notes/:id`, `POST /notes`, `PATCH /notes/:id`, `POST /tags` mock responses |

## Files to Modify

| File | Change |
|---|---|
| `apps/web/src/App.tsx` | Replace `<div>Coming soon</div>` with `<NoteEditorPage />` for `/notes/new` and `/notes/:id` |
| `apps/web/src/lib/errorMessages.ts` | Add `NOTE_NOT_FOUND: 'Note not found.'` and `TAG_NAME_DUPLICATE: ''` (empty — handled silently) |
| `apps/web/src/mocks/server.ts` | Import and spread `editorHandlers` into `handlers` array |
| `apps/web/package.json` | Add `cmdk` and `@radix-ui/react-popover` at pinned versions |

## Implementation Order

1. Install new packages + verify Context7 versions.
2. Add shadcn/ui `command.tsx` + `popover.tsx` primitives.
3. Add `tagColors.ts`, `editorStatusStore.ts`, `draftStore.ts`.
4. Add `useAutosave.ts` hook.
5. Add `EditorToolbar.tsx`, `EditorStatusIndicator.tsx`, `TagCombobox.tsx`.
6. Add `NoteEditor.tsx` (wires all of the above).
7. Add `NoteEditorPage.tsx` (route-level: create-on-mount + draft recovery).
8. Modify `App.tsx`, `errorMessages.ts`, `server.ts`.
9. Add MSW handlers in `editor.handlers.ts`.
10. Write all tests.

## Risk Areas

1. **TipTap in jsdom**: ProseMirror relies on complex DOM APIs not fully supported in jsdom (e.g., `Selection`, `getComputedStyle`). Mitigation: mock the TipTap `useEditor` hook in `NoteEditorPage.test.tsx` tests; test toolbar button state and autosave trigger logic independently. Keep TipTap integration tests minimal (render check only, no DOM selection testing).

2. **Autosave timer control**: Tests for `useAutosave` must use `vi.useFakeTimers()` for the 2s debounce and 5s retry. Must pair with `vi.runAllTimersAsync()` and flush React state updates — wrap in `act()`.

3. **`history.replace` redirect**: The `/notes/new` → `/notes/:id` redirect (after POST) must use `MemoryRouter` in tests with a `Routes` block that renders `<NoteEditorPage />` at both paths so the redirect can be observed.

4. **cmdk keyboard behavior in jsdom**: `@testing-library/user-event` supports keyboard simulation but cmdk Command may have edge cases. Test `Enter`-to-create by firing keyboard events directly if `userEvent.keyboard` proves insufficient.

5. **`editorStatusStore` 3s revert timer**: Use `vi.useFakeTimers()` in `useAutosave.test.ts` to verify the 'saved' → 'idle' transition at exactly 3s.

6. **Package version pinning (FR-INFRA-11)**: `cmdk` and `@radix-ui/react-popover` must be pinned exact versions in `package.json`. Use Context7 MCP to confirm latest stable before writing.

## Test Strategy

| Scenario | Test file | Approach |
|---|---|---|
| UI-EDITOR-S1 — editor renders with toolbar | `NoteEditorPage.test.tsx` | RTL render; assert toolbar buttons present by `aria-label` |
| UI-EDITOR-S2 — toolbar keyboard-reachable | `NoteEditorPage.test.tsx` | Assert `tabIndex` / focusable; `aria-label` on each button |
| UI-EDITOR-TITLE-S1 — Enter moves focus to editor | `NoteEditorPage.test.tsx` | `userEvent.keyboard('{Enter}')` in title; assert TipTap container focused |
| UI-EDITOR-TITLE-S2 — title > 200 chars inline error | `NoteEditorPage.test.tsx` | Fill 201 chars + blur; assert error text; assert no PATCH called |
| UI-EDITOR-AUTOSAVE-S1 — status transitions | `useAutosave.test.ts` | `vi.useFakeTimers()`; advance 2s; assert 'saving' → 'saved' → 'idle' after 3s |
| UI-EDITOR-AUTOSAVE-S2 — debounce exactly 2s | `useAutosave.test.ts` | Advance 1999ms: no PATCH. Advance 1ms more: PATCH called |
| UI-EDITOR-AUTOSAVE-S3 — click-to-retry | `useAutosave.test.ts` | Set status 'error'; call retry fn; assert PATCH called immediately |
| UI-EDITOR-RETRY-S1 — two failures → toast + draft | `useAutosave.test.ts` | Mock PATCH to reject twice; advance 5s for retry; assert toast + draftStore |
| UI-EDITOR-RETRY-S2 — draft cleared on success | `useAutosave.test.ts` | Pre-seed draft; PATCH succeeds; assert clearDraft called |
| UI-EDITOR-DRAFT-S1 — recovery toast on note open | `NoteEditorPage.test.tsx` | Pre-seed draftStore; render `/notes/abc`; assert toast text |
| UI-EDITOR-DRAFT-S2 — restore replaces content | `NoteEditorPage.test.tsx` | Click "Restore"; assert editor title matches draft title |
| UI-EDITOR-TAGS-S1 — combobox filters tags | `NoteEditorPage.test.tsx` | Type "work"; assert only Work tag visible in list |
| UI-EDITOR-TAGS-S2 — Enter creates new tag | `NoteEditorPage.test.tsx` | Type "newtag" + Enter; assert POST /tags called; chip appears |
| UI-EDITOR-TAGS-S3 — X removes chip | `NoteEditorPage.test.tsx` | Assert chip present; click X; assert chip gone + PATCH timer reset |

## Dependencies

- AB-1011 merged (all layout/infra in place).
- Backend AB-1004 (POST/GET/PATCH /notes) and AB-1006 (GET/POST /tags) merged.
