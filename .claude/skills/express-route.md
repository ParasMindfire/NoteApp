# Express Route Template

## Basic pattern

```ts
import { Router, Request, Response, NextFunction } from 'express'
import { NoteSchema } from '@noteapp/shared'
import { noteService } from '../services/noteService'

const router = Router()

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const result = NoteSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', details: result.error.errors })
  }

  try {
    const note = await noteService.create(result.data)
    res.status(201).json({ data: note })
  } catch (err) {
    next(err)
  }
})

export { router as noteRouter }
```

## Rules

- **Validate with Zod first** — return 400 before touching the service layer.
- **No DB logic in route handlers** — delegate to a service module.
- **Forward errors via `next(err)`** — the global error handler in `src/index.ts` catches them.
- **No try/catch for validation errors** — `.safeParse()` never throws.

## Global error handler (in src/index.ts)

```ts
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message })
})
```

## Auth middleware

```ts
import { authenticate } from '../middleware/auth'

// Protect all routes in this router:
router.use(authenticate)
```
