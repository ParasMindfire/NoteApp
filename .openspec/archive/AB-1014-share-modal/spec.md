---
ticket: AB-1014
title: Frontend — Share Modal
status: APPROVED
created: 2026-06-28
---

## Overview

AB-1014 wires the sharing API (merged in AB-1008) into the frontend. A `<Share2 />` icon button on each `<NoteCard />` and in the note editor header opens a shadcn/ui Dialog. Inside the modal, users can view all existing share links (active and revoked), generate a new link with an optional expiry date, copy the generated URL to the clipboard, and revoke any active link behind a confirmation step. This ticket modifies two existing components (`NoteCard`, `NoteEditor`) and introduces the `ShareModal` component family.

## Goals

- Surface sharing functionality for notes discoverable from both the notes list and the editor.
- Allow users to generate, inspect, and revoke share links without leaving the page.
- Auto-copy the share URL on creation and provide a fallback for browsers where `navigator.clipboard` is unavailable.

## Non-Goals

- No new route — the modal is embedded in existing pages.
- No editing of an existing link's expiry after creation.
- No public share view page (AB-1008 backend exposes GET /public/shares/:token; the UI for that is out of scope for this ticket).
- No "copy link" button on individual link cards (only auto-copy on generation).

## FRs Covered

- FR-UI-SHARE-1: Share button opens modal
- FR-UI-SHARE-2: Active links list
- FR-UI-SHARE-3: Generate new link
- FR-UI-SHARE-4: Revoke with confirmation

## Pages / Components

| Component | Location | Role |
|-----------|----------|------|
| `<ShareModal />` | `components/share/ShareModal.tsx` | shadcn/ui Dialog wrapper; owns open/close state passed in via props |
| `<ShareLinkCard />` | `components/share/ShareLinkCard.tsx` | Displays a single share link row: token tail, expiry, viewCount, Revoke button |
| `<ShareGenerateForm />` | `components/share/ShareGenerateForm.tsx` | Optional date picker + "Generate link" button |
| `<RevokeConfirmDialog />` | `components/share/RevokeConfirmDialog.tsx` | Nested shadcn/ui AlertDialog for the confirm-before-destructive step |

**Modified components:**
- `NoteCard.tsx` — Share2 button's `onClick={() => {}}` replaced with `setShareOpen(true)` + `<ShareModal noteId={note.id} open={shareOpen} onOpenChange={setShareOpen} />`
- `NoteEditor.tsx` — same wiring for the Share2 button in the editor header bar

## State Management

**TanStack Query**

| Key | Endpoint | Notes |
|-----|----------|-------|
| `['shares', noteId]` | GET /notes/:noteId/shares | Fetched when modal opens (`enabled: open`) |

**Mutations**
- `createShare` — POST /notes/:noteId/shares → on 201: copy URL, show success toast, invalidate `['shares', noteId]`
- `revokeShare` — DELETE /notes/:noteId/shares/:token → on 204: invalidate `['shares', noteId]`, close confirm dialog

**Zustand — none.** Modal open/close state is local React `useState` inside `NoteCard` and `NoteEditor`. No server data goes into Zustand (per UX.md state management rule).

## API Integration

| Method | Endpoint | Triggered by | Success | Error |
|--------|----------|--------------|---------|-------|
| GET | /notes/:id/shares | Modal opens | 200 → render `<ShareLinkCard />` list | 401 → redirect /login (interceptor); 404 → toast "Note not found" |
| POST | /notes/:id/shares | "Generate link" click | 201 → clipboard copy + success toast + refetch | 400 → toast "Invalid expiry date"; 401 → interceptor; 404 → toast "Note not found" |
| DELETE | /notes/:id/shares/:token | Revoke confirmed | 204 → refetch list | 401 → interceptor; 404 → toast "Link not found" |

**Error code → message mappings to add in `errorMessages.ts`:**

| Code | User-facing message |
|------|---------------------|
| `SHARE_NOT_FOUND` | "Share link not found." |

(Other codes 400/401/404 are handled by existing interceptor or generic toast.)

## Ticket-Specific UX Decisions

1. **All links shown (active + revoked).** GET /notes/:id/shares returns both; revoked links render with `opacity-50`, a "Revoked" shadcn/ui Badge (`variant="secondary"`), and the Revoke button hidden. This matches FR-UI-SHARE-4 ("Revoked links visually distinguished") without filtering on the frontend.

2. **Clipboard fallback.** `navigator.clipboard.writeText()` is only available in secure contexts. On failure, the `createShare` success handler catches the rejection and shows a toast "Couldn't copy link — copy it manually:" followed by a read-only `<Input readOnly />` displaying the full `shareUrl`. This avoids a silent failure.

