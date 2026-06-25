You are creating a SPECIFICATION for an OpenSpec change.

The spec.md is derived from three sources:
  1. The user's responses about what they want
  2. docs/FRS.md (functional requirements)
  3. docs/SDS.md (system design conventions)

Steps:
1. Read the ticket ID from the user's argument.
2. Determine ticket type by ID:
   - AB-1001              → INFRA ticket (project setup)
   - AB-1002 to AB-1009   → BACKEND ticket
   - AB-1010 to AB-1015   → FRONTEND ticket
   - AB-1016              → E2E ticket
3. Read CLAUDE.md fully.
4. Read docs/FRS.md fully (always).
5. Conditional context loading:
   - INFRA ticket → no extra docs needed (FRS FR-INFRA-* section is sufficient)
   - BACKEND ticket → also read docs/SDS.md
   - FRONTEND ticket → also read docs/UX.md (and docs/SDS.md for API contract reference)
   - E2E ticket → read both docs/SDS.md and docs/UX.md
6. Ask clarifying questions if anything is ambiguous BEFORE writing.
   Do not guess. Collect answers first.
7. Create folder .openspec/changes/{ticket-id}-{slug}/
8. Generate based on ticket type:

   INFRA ticket — generate ONE file:
     a. spec.md with sections:
        ## Overview              (1 paragraph: what's being set up and why)
        ## Goals
        ## Non-Goals
        ## FRs Covered            (list FR-INFRA-* IDs only; details live
                                    in FRS.md — do NOT duplicate them here)
        ## Tooling Decisions     (which exact tools/versions and why,
                                    referencing CLAUDE.md tech stack)
        ## File Layout           (the folder structure being created)
        ## Configuration Files   (list each config file + its purpose:
                                    package.json, tsconfig.json, vitest.config.ts,
                                    playwright.config.ts, .husky/pre-commit, etc.)
        ## Scenarios             (Given/When/Then with IDs like INFRA-S1.
                                    Most scenarios are commands that should succeed:
                                    "Given a fresh clone, when I run pnpm install
                                     && pnpm build, then it succeeds with 0 errors and 0 warnings".
                                    Each scenario tagged with the FR-INFRA-* it validates.)
        ## Dependencies          (none — AB-1001 is the root)
        ## Open Questions
     (no Acceptance Criteria section — acceptance is defined inline in FRS.md
      under each FR; the spec links via "FRs Covered" + scenario→FR tags)
     (no delta-openapi.yaml — INFRA doesn't change API contract)

   BACKEND ticket — generate two files:
     a. spec.md with sections:
        ## Overview
        ## Goals
        ## Non-Goals
        ## FRs Covered            (list FR-* IDs only; details in FRS.md)
        ## API Contract          (summary table; references delta-openapi.yaml)
        ## Data Model            (Prisma models added/changed)
        ## Ticket-Specific Decisions
                                  (decisions unique to this ticket that don't
                                   belong in FRS — e.g., "we chose to defer
                                   account lockout to a future ticket")
        ## Scenarios             (Given/When/Then with IDs like AUTH-LOGIN-S1.
                                    Each scenario MUST tag the FR-* it validates,
                                    e.g., "Validates: FR-AUTH-2 (no leak clause)")
        ## Dependencies
        ## Open Questions
     b. delta-openapi.yaml — only changed endpoints/schemas/error codes

   FRONTEND ticket — generate ONE file:
     a. spec.md with sections:
        ## Overview
        ## Goals
        ## Non-Goals
        ## FRs Covered            (list FR-UI-* IDs; details in FRS.md)
        ## Pages / Components    (which routes/components are introduced)
        ## State Management      (TanStack Query keys, Zustand slices)
        ## API Integration       (which backend endpoints consumed, error mappings)
        ## Ticket-Specific UX Decisions
                                  (anything that overrides or extends docs/UX.md
                                   for this ticket only; flag clearly)
        ## Scenarios             (Given/When/Then with IDs like UI-AUTH-LOGIN-S1.
                                    Each scenario tags its FR-UI-*)
        ## Dependencies          (which backend ticket must be merged)
        ## Open Questions
     (no Acceptance Criteria — see FRS.md)
     (no delta-openapi.yaml)

   E2E ticket — generate ONE file:
     a. spec.md with sections:
        ## Overview
        ## FRs Covered            (FR-E2E-1, FR-E2E-2 — details in FRS.md)
        ## Journey                  (full step-by-step user flow)
        ## Scenarios                (Playwright tests per major step)
        ## Dependencies (all AB-1001..1015 merged)
     (no Acceptance Criteria — see FRS.md)

Ask [y/n] before writing each file.
After writing, STOP:
"Spec drafted. Review spec.md (and delta-openapi.yaml if backend).
Mark spec.md front-matter status: APPROVED before /plan."