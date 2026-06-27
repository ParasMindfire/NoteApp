---
ticket: AB-1012
title: Frontend — Note Editor
status: DONE
created: 2026-06-27
---

# AB-1012 — Frontend: Note Editor

## Overview

Implements the note editing experience at `/notes/new` and `/notes/:id`. Navigating to `/notes/new` immediately POSTs a blank note (title: "Untitled") and silently redirects to `/notes/:id` before the user types. The editor wraps TipTap StarterKit with a formatting toolbar (bold, italic, H1/H2/H3, bullet list, ordered list, code block), a shadcn/ui Input for the title, and an inline tag combobox with create-on-the-fly. Autosave debounces 2s from any change; a status indicator shows "Saving…" / "Saved" / "Save failed — retry". On autosave failure the editor retries once after 5s; on second failure a toast fires and the current draft is persisted to Zustand `draftStore`. On next open of a note with a pending draft, a toast prompt offers Restore / Dismiss.

## Goals

- Implement `/notes/new` and `/notes/:id` routes with TipTap rich editor and formatting toolbar.
- Debounced autosave (2s) with status indicator and click-to-retry.
- Autosave failure recovery: one auto-retry after 5s, then toast + `draftStore`.
- Draft recovery prompt (toast) when a note is opened with a pending draft.
- Inline tag combobox: filter existing tags, create on-the-fly, remove via chip X.
- Meet all accessibility, loading, and UX conventions from docs/UX.md.

## Non-Goals

- Version history drawer — AB-1015; History button rendered as stub.
- Share modal — AB-1014; Share button rendered as stub.
- Search UI — AB-1013.
- Explicit manual Save button (autosave only; retry via status indicator).
- Real-time collaboration.

## FRs Covered

- FR-UI-EDITOR-1 — TipTap rich editor with StarterKit + formatting toolbar
- FR-UI-EDITOR-2 — Title input (1–200 chars; Enter moves focus to editor)
- FR-UI-EDITOR-3 — Autosave (2s debounce, status indicator: Saving → Saved → blank)
- FR-UI-EDITOR-4 — Autosave failure recovery (retry, toast, draftStore, draft prompt)
- FR-UI-EDITOR-5 — Inline tag combobox (filter, create-on-the-fly, remove)

## Pages / Components

| Component | Path | Purpose |
|---|---|---|
| `NoteEditorPage` | `pages/notes/NoteEditorPage.tsx` | Route component; POSTs blank note on `/notes/new` mount; loads note for `/notes/:id`; shows draft recovery toast |
| `NoteEditor` | `components/editor/NoteEditor.tsx` | Orchestrates title input, TipTap, tag combobox, `useAutosave`, status indicator |
| `EditorToolbar` | `components/editor/EditorToolbar.tsx` | Bold, italic, H1/H2/H3, bullet list, ordered list, code block; `aria-pressed` + `aria-label` per button |
| `EditorStatusIndicator` | `components/editor/EditorStatusIndicator.tsx` | Renders status string from `editorStatusStore`; "Save failed — retry" is clickable |
| `TagCombobox` | `components/editor/TagCombobox.tsx` | shadcn/ui Command-based combobox; filters `GET /tags`; Enter on no-match → `POST /tags`; chips with X |

`App.tsx` — add `/notes/new` and `/notes/:id` routes pointing to `<NoteEditorPage />`.

## State Management

### TanStack Query

| Key | Endpoint | Type | Notes |
|---|---|---|---|
| `['note', id]` | `GET /notes/:id` | `useQuery` | Disabled when `id` is undefined |
| `['tags']` | `GET /tags` | `useQuery` | Shared key with AB-1011; no duplicate fetch if already cached |
| — | `POST /notes` | `useMutation` | Fires once on `/notes/new` mount; success → invalidate `['notes', ...]` |
| — | `PATCH /notes/:id` | `useMutation` | Autosave; success → invalidate `['note', id]` + `['notes', ...]` |
| — | `POST /tags` | `useMutation` | Create-on-the-fly; success → invalidate `['tags']` |

### Zustand — `editorStatusStore`

New slice at `stores/editorStatusStore.ts`:

```ts
type EditorStatus = 'idle' | 'saving' | 'saved' | 'error'
interface EditorStatusState {
  status: EditorStatus
  setStatus: (s: EditorStatus) => void
}
// 'saved' reverts to 'idle' after 3s via setTimeout inside useAutosave
```

### Zustand — `draftStore`

