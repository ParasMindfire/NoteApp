---
id: AB-1016
slug: e2e-journey
status: APPROVED
---

# AB-1016 — E2E Journey

## Overview

This ticket wires together a single Playwright spec (`apps/web/e2e/journey.spec.ts`) that exercises the complete user-facing flow across every feature shipped in AB-1001–AB-1015: registration, note creation, tagging, search, sharing, version history, and logout. A companion Node script (`scripts/check-e2e-coverage.ts`) then parses the spec file and reports any backend FR-* or frontend FR-UI-* that lacks a named assertion, acting as a safety net against coverage drift.

## FRs Covered

- FR-E2E-1 — Full user journey (11 steps)
- FR-E2E-2 — Coverage assertion script

## Journey

The following 11 steps are executed in order inside a single Playwright `test()` block in `apps/web/e2e/journey.spec.ts`. A unique test user is created per run using `test-${Date.now()}@example.com`.

| Step | Action | Expected outcome |
|------|--------|------------------|
| 1 | Fill Register form with unique email + password | User lands on /notes; empty state visible |
| 2 | Click "Create your first note" | Navigates to /notes/new; TipTap editor focused |
| 3 | Type title "E2E Note" and body; pause 3 s | Autosave indicator shows "Saved"; note ID in URL |
| 4 | Type new tag name in inline combobox; press Enter | Tag chip appears on the editor |
| 5 | Navigate to /notes | NoteCard with title and tag chip visible |
| 6 | Open /search; type "E2E Note"; wait for results | Result with `<mark>`-wrapped match; click opens note |
| 7 | Open share modal; set expiry +7 days; click Generate | Link card in list; toast "Link copied to clipboard" |
| 8 | Click Revoke on link; confirm modal | Link card greyed out with "Revoked" badge |
| 9 | Edit note body; wait for autosave | Version history list shows version 2 |
| 10 | Open history drawer; click version 1; split preview shown; Restore; confirm | Editor shows version 1 body; toast "Restored version 1" |
| 11 | Click Logout in header | Redirected to /login; /notes redirects back to /login |

## Scenarios

### E2E-S1: Register and land on notes
**Validates: FR-E2E-1 step 1 · FR-AUTH-1 · FR-AUTH-2 · FR-UI-AUTH-4 · FR-UI-AUTH-2**
```
Given I am on /register
When I fill in test-{timestamp}@example.com and a valid password and submit
Then I am redirected to /notes and the empty-state heading "No notes yet" is visible
```

### E2E-S2: Navigate to note creation
**Validates: FR-E2E-1 step 2 · FR-UI-NOTES-4 · FR-UI-EDITOR-1**
```
Given I am on /notes with the empty state showing
When I click "Create your first note"
Then I am on /notes/new and the TipTap editor content-area is focused
```

### E2E-S3: Type note content and autosave
**Validates: FR-E2E-1 step 3 · FR-UI-EDITOR-1 · FR-UI-EDITOR-2 · FR-UI-EDITOR-3 · FR-NOTE-1 · FR-NOTE-3**
```
Given I am on /notes/new
When I type "E2E Note" in the title and body text then wait 3 s
Then the autosave indicator text is "Saved" and the URL contains a note ID
```

### E2E-S4: Add inline tag
**Validates: FR-E2E-1 step 4 · FR-UI-EDITOR-5 · FR-TAG-2**
```
Given I am editing a note
When I type "e2e-tag" in the tag combobox and press Enter
Then a chip labelled "e2e-tag" appears on the note form
```

### E2E-S5: Note appears in list with tag
**Validates: FR-E2E-1 step 5 · FR-UI-NOTES-1 · FR-UI-NOTES-3 · FR-NOTE-5**
```
Given I navigate to /notes
When the note list loads
Then a NoteCard with title "E2E Note" and tag chip "e2e-tag" is visible
```

### E2E-S6: Search finds and highlights the note
**Validates: FR-E2E-1 step 6 · FR-UI-SEARCH-1 · FR-UI-SEARCH-2 · FR-SEARCH-1 · FR-SEARCH-2**
```
Given I am on /search
When I type "E2E Note" and wait for results
Then a result card containing a <mark>-wrapped match is visible
And clicking it navigates to the note editor
```

