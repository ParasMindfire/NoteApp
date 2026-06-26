---
status: DRAFT
ticket: TBD  # Assign ticket ID before starting — must run between AB-1003 merge and AB-1004 start
---

# Auth Layer Refactor — Retrofit AB-1002/1003 to FR-ARCH-1

## Overview
AB-1002 and AB-1003 implemented auth endpoints as fat handlers (validation + business logic +
response shaping all co-located in `routes/auth/*.ts`). FR-ARCH-1 (added post-AB-1003) mandates
a three-layer structure (routes → controllers → services) from AB-1004 onwards. This refactor
retrofits the existing auth routes to the same pattern before frontend integration (AB-1010) begins.
Zero functional delta — no behavior change, no API contract change.

## Goals
- Extract auth business logic into `apps/api/src/services/auth.service.ts`
- Extract Zod validation + response shaping into `apps/api/src/controllers/auth.controller.ts`
- Slim `routes/auth/*.ts` files to pure Express wiring + `.catch(next)`
- All existing tests pass unchanged after refactor

## Non-Goals
- New features or bug fixes
- Changing any API contract (paths, status codes, response shapes, error codes)
- Moving middleware (auth.ts, errorHandler.ts stay as-is)
- Moving lib files (prisma.ts, jwt.ts, cookie.ts stay as-is)

## FRs Covered
- FR-ARCH-1 — retroactive compliance for all AB-1002 + AB-1003 endpoints

## API Contract
No changes. All endpoints stay on the same paths with the same request/response shapes.

## Data Model
No changes.

## Ticket-Specific Decisions
1. **Single service file, single controller file for all auth:** auth has 6 endpoints (register,
   login, refresh, logout, forgot-password, reset-password) — grouping them in one service and
   one controller is cleaner than 6 files at this scale.
2. **Route files stay in `routes/auth/` subfolder:** the router index + per-handler files remain
   under `routes/auth/`. Only the fat logic inside them moves to controller/service.
3. **No behavior change = no new tests needed:** existing tests are integration tests that call
   HTTP endpoints — they verify behavior, not internal structure. They will pass unchanged.
   The reviewer will confirm FR-ARCH-1 cross-layer import rules are satisfied.

## Files to Create
| File | Purpose |
|------|---------|
| `apps/api/src/services/auth.service.ts` | registerUser, loginUser, refreshTokens, logoutUser, sendOtp, resetPassword |
| `apps/api/src/controllers/auth.controller.ts` | Zod validate + call service + res.json for each endpoint |

## Files to Modify
| File | Change |
|------|--------|
| `apps/api/src/routes/auth/register.ts` | Slim to wiring only; call registerController |
| `apps/api/src/routes/auth/login.ts` | Slim to wiring only; call loginController |
| `apps/api/src/routes/auth/refresh.ts` | Slim to wiring only; call refreshController |
| `apps/api/src/routes/auth/logout.ts` | Slim to wiring only; call logoutController |
| `apps/api/src/routes/auth/forgot-password.ts` | Slim to wiring only; call forgotPasswordController |
| `apps/api/src/routes/auth/reset-password.ts` | Slim to wiring only; call resetPasswordController |

## Scenarios
All existing test scenarios (AUTH-REGISTER-S1..S4, AUTH-LOGIN-S1..S4, AUTH-REFRESH-S1..S3,
AUTH-LOGOUT-S1..S2, AUTH-FORGOT-S1..S3, AUTH-OTP-S1..S5, WIRING-S1..S12) continue to pass
after refactor. No new scenarios — this ticket has zero behavioral delta.

## Dependencies
- AB-1003 merged (provides the starting codebase for this refactor)
- Must be complete before AB-1010 (frontend auth integration)
