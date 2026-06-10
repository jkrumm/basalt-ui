---
source: basalt-ui
description: TanStack Query conventions for basalt-ui apps — query factories, Suspense reads, and mutation/invalidation. Advisory (the framework ships no data layer).
paths:
  - 'src/lib/queries/**'
  - 'apps/**/src/lib/queries/**'
  - 'src/routes/**'
  - 'apps/**/src/routes/**'
---

# Basalt Query — TanStack Query Conventions

basalt-ui ships **no data layer** — server state is the consumer's concern. This rule is the recommended
opinion layer when you use TanStack Query (the basalt-ui default). It is **advisory**; nothing in the
framework enforces it.

## Query factories

Each resource has a factory in `src/lib/queries/<resource>.ts`:

```ts
import { queryOptions } from '@tanstack/react-query'
import { api } from '../api-client'

export const resourceQueries = {
  list: (params: ListParams) =>
    queryOptions({
      queryKey: ['resource', 'list', params],
      queryFn: () => api.resource.get({ query: params }).then((r) => r.data!),
    }),
  summary: () =>
    queryOptions({
      queryKey: ['resource', 'summary'],
      queryFn: () => api.resource.summary.get().then((r) => r.data!),
    }),
}
```

- Key hierarchy: `[resource, action, ...params]`.
- `queryFn` unwraps typed responses (`.data!`) — throw on null so failures surface.
- Never use raw strings as query keys in components — always import from the factory.

## Reading data in components

```ts
const { data } = useSuspenseQuery(resourceQueries.summary())
```

- Always `useSuspenseQuery` inside loader-prefetched routes (never `useQuery`) — pairs with the
  router's `ensureQueryData` (see basalt-router.md).
- Wrap pages or panels in `<Suspense fallback={…}>` at the route level.

## Mutations

```ts
const mutation = useMutation({
  mutationFn: (body) => api.resource.post({ body }).then((r) => r.data!),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['resource'] })
    notifications.show({ message: 'Saved', color: 'green' })
  },
})
```

- Invalidate by resource prefix (first key segment) — catches list + summary at once.
- Show a notification on success; let errors bubble to the global error boundary.
- For the in-button success flip (loading spinner → green `IconCheck`), drive it off `mutation.isPending`
  / `mutation.isSuccess` — see the interaction-feedback section in basalt-mantine.md.

## DevTools

`ReactQueryDevtools` is dev-only — never import it unconditionally. Render it behind a
`process.env.NODE_ENV === 'development'` guard (basalt-ui ships code without `import.meta.env`; mirror
that in app code that the framework's tooling scans).