### E2E-S7: Generate and copy share link
**Validates: FR-E2E-1 step 7 · FR-UI-SHARE-1 · FR-UI-SHARE-3 · FR-SHARE-1**
```
Given the share modal is open for my note
When I set expiry to 7 days from now and click Generate
Then a link card appears in the active-links list
And the toast "Link copied to clipboard" is visible
And the clipboard mock captured a URL containing the share token
```

### E2E-S8: Revoke share link
**Validates: FR-E2E-1 step 8 · FR-UI-SHARE-4 · FR-SHARE-2**
```
Given an active share link card is shown in the modal
When I click Revoke and confirm the confirm dialog
Then the link card shows a "Revoked" badge and has greyed-out styling
```

### E2E-S9: Edit note to create version 2
**Validates: FR-E2E-1 step 9 · FR-UI-EDITOR-3 · FR-NOTE-3 · FR-VER-1**
```
Given I open the note editor
When I change the body text and wait for autosave
Then opening the history drawer shows at least 2 version entries
```

### E2E-S10: View and restore an older version
**Validates: FR-E2E-1 step 10 · FR-UI-VER-1 · FR-UI-VER-2 · FR-UI-VER-3 · FR-UI-VER-4 · FR-UI-VER-5 · FR-VER-2 · FR-VER-3 · FR-VER-4**
```
Given the history drawer is open and version 1 is listed
When I click version 1 and the split-pane preview appears
And I click "Restore this version" and confirm the modal
Then the editor content matches version 1's body text
And the toast "Restored version 1" is visible
```

### E2E-S11: Logout redirects to /login
**Validates: FR-E2E-1 step 11 · FR-UI-AUTH-6 · FR-AUTH-4**
```
Given I am logged in and on /notes
When I click Logout in the header
Then I am redirected to /login
And navigating to /notes redirects back to /login
```

### E2E-COV-S1: Coverage assertion script reports 0 uncovered FRs
**Validates: FR-E2E-2**
```
Given apps/web/e2e/journey.spec.ts exists with E2E-S1..S11 scenarios
When I run: pnpm coverage:e2e
Then the script exits with code 0 and prints "All FRs covered"
```

## Decisions

1. **Unique email per run** — `test-${Date.now()}@example.com` avoids DB collisions on the shared dev DB with no reset step needed.
2. **Chromium only** — matches the primary user browser; keeps CI runtime minimal. Other browsers deferred to a future ticket.
3. **Single `test()` block** — the full 11-step journey runs in one `test()` so browser state (cookies, localStorage, Zustand) is shared between steps without Playwright auth fixtures.
4. **Clipboard mock** — `navigator.clipboard.writeText` is mocked via `page.addInitScript()` in Playwright's browser context (headless browsers don't expose real clipboard). The mock stores the written value in `window.__clipboardData` for assertion.
5. **Coverage script location** — `scripts/check-e2e-coverage.mjs` (plain ESM JavaScript, no TypeScript transpilation needed), runnable as `pnpm coverage:e2e`. The script reads `spec.md` Validates: lines to build the FR list (subset of FRS.md that the journey claims to cover), then checks each appears in `journey.spec.ts`. Exits 1 with a list of uncovered FRs if any are missing; exits 0 with "All FRs covered" otherwise.

## Dependencies

All of the following tickets must be merged before AB-1016 implementation begins:
- AB-1001 — infrastructure (Playwright already configured under apps/web/e2e)
- AB-1002 — auth backend (register, login, logout, refresh)
- AB-1003 — password reset
- AB-1004 — notes CRUD
- AB-1005 — notes list + pagination + sort + tag filter
- AB-1006 — tags
- AB-1007 — search
- AB-1008 — sharing
- AB-1009 — version history backend
- AB-1010 — auth UI pages
- AB-1011 — notes list UI
- AB-1012 — note editor UI
- AB-1013 — search UI
- AB-1014 — share modal UI
- AB-1015 — version history UI
