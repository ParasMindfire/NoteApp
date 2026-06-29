# Fix Bundles — AB-1014 Share Modal

## Bundle 1 — 2026-06-29 (APPLIED)

**Triggered by:** Reviewer [FAIL] findings on Tasks T1–T9.

### Fix 1 — Missing toast on clipboard failure (FR-UI-SHARE-3)
- **File:** `apps/web/src/components/share/ShareModal.tsx`
- **Change:** Added `toast.error("Couldn't copy link — copy it manually:")` in the `catch` block before `setFallbackUrl(...)`.
- **Reason:** Spec decision 2 requires a toast notification alongside the inline fallback input; catch block was silently setting state only.

### Fix 2 — `modal={false}` breaks focus trap (FR-UI-SHARE-4 / UX.md)
- **File:** `apps/web/src/components/share/RevokeConfirmDialog.tsx`
- **Change:** Removed `modal={false}` from the Dialog root.
- **Reason:** `RevokeConfirmDialog` is rendered as a sibling Dialog outside `ShareModal`'s DialogContent (in a `<>` fragment), so no stacked-dialog conflict exists. `modal={false}` was unnecessary and disabled the focus trap, violating UX.md Accessibility and Confirm-Before-Destructive requirements.
