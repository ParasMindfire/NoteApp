# Prisma Migration

## Running migrations

```bash
pnpm --filter=@noteapp/api exec prisma migrate dev --name <description>
```

Prisma auto-prefixes the timestamp — use a short snake_case description like `add_tags` or `soft_delete_notes`. Never manually create migration files.

After adding or changing models, regenerate the client before building:

```bash
pnpm --filter=@noteapp/api exec prisma generate
```

## Soft-delete pattern (non-negotiable)

All deletable models must have:

```prisma
deletedAt DateTime?
```

Filter in all queries:

```ts
where: { deletedAt: null }
```

**Never use `DELETE FROM` on the `notes` table.** Always set `deletedAt = now()` instead. This is a hard project rule.

## When to use `$transaction`

Use `prisma.$transaction([...])` whenever a logical operation touches more than one table. Examples:
- Creating a note and its initial tags
- Archiving a note and updating a counter

Single-table reads and writes do not need a transaction.
