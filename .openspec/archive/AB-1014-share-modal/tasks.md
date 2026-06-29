---
ticket: AB-1014
title: Frontend — Share Modal
status: APPROVED
created: 2026-06-29
---

## Tasks

- [x] **T1** [PARALLEL] Add `@radix-ui/react-dialog` package + create `dialog.tsx` UI primitive — 15 min
  - Scenarios: (foundation for all UI-SHARE-* scenarios)
  - Files:
    - `apps/web/package.json` — add `"@radix-ui/react-dialog": "1.1.17"` to dependencies
    - `apps/web/src/components/ui/dialog.tsx` — shadcn/ui Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter exports
  - Notes: copy standard shadcn/ui Dialog template; no business logic

- [x] **T2** [PARALLEL] Add `ShareLink` type + `SHARE_NOT_FOUND` error message — 10 min
  - Scenarios: (foundation for all UI-SHARE-* scenarios)
  - Files:
    - `apps/web/src/types/shares.ts` — create with `ShareLink` interface (`id, token, shareUrl, expiresAt, revokedAt, viewCount, createdAt`)
    - `apps/web/src/lib/errorMessages.ts` — add `SHARE_NOT_FOUND: "Share link not found."`

- [x] **T3** Add MSW share handlers + register in mock server — 25 min
  - Depends on: T2
  - Scenarios: (test infrastructure for all UI-SHARE-* scenarios)
  - Files:
    - `apps/web/src/mocks/handlers/share.handlers.ts` — create handlers:
      - `GET /notes/:id/shares` → 200 with 2-link fixture (1 active, 1 revoked); `note-empty` → `[]`
      - `POST /notes/:id/shares` → 201 with fixture ShareLink; `note-fail-share` → 500
      - `DELETE /notes/:id/shares/:token` → 204; `bad-token` → 404 `SHARE_NOT_FOUND`
    - `apps/web/src/mocks/server.ts` — import and spread `shareHandlers`
  - Notes: register DELETE `/notes/:id/shares/:token` before any catch-all DELETE to avoid MSW match shadowing

- [x] **T4** [PARALLEL] Create `ShareLinkCard` component — 20 min
  - Depends on: T1, T2
  - Scenarios: UI-SHARE-LIST-S1, UI-SHARE-LIST-S2, UI-SHARE-REVOKE-S1, UI-SHARE-REVOKE-S2
  - Files:
    - `apps/web/src/components/share/ShareLinkCard.tsx` — props: `link: ShareLink`, `onRevoke: (token: string) => void`; renders token tail (last 6 chars), expiry, viewCount, Revoke button; if `link.revokedAt` → `opacity-50` + "Revoked" Badge + no Revoke button

- [x] **T5** [PARALLEL] Create `RevokeConfirmDialog` component — 20 min
  - Depends on: T1
  - Scenarios: UI-SHARE-REVOKE-S1, UI-SHARE-REVOKE-S2
  - Files:
    - `apps/web/src/components/share/RevokeConfirmDialog.tsx` — props: `open`, `onOpenChange`, `onConfirm`, `isPending`; nested Dialog with `modal={false}`; heading "Revoke this share link?"; body "Anyone with the link will no longer be able to view this note."; destructive "Revoke" button (spinner + disabled when `isPending`, min 200ms per UX.md) + "Cancel" button

- [x] **T6** [PARALLEL] Create `ShareGenerateForm` component — 20 min
  - Depends on: T1
  - Scenarios: UI-SHARE-CREATE-S1, UI-SHARE-CREATE-S2, UI-SHARE-CREATE-S3
  - Files:
    - `apps/web/src/components/share/ShareGenerateForm.tsx` — props: `noteId`, `onGenerated: (shareUrl: string) => void`, `isPending`; native `<input type="date">` with `min` set to tomorrow via `date-fns/addDays`; "Generate link" button (spinner when `isPending`); calls POST mutation internally; on 201 calls `onGenerated(shareUrl)`

- [x] **T7** Create `ShareModal` component — 35 min
  - Depends on: T2, T3, T4, T5, T6
  - Scenarios: UI-SHARE-OPEN-S1, UI-SHARE-OPEN-S2, UI-SHARE-LIST-S1, UI-SHARE-LIST-S2, UI-SHARE-CREATE-S1, UI-SHARE-CREATE-S2, UI-SHARE-CREATE-S3, UI-SHARE-REVOKE-S1, UI-SHARE-REVOKE-S2
  - Files:
    - `apps/web/src/components/share/ShareModal.tsx` — props: `noteId: string`, `open: boolean`, `onOpenChange: (open: boolean) => void`
      - `useQuery(['shares', noteId], GET /notes/:noteId/shares, { enabled: open })`
      - Loading → 3× `<Skeleton>` rows
      - Empty → "No active share links" + "Generate one below"
      - List → `<ShareLinkCard>` × N
      - `revokeShare` useMutation (DELETE); on 204: invalidate `['shares', noteId]`
      - `createShare` useMutation (POST); on 201: `navigator.clipboard.writeText(shareUrl)` in try/catch; success toast "Link copied to clipboard" OR set `fallbackUrl` state on catch
      - When `fallbackUrl` set: read-only `<Input>` below form showing full URL
      - `<ShareGenerateForm>` wired to `createShare.mutate`

- [x] **T8** [PARALLEL] Wire Share2 button in `NoteCard` — 15 min
  - Depends on: T7
  - Scenarios: UI-SHARE-OPEN-S1
  - Files:
    - `apps/web/src/components/notes/NoteCard.tsx` — add `const [shareOpen, setShareOpen] = useState(false)`; replace `onClick={() => {}}` with `onClick={() => setShareOpen(true)}`; render `<ShareModal noteId={note.id} open={shareOpen} onOpenChange={setShareOpen} />` inside the article

- [x] **T9** [PARALLEL] Wire Share2 button in `NoteEditor` — 15 min
  - Depends on: T7
  - Scenarios: UI-SHARE-OPEN-S2
  - Files:
    - `apps/web/src/components/editor/NoteEditor.tsx` — add `const [shareOpen, setShareOpen] = useState(false)`; replace `onClick={() => {}}` on Share2 button with `onClick={() => setShareOpen(true)}`; render `<ShareModal noteId={note.id} open={shareOpen} onOpenChange={setShareOpen} />` inside the editor root div

- [x] **T10** [SUBAGENT] Write `ShareModal.test.tsx` — 50 min
  - Depends on: T8, T9 (all wired components in place)
  - Scenarios: UI-SHARE-OPEN-S1, UI-SHARE-OPEN-S2, UI-SHARE-LIST-S1, UI-SHARE-LIST-S2, UI-SHARE-CREATE-S1, UI-SHARE-CREATE-S2, UI-SHARE-CREATE-S3, UI-SHARE-REVOKE-S1, UI-SHARE-REVOKE-S2
  - Files:
    - `apps/web/src/__tests__/components/ShareModal.test.tsx`
  - Notes:
    - Mock `navigator.clipboard` with `Object.defineProperty` per plan risk area 3
    - Test NoteCard integration for UI-SHARE-OPEN-S1 (modal opens on Share2 click, ESC closes)
    - Test NoteEditor integration for UI-SHARE-OPEN-S2
    - Use MSW `server.use(...)` overrides per test for fixture variants (empty, revoked, fail)
    - Subagent brief: scope = T10 only; model = Sonnet; files allowed = `src/__tests__/components/ShareModal.test.tsx` (write) + all src/components/share/*.tsx + NoteCard.tsx + NoteEditor.tsx (read); coverage target ≥ 80% on new share components
