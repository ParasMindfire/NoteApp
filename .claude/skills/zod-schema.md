# Zod Schema Conventions

## Location rule (non-negotiable)

All shared Zod schemas live **only** in `packages/shared/src/schemas/`. Never define the same schema in `apps/api` or `apps/web`.

Export from the barrel:

```ts
// packages/shared/src/index.ts
export { NoteSchema, CreateNoteSchema } from './schemas/note'
```

## Importing in apps

Both apps import identically — bundler resolves CJS vs ESM automatically:

```ts
import { NoteSchema } from '@noteapp/shared'
```

After adding or changing a schema, rebuild shared before using it in apps:

```bash
pnpm --filter=@noteapp/shared build
```

## Validation style

Always use `.safeParse()` — not `.parse()` — so errors can be handled without try/catch:

```ts
const result = NoteSchema.safeParse(req.body)
if (!result.success) {
  return res.status(400).json({ error: 'VALIDATION_ERROR', details: result.error.errors })
}
const note = result.data
```
