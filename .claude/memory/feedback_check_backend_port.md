---
name: feedback-check-backend-port
description: API base URL fallback must be port 3000 everywhere — api.ts and all MSW handlers
metadata:
  type: feedback
---

Never hardcode port 4000 anywhere in the frontend. The backend runs on port 3000. Use 3000 as the fallback in every file that references VITE_API_URL.

**Why:** `apps/web/.env` sets `VITE_API_URL=http://localhost:3000`. When tests run via Vitest, this env var is read. MSW handlers that fell back to 4000 missed all requests because Axios was calling 3000 while MSW was listening on 4000.

**How to apply:**
- In `apps/web/src/lib/api.ts`: `baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000'`
- In ALL MSW handler files: `const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'`
- Before writing any new handler file, check existing handlers for the established BASE pattern and match it exactly.
- Check `apps/web/.env` at the start of any frontend ticket to confirm the port hasn't changed.
