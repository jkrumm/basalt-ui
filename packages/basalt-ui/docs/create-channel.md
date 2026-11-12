---
name: createChannel
use when: 'an app reads a server push stream (SSE, a WebSocket behind a `Transport`) and needs resume, a watchdog and a connection status instead of a hand-rolled `EventSource`.'
never when: 'the data is polled (use a query with a cadence), or you need to send over the same socket (a transport is receive-only; keep the send path on the app''s socket).'
subpath: basalt-ui
peers: ['@tanstack/react-router-devtools', beautiful-mermaid, rehype-sanitize, remark-gfm, remend, shiki]
slots: []
---

# createChannel

One receive-only stream of frames: SSE over `fetch` by default, any `Transport` otherwise.
Reconnects with jittered backoff (cap 30 s, reset on the first byte), resumes from the last
frame id (`resume`), replaces a connection that goes silent for 3x `heartbeatMs`, drops repeated
ids, and treats 401/403 as terminal. `subscribe` is refcounted (first opens, last closes after
1 s); `frames()` is an own, pull-based run (an unconsumed frame holds the stream);
`store` is a `useSyncExternalStore` source with a constant server snapshot. Frames that fail
`schema` arrive as `ok: false` on `subscribe`; `frames()` yields valid values only.

## Signature

```ts
createChannel<F = Envelope>(o: ChannelOptions<F>): Channel<F>
  url?: string | (() => string)
  transport?: Transport
  headers?: () => HeadersInit | Promise<HeadersInit>
  resume?: "header" | { param: string; }
  schema?: ChannelSchema<F>
  greeting?: string
  beats?: readonly string[]
  end?: string | ((raw: { event: string; data: string; }) => boolea…
  heartbeatMs?: number
  scheduler?: Scheduler
```