3. **Date picker component.** shadcn/ui does not ship a standalone DatePicker; the standard pattern is `<Popover>` + `<Calendar>` (both already installed). `<ShareGenerateForm />` uses this combination. Min selectable date is tomorrow (past expiries are rejected by the API with 400).

4. **Modal fetch timing.** The `['shares', noteId]` query is enabled only when the modal `open === true`. This avoids a background fetch on every note card render.

5. **Loading state inside modal.** While GET /notes/:id/shares is in-flight, the modal body renders three `<Skeleton />` rows (matches the UX.md skeleton pattern for lists). The "Generate link" button is not disabled during this load.

6. **Revoke button loading state.** While DELETE is in-flight, the Revoke button in the confirm dialog replaces its label with a spinner and is disabled (per UX.md "Loading States"). Minimum 200ms display.

7. **Token display.** Only the last 6 chars of the token are shown in the UI (e.g., `…a3f9c2`) to avoid exposing the full opaque token in the DOM. The full token is used in the DELETE request path.

## Scenarios

### UI-SHARE-OPEN-S1 — Share button opens modal; ESC closes it
**Validates:** FR-UI-SHARE-1

```
Given a note exists on the /notes list
When the user clicks the Share2 icon button on its NoteCard
Then the share modal opens (role="dialog" visible)
 And pressing ESC closes the modal
 And the Share2 button has aria-label="Share note"
```

### UI-SHARE-OPEN-S2 — Share button in editor header opens modal
**Validates:** FR-UI-SHARE-1

```
Given the user is on /notes/:id
When the user clicks the Share2 icon button in the editor header
Then the share modal opens with the correct noteId
```

### UI-SHARE-LIST-S1 — Active share links displayed
**Validates:** FR-UI-SHARE-2

```
Given a note has 2 share links (1 active, 1 revoked)
When the modal opens
Then the list shows 2 ShareLinkCard rows
 And the active row shows last-6-char token, expiry date, viewCount, and a "Revoke" button
 And the revoked row is greyed out (opacity-50) with a "Revoked" badge and no Revoke button
```

### UI-SHARE-LIST-S2 — Empty state shown when no links exist
**Validates:** FR-UI-SHARE-2

```
Given a note has no share links
When the modal opens
Then the body shows "No active share links" and "Generate one below"
 And the ShareGenerateForm is still visible below
```

### UI-SHARE-CREATE-S1 — Generate link without expiry; URL copied to clipboard
**Validates:** FR-UI-SHARE-3

```
Given the share modal is open
 And navigator.clipboard.writeText is available
When the user clicks "Generate link" (no expiry date set)
Then POST /notes/:id/shares is called with body {}
 And on 201 the shareUrl is written to the clipboard
 And a success toast "Link copied to clipboard" appears
 And the new link appears in the active links list
```

### UI-SHARE-CREATE-S2 — Generate link with expiry date
**Validates:** FR-UI-SHARE-3

```
Given the share modal is open
 And the user selects a future date in the date picker
When the user clicks "Generate link"
Then POST /notes/:id/shares is called with body { expiresAt: <ISO 8601 date> }
 And the new link card shows the selected expiry
```

### UI-SHARE-CREATE-S3 — Clipboard unavailable; fallback shown
**Validates:** FR-UI-SHARE-3 (decision 2)

```
Given navigator.clipboard.writeText throws
When POST /notes/:id/shares succeeds (201)
Then a toast "Couldn't copy link — copy it manually:" appears
 And a read-only input containing the full shareUrl is visible
```

### UI-SHARE-REVOKE-S1 — Revoke with confirmation; link greyed out
**Validates:** FR-UI-SHARE-4

```
Given the share modal is open with at least 1 active link
When the user clicks "Revoke"
Then a confirm modal appears with text "Revoke this share link? Anyone with the link will no longer be able to view this note."
When the user clicks the destructive "Revoke" button in the confirm modal
Then DELETE /notes/:id/shares/:token is called
 And the link row becomes greyed out with a "Revoked" badge
 And the confirm modal closes
```

### UI-SHARE-REVOKE-S2 — Cancel revoke; no API call
**Validates:** FR-UI-SHARE-4

```
Given the revoke confirm modal is open
When the user clicks "Cancel"
Then DELETE /notes/:id/shares/:token is NOT called
 And the share modal remains open showing the unchanged list
```

## Dependencies

- **AB-1008** (backend sharing API) — archived ✓
- **AB-1011** (NoteCard exists) — archived ✓
- **AB-1012** (NoteEditor with Share2 button stub) — archived ✓
- **AB-1013** (current branch, merged before this ticket begins) — in progress

## Open Questions

_None — all decisions resolved above._
