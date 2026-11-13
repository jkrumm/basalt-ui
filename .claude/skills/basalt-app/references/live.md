# Live data: freshness, streams and the connection

Procedure for making a page live. The law is `.claude/rules/basalt-state.md`; each prohibition below carries its guard tag, and what nothing guards sits under `not guarded:`.

## The ladder

Pick the least live class that is true for the data; each rung costs more than the one above.

- `liveQuery(options, 'static')` for data that changes only when the user changes it: staleTime is `Infinity`, so a push or a global refresh still reaches it. [lint:data-primitive]
- `liveQuery(options, 'standard')` for cross-device data: refetch on focus when older than 30 s. `{ class: 'standard', onFocus: true }` is the same class spelled out. [type:Freshness]
- `{ class: 'ticker', every }` when the server cannot push: `every` counts from the previous result (a number or `(query) => number | false`), the tick pauses while hidden, offline, mutating (`pauseWhileMutating`) or after a 401/403. `external: true` for a third-party source; `background: true` only for a wall display.
- `{ class: 'pushed', fallback, safety }` when a channel carries the change: `fallback` polls while the stream is not live, `safety` polls while it is, and it is the only bound on a silent server-side lag.
- Never write `refetchInterval` or `refetchIntervalInBackground`, on a query or as a spread at the call site; the cadence belongs to the class in the query factory. [lint:data-primitive]
- Never write a timer that invalidates or refetches; a plain `setInterval` for a clock is fine. [lint:data-primitive]
- Never write `staleTime: 'static'` inside a `liveQuery` argument: a `'static'` observer makes the query immune to `invalidateQueries`, so a push, a global refresh and a deploy all skip it. [lint:data-primitive]

## Channel, frames, roots

- One channel per client, built once and started in a root effect: `createChannel({ url, headers, greeting, resume, schema })`, then `useEffect(() => live.start(), [])` on `bindInvalidation(client, channel, { roots, map })`. Nothing runs at import.
- `roots` lists every `queryKey[0]` a frame may touch; a `pushed` query outside it can never refresh and is a dev error.
- `map(frame)` returns what that frame alters: `'all'`, `'none'`, a root, a list of roots or a key predicate. Prefer a lookup table over a switch:

```tsx
// @check
import { createChannel } from 'basalt-ui'
import { bindInvalidation, makeQueryClient } from 'basalt-ui/data'
import { useEffect } from 'react'

const ROOTS = ['jobs', 'kpis', 'friction'] as const
type Root = (typeof ROOTS)[number]

// event -> the roots it alters; an unknown event refreshes everything, so a new server event is never ignored
const BY_EVENT: Record<string, 'none' | Root | readonly Root[]> = {
  'job.updated': 'jobs',
  'job.finished': ['jobs', 'kpis'],
  'friction.logged': ['friction', 'kpis'],
  heartbeat: 'none',
}

export const client = makeQueryClient()
const channel = createChannel({ url: '/v1/stream', greeting: 'hello', beats: ['heartbeat'] })
const live = bindInvalidation(client, channel, {
  roots: ROOTS,
  aggregates: ['kpis', 'friction'],
  greeting: 'hello',
  map: (_frame, { event }) => BY_EVENT[event] ?? 'all',
})

// in the root component: start once, mounted, never at import
export function useLive(): void {
  useEffect(() => live.start(), [])
}
```

- `aggregates` names the slower tier (2 s) among `roots`; every other root is the list tier (250 ms). Burst frames collapse; a frame never refetches per event.
- `patch(frame, client)` is the explicit `setQueryData` seam, for a frame that carries the whole new value and nothing private; `map` returns `'none'` to skip the invalidation.
- Never open a stream yourself: no `new EventSource`, no `new WebSocket`, no `getReader()` loop. A file that implements a `Transport` is the one place a socket may be constructed; the WebSocket recipe is `docs/recipes/websocket-transport.md`. [lint:data-primitive]
- Never build the client with `new QueryClient()`: `makeQueryClient()` installs the connection runtime the classes read. [lint:data-primitive]
- A channel reports its state as `ChannelStatus`; branch on that union, never on a string you invented. [type:ChannelStatus]

## Indicator and age on every live surface

