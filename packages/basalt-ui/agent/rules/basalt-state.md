---
source: basalt-ui
description: Where state lives — search and local fields, queries, streams, storage and routes.
paths:
  - '**/src/**'
---

# Basalt State

State a control reads or writes is a field handle; the URL wins over device storage over the fallback.

## Fields

- A filter, tab, range or view is a `field` handle from `basalt-ui/router`, never `useState`. [type:ControlHandle]
- A handle's `clear()` unsets; it never writes the fallback. [type:ControlHandle]
- A value another store owns binds through `externalField`, with no lane of its own. [type:FieldLike]
- Table view state persists through a `ViewStore`. [type:ViewStore]

## Queries and freshness

- Declare freshness with `liveQuery(queryOptions, class)`; never `refetchInterval` or a timer that invalidates. [lint:data-primitive]
- Build the one client with `makeQueryClient()`; use `queryClient.query()`, never `ensureQueryData`, `prefetchQuery` or `fetchQuery`. [lint:data-primitive]
- Open a stream with `createChannel` through the Transport seam; never an `EventSource`, a `WebSocket` or a reader loop of your own. [lint:data-primitive]
- Pass a chart the query state and the real data; a fallback array paints an empty chart as loaded. [lint:data-primitive]
- Connection and freshness reach the UI as `ConnectionView` and `FreshnessView`, fed by `useConnection` and `useFreshness`. [type:ConnectionView] [type:FreshnessView]
- A channel reports its state as `ChannelStatus`. [type:ChannelStatus]

## Storage

- Persist through `persisted` or a store field; never write `localStorage` directly. [lint:data-primitive] [type:StorageLike]
- A storage backend is synchronous; an async backend preloads before the first render. [type:StorageLike]

## Routes

- Read search state through the store's hook; never `useSearch({ from: '<literal>' })`, and link a store-backed route by reference. [lint:router-search]
- Never wrap the route outlet in a view transition; a route validator is pure. [lint:router-search]
- Open a route with `navTarget(...)`, never a bare path string. [type:NavTarget]

not guarded:

- Under SSR a field reads URL then fallback until hydration commits; never read a stored value in a server loader.
- Wrap every API-client call in `unwrap()` so an error branch throws.
- Keep `ai` and `@ai-sdk/*` on one major across packages; `doctor` checks it at install, the editor does not.