New slice at `stores/draftStore.ts`:

```ts
interface Draft {
  title: string
  body: object  // TipTap JSON
  tagIds: string[]
}
interface DraftState {
  drafts: Record<string, Draft>  // keyed by noteId
  setDraft: (noteId: string, draft: Draft) => void
  clearDraft: (noteId: string) => void
}
```

### Custom hook — `useAutosave`

Encapsulates all autosave logic in `hooks/useAutosave.ts`:

- Debounces 2s from any change to `title` or `body` (combined; either resets timer).
- On fire: sets `'saving'`, calls PATCH mutation.
- On success: sets `'saved'` → reverts to `'idle'` after 3s; calls `clearDraft(noteId)`.
- On first failure: schedules auto-retry after 5s.
- On second failure: sets `'error'`; fires toast "Couldn't save your changes"; calls `setDraft(noteId, { title, body, tagIds })`.

## API Integration

| Endpoint | Consumer | Error mapping |
|---|---|---|
| `GET /notes/:id` | `NoteEditorPage` | 404 → navigate `/notes` + toast "Note not found." |
| `POST /notes` | `NoteEditorPage` (mount) | Network / 4xx → toast "Failed to create note." + navigate `/notes` |
| `PATCH /notes/:id` | `useAutosave` | See failure recovery above |
| `GET /tags` | `TagCombobox` | Network error → "Couldn't load tags" inside combobox |
| `POST /tags` | `TagCombobox` | 409 TAG_NAME_DUPLICATE → silently select existing; 400 → toast "Invalid tag name." |

**errorMessages.ts additions:**

| Code | User-facing message |
|---|---|
| `NOTE_NOT_FOUND` (editor context) | "Note not found." |
| `AUTOSAVE_FAILED` (synthetic) | "Couldn't save your changes" |
| `TAG_NAME_DUPLICATE` (combobox) | Handled silently (select existing tag) |

Global 401 handling: Axios interceptor from AB-1010 covers all endpoints.

## Ticket-Specific UX Decisions

1. **New note (`/notes/new`) — immediate POST with "Untitled":** On page mount, `POST /notes` is called with `{ title: "Untitled", body: { type: "doc", content: [] }, tagIds: [] }`. On success, navigate to `/notes/:id` via `history.replace` (not `push` — Back skips `/notes/new`). The title input is pre-populated with "Untitled" and focused with text selected so the user can immediately rename.

2. **Draft recovery toast:** On mount of `NoteEditorPage` for `/notes/:id`, if `draftStore` has an entry for this `noteId`, a shadcn/ui toast fires: "You have an unsaved draft — restore it?" with "Restore" (primary) and "Dismiss" (secondary) actions. Restore: replaces editor content with draft values. Dismiss: calls `clearDraft(noteId)`. Either action dismisses the toast immediately.

3. **Autosave debounce — combined timer:** Changing title, body, or tags (add/remove chip) all reset the same 2s debounce.

4. **Click-to-retry:** Clicking the "Save failed — retry" status indicator immediately fires PATCH (no additional debounce); status transitions to `'saving'`.

5. **Tag create-on-the-fly color:** Color selected from a fixed palette of 8 hex values in `lib/tagColors.ts`, chosen by `existingTagCount % 8` (deterministic; avoids runtime randomness).

6. **Toolbar active state:** `editor.isActive('bold')` etc. drives both `aria-pressed` and a visual ring (`ring-2 ring-primary`) on the active button.

7. **Share/History button stubs:** `<Share2 />` and `<History />` icon buttons rendered in editor header with `aria-label` and `() => {}` handlers. AB-1014 and AB-1015 wire the real handlers.

8. **`/notes/new` loading state:** While the initial `POST /notes` is in-flight, a full-editor skeleton (shadcn/ui Skeleton) is shown. Once redirected to `/notes/:id`, the note query resolves instantly from the mutation cache.

## Scenarios

### UI-EDITOR-S1 — Editor renders with all toolbar buttons
**Validates:** FR-UI-EDITOR-1  
Given the user navigates to `/notes/:id`,  
When the note loads,  
Then the TipTap editor renders with buttons: bold, italic, H1, H2, H3, bullet list, ordered list, code block.

### UI-EDITOR-S2 — Toolbar buttons are keyboard-reachable
**Validates:** FR-UI-EDITOR-1  
Given the editor is open,  
When the user tabs through the toolbar,  
Then each button receives visible focus and has a descriptive `aria-label`; active buttons show `aria-pressed="true"`.

