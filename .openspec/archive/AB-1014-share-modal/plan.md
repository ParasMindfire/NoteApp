---
ticket: AB-1014
title: Frontend — Share Modal
status: APPROVED
created: 2026-06-29
---

## Overview

Wire the AB-1008 sharing API into the frontend. Add a `<ShareModal />` Dialog triggered from `NoteCard` and `NoteEditor`. The modal lists all share links, generates new ones (with optional expiry), copies the URL to the clipboard, and revokes links behind a confirm step.

## Dependencies on Prior Tickets

| Ticket | Status | Provides |
|--------|--------|----------|
| AB-1008 | archived | GET/POST/DELETE /notes/:id/shares API |
| AB-1011 | archived | `NoteCard` component (Share2 stub exists) |
| AB-1012 | archived | `NoteEditor` component (Share2 stub exists) |
| AB-1013 | archived | `mocks/server.ts` pattern, App.tsx routes |

## Prisma Schema Changes

None — frontend-only ticket.

## New Packages

| Package | Version | Reason |
|---------|---------|--------|
| `@radix-ui/react-dialog` | `1.1.17` | shadcn/ui Dialog (already in lock as transitive dep of `cmdk`; promoting to explicit dep) |

**No other new packages.** Confirm dialog is implemented with Dialog (not AlertDialog, avoids `@radix-ui/react-alert-dialog`). Date picker uses native `<input type="date">` (avoids `react-day-picker`).

## Files to Create

| File | Purpose |
|------|---------|
| `apps/web/src/components/ui/dialog.tsx` | shadcn/ui Dialog wrapper over `@radix-ui/react-dialog` |
| `apps/web/src/types/shares.ts` | `ShareLink` interface matching GET /notes/:id/shares response |
| `apps/web/src/components/share/ShareModal.tsx` | Dialog shell; fetches `['shares', noteId]`; renders list + generate form |
| `apps/web/src/components/share/ShareLinkCard.tsx` | Single row: token tail, expiry, viewCount, Revoke button; greyed if revoked |
| `apps/web/src/components/share/ShareGenerateForm.tsx` | `<input type="date">` for optional expiry + "Generate link" button |
| `apps/web/src/components/share/RevokeConfirmDialog.tsx` | Nested Dialog acting as confirm modal ("Revoke this share link?") |
| `apps/web/src/mocks/handlers/share.handlers.ts` | MSW handlers: GET/POST/DELETE /notes/:id/shares + /notes/:id/shares/:token |
| `apps/web/src/__tests__/components/ShareModal.test.tsx` | All 8 UI-SHARE-* scenarios |

## Files to Modify

| File | Change |
|------|--------|
| `apps/web/package.json` | Add `"@radix-ui/react-dialog": "1.1.17"` to dependencies |
| `apps/web/src/types/notes.ts` | No change — Share types go in `shares.ts` |
| `apps/web/src/lib/errorMessages.ts` | Add `SHARE_NOT_FOUND: "Share link not found."` |
| `apps/web/src/components/notes/NoteCard.tsx` | Add `useState(false)` for modal open; wire Share2 `onClick`; render `<ShareModal>` |
| `apps/web/src/components/editor/NoteEditor.tsx` | Same wiring as NoteCard for Share2 button in editor header |
| `apps/web/src/mocks/server.ts` | Import and spread `shareHandlers` |

## Type Shape

```ts
// apps/web/src/types/shares.ts
export interface ShareLink {
  id: string;
  token: string;
  shareUrl: string;
  expiresAt: string | null;
  revokedAt: string | null;
  viewCount: number;
  createdAt: string;
}
```

## Component Tree

```
NoteCard / NoteEditor
└── <ShareModal noteId open onOpenChange>          (Dialog)
    ├── loading → 3× <Skeleton> rows
    ├── empty  → "No active share links" + "Generate one below"
    ├── list   → <ShareLinkCard> × N
    │             └── "Revoke" → <RevokeConfirmDialog>
    │                              ├── "Revoke" (destructive) → DELETE mutation
    │                              └── "Cancel"
    └── <ShareGenerateForm>
          ├── <input type="date" min={tomorrow}>
          └── "Generate link" → POST mutation → clipboard + toast
```

## TanStack Query Keys

