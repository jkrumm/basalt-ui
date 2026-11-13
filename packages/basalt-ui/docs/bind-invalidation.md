---
name: bindInvalidation
use when: 'an app pushes changes over a channel and queries should refetch from them instead of polling'
never when: 'the frame carries the whole entity and a cache write is enough (use `patch` alone and have `map` skip it), or the data is only polled'
subpath: basalt-ui/data
peers: []
slots: []
---

# bindInvalidation

Binds a channel's frames to the cache. `start()` (call it in a root effect) subscribes and
returns the stop; it is idempotent, and a QueryClient takes one binding at a time. Only
`pushed` queries (see `liveQuery`) are ever invalidated. An unparseable frame, a frame `map`
throws on, and a frame no one maps all invalidate every pushed query, never nothing. The first
time the stream goes live joins the boot requests (`cancelRefetch: false`); every later
live, and every `reset` (a 410 or a cursorless reconnect), is a gap and applies `onGap`.
It also tells the live runtime whether the stream is live, which moves `pushed` queries
between `fallback` and `safety`. Beat events are the channel's (`beats`) and never reach `map`;
pass the channel's `greeting` so the greeting does not reach `map` either.
Console wiring (software-factory apps/console; replaces its live.ts, policy.ts and debounce.ts):
`createChannel({ url: '/v1/stream', greeting: 'hello', schema })`, then
`bindInvalidation(client, channel, { roots: ROOTS, aggregates: ['kpis', 'friction'], greeting: 'hello', map: (change) => BY_KIND[change.kind] ?? 'all' })`,
then `useEffect(() => live.start(), [])` in the root.

## Signature

```ts
bindInvalidation<F, R extends string>(client: QueryClient, channel: Channel<F>, o: BindInvalidationOptions<F, R>): { start(): () => void; }
```