### UI-EDITOR-TITLE-S1 — Enter in title moves focus to editor
**Validates:** FR-UI-EDITOR-2  
Given the title input is focused,  
When the user presses Enter,  
Then focus moves to the TipTap editor body.

### UI-EDITOR-TITLE-S2 — Title > 200 chars shows inline error and blocks autosave
**Validates:** FR-UI-EDITOR-2  
Given the title input contains 201 characters,  
When the field blurs,  
Then an inline error "Title must be between 1 and 200 characters" appears with red border;  
And no PATCH request is issued.

### UI-EDITOR-AUTOSAVE-S1 — Status transitions: Saving → Saved → blank
**Validates:** FR-UI-EDITOR-3  
Given the user edits the note and stops,  
When 2s elapse,  
Then the status indicator shows "Saving…";  
And after the PATCH succeeds it shows "Saved";  
And after 3s it reverts to blank.

### UI-EDITOR-AUTOSAVE-S2 — Debounce is exactly 2s
**Validates:** FR-UI-EDITOR-3  
Given the user types continuously,  
When the user stops,  
Then no PATCH is issued before 2s have elapsed;  
And exactly one PATCH is issued 2s after the last keystroke.

### UI-EDITOR-AUTOSAVE-S3 — Click-to-retry fires PATCH immediately
**Validates:** FR-UI-EDITOR-3  
Given the status indicator shows "Save failed — retry",  
When the user clicks it,  
Then the indicator transitions to "Saving…" and a new PATCH request is issued without waiting for the debounce.

### UI-EDITOR-RETRY-S1 — Two PATCH failures trigger toast + draftStore
**Validates:** FR-UI-EDITOR-4  
Given the first PATCH fails,  
When 5s elapse and the auto-retry also fails,  
Then a toast "Couldn't save your changes" is shown;  
And `draftStore` contains the current title, body, and tagIds for this noteId.

### UI-EDITOR-RETRY-S2 — Draft cleared on next successful save
**Validates:** FR-UI-EDITOR-4  
Given a draft exists in `draftStore` for a note,  
When the next PATCH succeeds (autosave or click-to-retry),  
Then `clearDraft(noteId)` is called and no draft entry remains for that noteId.

### UI-EDITOR-DRAFT-S1 — Draft recovery toast shown on note open
**Validates:** FR-UI-EDITOR-4  
Given a draft exists in `draftStore` for noteId `abc`,  
When the user navigates to `/notes/abc`,  
Then a toast "You have an unsaved draft — restore it?" appears with "Restore" and "Dismiss" actions.

### UI-EDITOR-DRAFT-S2 — Restore replaces editor content with draft
**Validates:** FR-UI-EDITOR-4  
Given the draft recovery toast is shown,  
When the user clicks "Restore",  
Then the editor title, body, and tag chips are replaced with the draft values and the toast dismisses.

### UI-EDITOR-TAGS-S1 — Combobox filters existing tags
**Validates:** FR-UI-EDITOR-5  
Given the user opens the tag combobox and types "work",  
When matching tags exist,  
Then only tags whose names contain "work" are shown; selecting one adds a chip to the note.

### UI-EDITOR-TAGS-S2 — Enter with unmatched text creates new tag
**Validates:** FR-UI-EDITOR-5  
Given the user types "newtag" and no existing tag matches,  
When the user presses Enter,  
Then `POST /tags` is called with `{ name: "newtag", color: <palette color> }`;  
And on 201, the tag is added as a chip on the note.

### UI-EDITOR-TAGS-S3 — X on tag chip removes it and triggers autosave
**Validates:** FR-UI-EDITOR-5  
Given a tag chip is visible on the note,  
When the user clicks the X on the chip,  
Then the tag is removed from `tagIds`, the chip disappears, and the 2s autosave timer resets.

## Dependencies

- **AB-1011 merged** — `AppLayout`, `AppHeader`, `errorMessages.ts`, Axios client, `authStore`, `queryClient`, `['tags']` query pattern established.
- **Backend AB-1004 merged** — `POST /notes`, `GET /notes/:id`, `PATCH /notes/:id` available.
- **Backend AB-1006 merged** — `GET /tags`, `POST /tags` available.
- **packages/shared** — `noteCreateSchema`, `noteUpdateSchema`, `tagCreateSchema` must be exported; verify and add if missing.

## Open Questions

- None — all ambiguities resolved above.
