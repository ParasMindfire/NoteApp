# UX Conventions

> Global conventions for all frontend tickets (AB-1010 to AB-1015).
> Every frontend spec.md inherits these. Override only with explicit
> justification in spec.md (and update UX.md via fix bundle if the
> override is reusable).

## Loading States
- Every async action shows a loading indicator within 100ms.
- Buttons: replace label with spinner; keep button width stable to prevent layout shift.
- Lists/pages: show skeleton screens (shadcn/ui Skeleton), not blank space.
- Never show a loading state for less than 200ms (use a min-display timer to avoid flicker).

## Error States
- API errors map to user-facing messages via a single error-code → message dictionary in apps/web/src/lib/errorMessages.ts.
- Never display raw error.detail to the user. Map by error.code.
- Inline errors (form validation): show below the field, red text, with the input bordered red.
- Toast errors (action failures): top-right, dismissible, auto-dismiss after 5s for non-critical errors.
- Permanent errors (page-level): full-page error component with retry button.

## Empty States
- Every list/collection has a designed empty state with:
    - Icon (lucide-react)
    - Heading: "<Resource> yet"  (e.g., "No notes yet")
    - Subtext: short prompt
    - Primary action button (e.g., "Create your first note")
- Exception (AB-1013): search no-results state omits the primary action button — the
  search input already provides the recovery path ("try different keywords").

## Form Patterns
- Client-side validation with Zod schemas imported from packages/shared.
- Validate on blur, not on every keystroke.
- Submit button disabled until form is valid.
- On submit failure, focus the first invalid field.
- Persist form drafts in Zustand for forms that can be interrupted (e.g., note editor).

## Confirm-Before-Destructive
- Any irreversible action (revoke share link, hard delete, restore version) shows a confirm modal.
- Confirm modal pattern: heading describes consequence, primary button uses destructive color (red), secondary "Cancel" button.

## Navigation
- Protected routes redirect to /login if no access token.
- After login, redirect to the original destination if present (?next=...), else /notes.
- Logout always redirects to /login and clears all in-memory state.

## State Management
- Server state: TanStack Query (cache, refetch, optimistic updates).
- Client UI state: Zustand (sort/filter selections, drafts, ephemeral modals).
- Never put server data in Zustand. Never put ephemeral UI state in TanStack Query.

## Tokens (Auth)
- Access token: kept in memory in a Zustand store; never localStorage.
- Refresh token: stored in an httpOnly cookie set by the backend (server-side responsibility);
  frontend never reads it directly.
- On 401 from any request, attempt refresh once; on refresh failure, clear state and redirect to /login.

## Accessibility (Minimum Bar)
- All interactive elements keyboard-reachable (tab order makes sense).
- Form fields have <label>; icon-only buttons have aria-label.
- Focus ring visible (don't override default outline without an alternative).
- Color contrast: AA minimum.

## Toasts
- Use a single toast library (sonner or shadcn/ui toast).
- Success: green, top-right, 3s.
- Error: red, top-right, 5s, dismissible.
- Never stack more than 3 toasts; queue the rest.