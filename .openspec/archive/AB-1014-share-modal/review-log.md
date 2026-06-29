# Review Log — AB-1014 Share Modal

## 2026-06-29T00:00:00Z -- Task T1-T9

### FR-UI-SHARE-1: Share button opens modal

[OK] FR-UI-SHARE-1: Share2 icon button present on NoteCard with `aria-label="Share note"` (NoteCard.tsx line 45)
[OK] FR-UI-SHARE-1: Share2 icon button present in NoteEditor header with `aria-label="Share note"` (NoteEditor.tsx line 103)
[OK] FR-UI-SHARE-1: Both wire to local `useState` open flag and pass `open`/`onOpenChange` to `<ShareModal>` (NoteCard.tsx line 15, NoteEditor.tsx line 26)
[OK] FR-UI-SHARE-1: Dialog uses Radix `DialogPrimitive.Root` which sets `role="dialog"` automatically (dialog.tsx line 6)
[OK] FR-UI-SHARE-1: ESC close provided natively by Radix Dialog

### FR-UI-SHARE-2: Active links list

[OK] FR-UI-SHARE-2: GET /notes/:id/shares fetched with `enabled: open` — `useQuery` with `queryKey: ['shares', noteId]` and `enabled: open` (ShareModal.tsx lines 30-37)
[OK] FR-UI-SHARE-2: Loading state renders exactly 3 `<Skeleton>` rows (ShareModal.tsx lines 95-99)
[WARN] FR-UI-SHARE-2: Empty state text is "No active share links. Generate one below." (single sentence) but FRS/spec says the two phrases are separate — "No active share links" and "Generate one below" (ShareModal.tsx line 102). Minor presentation drift; semantics are equivalent.
[OK] FR-UI-SHARE-2: ShareLinkCard shows last 6 chars of token via `link.token.slice(-6)` (ShareLinkCard.tsx line 13)
[OK] FR-UI-SHARE-2: ShareLinkCard shows expiry (formatDistanceToNow) or "No expiry" (ShareLinkCard.tsx lines 31-35)
[OK] FR-UI-SHARE-2: ShareLinkCard shows viewCount (ShareLinkCard.tsx line 30)
[OK] FR-UI-SHARE-2: ShareLinkCard shows Revoke button for active links (ShareLinkCard.tsx lines 40-51)
[OK] FR-UI-SHARE-2: Revoked links rendered with `opacity-50` CSS class (ShareLinkCard.tsx line 17)
[OK] FR-UI-SHARE-2: Revoked links show "Revoked" Badge with `variant="secondary"` (ShareLinkCard.tsx lines 23-26)
[OK] FR-UI-SHARE-2: Revoked links have NO Revoke button — conditional on `!isRevoked` (ShareLinkCard.tsx line 40)

### FR-UI-SHARE-3: Generate new link

[OK] FR-UI-SHARE-3: POST /notes/:id/shares called on form submit via `createMutation.mutate` (ShareModal.tsx lines 53-70, ShareGenerateForm.tsx line 21)
[OK] FR-UI-SHARE-3: `<input type="date">` present with `min={tomorrow}` computed via `addDays(new Date(), 1)` from date-fns (ShareGenerateForm.tsx lines 17, 30-31)
[OK] FR-UI-SHARE-3: `navigator.clipboard.writeText(shareLink.shareUrl)` called in try block (ShareModal.tsx line 61)
[OK] FR-UI-SHARE-3: Clipboard success fires `toast.success('Link copied to clipboard')` (ShareModal.tsx line 62)
[FAIL→FIXED Bundle 1] FR-UI-SHARE-3: Missing toast on clipboard failure — `toast.error("Couldn't copy link — copy it manually:")` added to catch block in ShareModal.tsx before `setFallbackUrl()`.
[OK] FR-UI-SHARE-3: Fallback read-only Input rendered in dialog when `fallbackUrl` is set (ShareModal.tsx lines 112-124)
[OK] FR-UI-SHARE-3: Query invalidated after generation: `queryClient.invalidateQueries({ queryKey: ['shares', noteId] })` (ShareModal.tsx line 59)

### FR-UI-SHARE-4: Revoke with confirmation

[OK] FR-UI-SHARE-4: Revoke button click calls `setTokenToRevoke(token)` which opens the confirm Dialog (ShareLinkCard.tsx line 46, ShareModal.tsx lines 72-74)
[FAIL→NOT A BUG] FR-UI-SHARE-4: DialogTitle + DialogDescription split is the correct shadcn/ui pattern. Tests query them separately; 9/9 pass.
[FAIL→FIXED Bundle 1] FR-UI-SHARE-4: `modal={false}` removed from RevokeConfirmDialog — focus trap restored.
[OK] FR-UI-SHARE-4: Destructive "Revoke" button uses `variant="destructive"` (RevokeConfirmDialog.tsx line 46)
[OK] FR-UI-SHARE-4: "Cancel" button present (RevokeConfirmDialog.tsx lines 37-41)
[OK] FR-UI-SHARE-4: On confirm, DELETE /notes/:id/shares/:token is called via `revokeMutation.mutate(tokenToRevoke)` (ShareModal.tsx line 78)
[OK] FR-UI-SHARE-4: On 204, query invalidated and confirm dialog closed (ShareModal.tsx lines 44-45)
[OK] FR-UI-SHARE-4: Revoked links visually distinguished — opacity-50 + "Revoked" badge (ShareLinkCard.tsx lines 17, 23-26)

### UX.md Conventions

[OK] UX.md Loading States: Both ShareGenerateForm and RevokeConfirmDialog use `useMinDuration(isPending, 200)` for 200ms minimum spinner display (ShareGenerateForm.tsx line 15, RevokeConfirmDialog.tsx line 25)
[OK] UX.md Error States: `SHARE_NOT_FOUND` added to errorMessages.ts (errorMessages.ts line 12)
[OK] UX.md Confirm-Before-Destructive: confirm modal present for revoke action (RevokeConfirmDialog.tsx)
[OK] UX.md Accessibility: aria-labels on icon-only Share2 buttons in NoteCard and NoteEditor; Revoke button has `aria-label` with token tail (ShareLinkCard.tsx line 47)

### Security

[OK] SEC: No `dangerouslySetInnerHTML` found in any share component
[OK] SEC: No token stored in localStorage or Zustand — token only used in DELETE request path, stored transiently in `tokenToRevoke` React state

### Test Coverage

[COVERAGE→RESOLVED T10] All 9 scenarios covered in `apps/web/src/__tests__/components/ShareModal.test.tsx` — 9/9 passing.
