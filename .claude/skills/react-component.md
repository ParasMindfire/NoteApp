# React Component Conventions

## shadcn/ui imports

Use the `@/` alias which resolves to `apps/web/src`:

```ts
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
```

## TanStack Query

Co-locate `useQuery`/`useMutation` with the component that needs the data. Don't lift to a parent unless multiple siblings consume the same query.

```ts
function NoteList() {
  const { data, isLoading, error } = useQuery({
    queryKey: noteKeys.list({}),
    queryFn: () => fetchNotes(),
  })
  // ...
}
```

## Zustand

Access slices via selector to avoid unnecessary re-renders:

```ts
// Good
const token = useAuthStore(s => s.token)

// Avoid — subscribes to the entire store
const { token } = useAuthStore()
```

## Accessibility minimums

- All interactive elements need `aria-label` when the visual label is non-descriptive (e.g., icon-only buttons).
- Use semantic HTML: `<button>` not `<div onClick>`, `<nav>` for navigation.
- Ensure focus rings are visible (do not use `outline: none` without a replacement).

## State display

- **Loading**: show a `<Skeleton>` or spinner while `isLoading` is true.
- **Error**: surface via the app's toast system — never `alert()`.
- **Empty**: show an explicit empty state message, not a blank screen.
