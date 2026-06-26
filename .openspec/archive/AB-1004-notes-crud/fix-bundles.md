# Fix Bundles — AB-1004

## FB-1 — T1+T2: SDS cuid/cuid2 mismatch + spec.md FK onDelete drift (2026-06-26)

**Trigger:** Reviewer [FAIL] SDS.md "IDs: cuid2" vs actual `@default(cuid())` in all models (pre-existing). [WARN] spec.md Data Model showed FK relations without `onDelete: Cascade`.

**Root cause:** SDS was written with cuid2 intent but project was bootstrapped with cuid v1. All existing models use cuid v1 and no migration plan exists to switch.

**Changes applied:**
- `docs/SDS.md`: `IDs: cuid2` → `IDs: cuid`
- `.openspec/changes/AB-1004-notes-crud/spec.md`: All FK `@relation(...)` lines in Data Model updated to include `onDelete: Cascade`

**Code changes:** None — schema is correct as-is.

## FB-2 — T3: OTP uses Math.random() instead of CSPRNG (2026-06-26)

**Trigger:** Reviewer [SEC] — `Math.random()` is not cryptographically secure for OTP generation.

**Root cause:** Pre-existing issue in `forgot-password.ts` fat handler, faithfully copied during service extraction.

**Changes applied:**
- `apps/api/src/services/auth.service.ts` line 114: `Math.floor(100000 + Math.random() * 900000).toString()` → `crypto.randomInt(100000, 1000000).toString()`
- `apps/api/src/routes/auth/forgot-password.ts`: same fix + added `import crypto from 'node:crypto'` (fat handler remains active until T5)

## FB-3 — T5: Rate-limit handler lambdas and keyGenerator violate FR-ARCH-1 (2026-06-26)

**Trigger:** Reviewer [FAIL] — `routes/auth/index.ts` contained inline `handler: (req, res) => res.status(429).json(...)` lambdas (response shaping) and `keyGenerator: (req) => req.body?.email` (request reading). FR-ARCH-1: "routes/: Express router registration + .catch(next) only."

**Root cause:** Pre-existing pattern in the original fat-handler `index.ts`, preserved during refactor.

**Changes applied:**
- Created `apps/api/src/middleware/rateLimiters.ts` — exports `createRegisterLimiter`, `createLoginLimiter`, `createForgotPasswordLimiter` with all response shaping and key generation encapsulated
- Updated `apps/api/src/routes/auth/index.ts` — now imports limiter factories; contains only `router.post(...)` + `.catch(next)` wiring