- A page with a `ticker` or `pushed` query mounts `ConnectionIndicator` from `basalt-ui/page` (`connection={useConnection()}`) or a `RefreshButton` (`scope="global" {...useFreshness().button}`); a live page with neither shows data of no stated age.
- `ConnectionIndicator` takes `connection` as a required prop, so an unwired indicator fails the type check instead of rendering nothing. [type:ConnectionView]
- A refresh control takes its props from `useFreshness()`; `onSync` invalidates the keys and `error` is the failing query's message. [type:FreshnessView]
- A page scope (a server job with its own last-run time) passes the job's own `lastCompletedAt` and message to `RefreshButton`, never the global ones.
- Paused without data is Offline copy, not Loading; stale data stays visible with its age.

## Server checklist

- Every frame has a monotonic `id:`, and the stream honours `Last-Event-ID` (or the cursor param named in `resume`); without ids the app is cursorless (below).
- First event after connect is the `greeting` (`hello`), so "stream up" is not inferred from a proxy's first byte.
- A heartbeat (comment or named event, listed in `beats`) at least every 15 s: the watchdog trips at three times `heartbeatMs`.
- A refused token answers 401 or 403 (WebSocket: close 4401) and never 200 then close: a terminal status stops the retry.
- A lost cursor answers 410; the channel then delivers `reset: 'expired'` and restarts without one.
- A finite stream ends with a named `end` event (`end: 'end'` or `end: '[DONE]'`), then the channel is `done` and does not reconnect.
- A receiver that falls behind gets a `lagged` frame or a close, not silence; turn off proxy buffering for the stream route.

## Cursorless mode

- No `resume` and no ids: every reconnect after the stream was live is a `reset: 'gap'`, and `onGap` decides what that invalidates (default `'all'`; pass a predicate to spare an expensive root).
- `pushed.safety` is mandatory here and the only bound on silent loss; set it to the longest age the page may show.
- Two optional server changes turn that bound into a detected gap: an `id:` per event and a `lagged` signal.

## Offline semantics

- `ConnectionView.state` is `live` (stream up), `polling` (no stream, ticks running) or `offline`; it never flips `onlineManager`.
- Offline is three consecutive classified network failures (a fetch `TypeError` or the `NetworkError` the shared fetch throws) with 5 s hysteresis; any HTTP response resets the count.
- A schema error, a shape error, `unwrap`'s null-data throw and a failed `external` poll are not network failures and never take the page offline.
- Wrap every API-client call in `unwrap()` so an error branch throws and a failure is classified.

## SSR and privacy

- Under SSR nothing starts: no timer, no fetch, no socket; `useConnection` and `ConnectionIndicator` render the idle state and hydrate without a mismatch.
- Start the channel in a mount effect: a module body, a loader or a component body would run it on the server.
- A frame names what changed; the data comes through the authorized query, so authorization stays on the fetch. Use `patch` only for a frame you would also show to every subscriber.
- Send the token in `headers` (read on every reconnect); a socket cannot, so its URL carries a short-lived ticket and stream URLs stay out of access logs.

## Settle, reload, persist, multi-tab

- Settle: a synced value adopts the server's copy only after its own write window (2 s) has passed; `createSyncedState` owns the gate, `pauseWhileMutating` covers just the PUT in flight.
- Reload: `channel.frames()` throws `ChannelReset` on a `reset`; a loop catches it, reloads the list once, then continues. A page that cannot trust its list reloads on `reset: 'gap'` too.
- Persist: device preferences follow the person through `persisted.setStorage(adapter)`; the recipe is `docs/recipes/storage-adapter.md`. Cache snapshots are an app concern, and a persister needs `shouldDehydrateQuery`.
- Multi-tab: each tab owns its channel (the hub closes 1 s after the last subscriber, so StrictMode and route swaps do not churn the socket). There is no leader election; cross-tab preference changes ride `persisted`'s storage event.

not guarded:

- Every live page mounts an indicator or a refresh control; the fixtures assert it for the shipped examples, nothing checks your app.
- Never put a long-lived token in a stream URL, and never start a channel at import, in a loader or in a component body.
- `safety` is set to the longest acceptable age, not left at an arbitrary default.
- Never log frame payloads; log the event name and id.
- Never treat a `reset` as a change frame; it means frames may be missing.
