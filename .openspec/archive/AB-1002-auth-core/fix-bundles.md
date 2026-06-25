# Fix Bundles — AB-1002

## FB-1 — FRS amendments for httpOnly cookie transport (2026-06-25)
**Trigger:** T7 reviewer found FRS text drift — FR-AUTH-2/3/4 still referenced `refreshToken` in request/response bodies despite spec.md decision 1 approving cookie-only transport.
**Root cause:** FRS amendments listed in spec.md decision 1 were not applied to docs/FRS.md.
**Changes applied (FRS only, no code changes — code was already correct):**
- FR-AUTH-2 success response: removed `refreshToken` from body; added cookie note
- FR-AUTH-3 validation: changed `body { refreshToken: string }` → httpOnly cookie
- FR-AUTH-4 validation: changed `body { refreshToken: string }` → httpOnly cookie
**Approved:** 2026-06-25

## FB-2 — FRS drift (FR-AUTH-3/4) + register P2002 detection (2026-06-25)
**Trigger:** T8 reviewer found two FRS lines still inconsistent with spec.md decision 1; T7 tester found AUTH-REGISTER-S3 returning 201 instead of 409.
**Changes applied:**
- FRS FR-AUTH-3 success response: `{ accessToken, refreshToken }` → `{ accessToken }` (refreshToken in cookie only)
- FRS FR-AUTH-3 errors: removed "400 VALIDATION_FAILED — missing refreshToken"; consolidated into single 401 AUTH_REFRESH_INVALID bullet
- FRS FR-AUTH-4 errors: removed "400 VALIDATION_FAILED — missing refreshToken"; added explicit "missing cookie → 204 (idempotent)" note
- `apps/api/src/routes/auth/register.ts`: replaced `err instanceof Prisma.PrismaClientKnownRequestError` with `err instanceof Error && (err as { code?: string }).code === 'P2002'` (pnpm strict-mode module isolation caused instanceof to silently return false)
**Approved:** 2026-06-25

