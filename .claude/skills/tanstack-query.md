# TanStack Query Conventions

## Query key factory

Define per domain in a `queryKeys.ts` file alongside the feature:

```ts
export const noteKeys = {
  all: ['notes'] as const,
  list: (filters: NoteFilters) => [...noteKeys.all, 'list', filters] as const,
  detail: (id: string) => [...noteKeys.all, 'detail', id] as const,
}
```

Pass `noteKeys.all` to invalidate everything for that domain; pass `noteKeys.list(filters)` for targeted invalidation.

## Infinite / cursor pagination

```ts
useInfiniteQuery({
  queryKey: noteKeys.list(filters),
  queryFn: ({ pageParam }) => fetchNotes({ cursor: pageParam, ...filters }),
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  initialPageParam: undefined,
})
```

## Mutation with cache invalidation

```ts
const mutation = useMutation({
  mutationFn: createNote,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: noteKeys.all })
  },
})
```

## On logout

Call `queryClient.clear()` to wipe all cached data — required by FR-UI-AUTH-6 (no stale data persists after logout):

```ts
function handleLogout() {
  authService.logout()
  queryClient.clear()
  navigate('/login')
}
```

## Stale time defaults

```ts
// In QueryClient config
defaultOptions: {
  queries: { staleTime: 30_000 },  // 30s for note list queries
}
```
