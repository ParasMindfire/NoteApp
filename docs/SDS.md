# System Design Specification

## Error Format (RFC 7807)
{
  "type": "https://api.example.com/errors/{code}",
  "title": "Human readable",
  "status": 4xx,
  "detail": "Specific message",
  "code": "DOMAIN_REASON"
}

## HTTP Status Codes
400 validation | 401 unauth | 403 forbidden | 404 not found
409 conflict | 410 gone | 422 business rule | 429 rate limited

## Endpoint Conventions
- Plural names: /notes, /tags, /shares
- Cursor pagination: ?cursor=<opaque>&limit=20 (limit ≤ 50)
- Sort: ?sort=field:asc|desc
- All responses JSON
- Auth header: Authorization: Bearer <jwt>

## Rate Limits
- /auth/login: 5/min per IP
- /auth/register: 3/hour per IP
- /auth/forgot-password: 3/hour per email
- /shares/:token: 60/min per IP

## Data Conventions
- Timestamps: ISO 8601 UTC
- IDs: cuid2
- Soft delete: deletedAt timestamp

## Backend Layer Convention (AB-1004+)
Three layers enforced from AB-1004 onwards (auth routes grandfathered — refactor ticket pending before AB-1010):
- **routes/**: Express wiring only — register router, `.catch(next)`. No logic, no Prisma.
- **controllers/**: Zod validate → call service → `res.json()`. No `@prisma/client` imports.
- **services/**: Business logic + all Prisma calls. No Express types (`Request`/`Response`).