---
name: useFreshness
use when: 'a page shows how old its data is, or wires a refresh button to the queries it reads'
never when: 'the refresh is a server job with its own state (pass the `RefreshButton` its own props)'
subpath: basalt-ui/data
peers: []
slots: []
---

# useFreshness

The freshness of the data behind `keys` (every active query when omitted) and the props of a
`RefreshButton`: `{...useFreshness().button}`. `fetch` is `error` over `paused` over `stale` over
`fresh`, `none` with no active query; `button.onSync` invalidates the keys; `button.error` is
the failing query's message. `source` reads an upstream timestamp out of the data (a Garmin
sync time) against `sourceMaxAge`. The server render carries no age, so it hydrates cleanly.
Needs a client from `makeQueryClient`.

## Signature

```ts
useFreshness(keys?: readonly QueryKey[], options?: FreshnessOptions): FreshnessView
```
