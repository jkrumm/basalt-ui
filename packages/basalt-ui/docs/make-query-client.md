---
name: makeQueryClient
use when: 'an app or an SSR request needs its QueryClient, built once per router or per request'
never when: 'a module-level `new QueryClient()` would be shared across requests or tests'
subpath: basalt-ui/data
peers: []
slots: []
---

# makeQueryClient

Builds the QueryClient with the basalt defaults (30 s stale, 5 min gc, no retry on a 4xx except
408/425/429, no refetch on focus); consumer `config` wins per key.

## Signature

```ts
makeQueryClient(config?: QueryClientConfig): QueryClient
```