| Key | Endpoint | Notes |
|-----|----------|-------|
| `['shares', noteId]` | GET /notes/:noteId/shares | `enabled: open` — only fetches when modal is open |

**Mutations** (no dedicated query keys):
- `createShare` — POST; on 201: `navigator.clipboard.writeText(shareUrl)`, success toast, `invalidateQueries(['shares', noteId])`
- `revokeShare` — DELETE; on 204: `invalidateQueries(['shares', noteId])`, close confirm dialog

## Clipboard Fallback Strategy

```
try {
  await navigator.clipboard.writeText(shareUrl)
  toast.success('Link copied to clipboard')
} catch {
  // show fallback: toast with read-only input
  setFallbackUrl(shareUrl)
}
```
`fallbackUrl` state lives in `ShareModal`. When set, renders a read-only `<Input>` below the generate form.

## Test Strategy

**File:** `apps/web/src/__tests__/components/ShareModal.test.tsx`

All tests use MSW (`share.handlers.ts`) + `@testing-library/react` + `sonner` mocked.

| Scenario ID | What's tested |
|-------------|---------------|
| UI-SHARE-OPEN-S1 | Share2 on NoteCard → modal opens; ESC closes; aria-label present |
| UI-SHARE-OPEN-S2 | Share2 in NoteEditor → modal opens with correct noteId |
| UI-SHARE-LIST-S1 | 2 links (1 active, 1 revoked) → correct rendering + Revoked badge |
| UI-SHARE-LIST-S2 | 0 links → empty state text visible |
| UI-SHARE-CREATE-S1 | Generate (no expiry) → POST called; clipboard written; success toast |
| UI-SHARE-CREATE-S2 | Generate with expiry date → POST body includes `expiresAt` |
| UI-SHARE-CREATE-S3 | `navigator.clipboard.writeText` throws → fallback input rendered |
| UI-SHARE-REVOKE-S1 | Revoke → confirm modal → confirm click → DELETE called → Revoked badge |
| UI-SHARE-REVOKE-S2 | Revoke → confirm modal → Cancel → DELETE NOT called |

**MSW handler IDs for test fixtures:**
- `GET /notes/note-1/shares` → 2 links by default; `GET /notes/note-empty/shares` → `[]`
- `POST /notes/:id/shares` → 201 with fixture share; `POST /notes/note-fail-share/shares` → 500
- `DELETE /notes/:id/shares/:token` → 204; `DELETE /notes/:id/shares/bad-token` → 404

## Risk Areas

1. **Dialog + nested Dialog (confirm).** Radix Dialog does not natively support stacked dialogs. `RevokeConfirmDialog` must use `modal={false}` on the inner Dialog or set `preventScroll={false}` so focus management doesn't fight. Test with keyboard navigation.

2. **MSW handler ordering.** `DELETE /notes/:id/shares/:token` must be registered before a catch-all `DELETE /notes/:id` if one existed. In `share.handlers.ts`, place the token-scoped DELETE handler first.

3. **`navigator.clipboard` in jsdom.** jsdom does not implement `navigator.clipboard`. Tests for UI-SHARE-CREATE-S1 and S3 must mock it:
   ```ts
   Object.defineProperty(navigator, 'clipboard', {
     value: { writeText: vi.fn().mockResolvedValue(undefined) },
     writable: true,
   })
   ```

4. **`enabled: open` race.** If the Dialog animation completes before `open` is `true` in state, the query may not fire. Use `open` directly from the prop passed into `ShareModal` — no intermediate state needed.

5. **`<input type="date">` min value.** The min must be tomorrow (UTC), not today, since past `expiresAt` is rejected 400 by the API. Compute it with `date-fns/addDays` (already installed).

## Implementation Order

Tasks should be implemented in this order to minimize blocked work:

1. `dialog.tsx` (UI primitive — no deps)
2. `shares.ts` type + `errorMessages.ts` update
3. `share.handlers.ts` MSW handlers
4. `ShareLinkCard.tsx` + `RevokeConfirmDialog.tsx` (leaf components)
5. `ShareGenerateForm.tsx`
6. `ShareModal.tsx` (assembles all sub-components)
7. Wire `NoteCard.tsx` + `NoteEditor.tsx`
8. `mocks/server.ts` update
9. `ShareModal.test.tsx`
