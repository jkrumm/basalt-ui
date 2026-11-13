---
name: websocket-transport
use-when: the server pushes over a WebSocket, not SSE, and a channel must still reconnect, resume and stop on a refused token
file: apps/playground/src/recipes/websocket-transport.ts
---

A `Transport` is a function from `{ cursor, signal }` to an async iterable of `Wire`; this one is over a `WebSocket`. It is the one file `basalt/data-primitive` lets write `new WebSocket`.
Wire it with `createChannel({ transport: webSocketTransport(url), resume: 'header' })`: `resume` makes the channel track the last frame id, and `url(cursor)` sends it.
A browser socket has no headers, so the token rides the URL; `url` runs on every reconnect, so a refreshed token is read each time.
A ping is a `beat`: it resets the watchdog and reaches no handler, so `beats` stays empty.
Close code 4401 throws `{ status: 401 }`: the channel goes `unauthorized` and never retries. Any other close backs off and reconnects with the cursor.
The channel's abort closes the socket, and so does leaving the loop.
The adapter is receive-only and has no backpressure: a send path stays on the app's own socket.
Test it against a `Bun.serve` websocket; code that takes a `Channel` also runs on `fakeChannel`.

```ts
import type { Transport, Wire } from 'basalt-ui'

type Message = { id?: string; event: string; data: unknown } | { ping: true }

export const webSocketTransport = (url: (cursor?: string) => string): Transport =>
  async function* ({ cursor, signal }) {
    const ws = new WebSocket(url(cursor))
    const queue: (Wire | { failure: unknown })[] = []
    let wake = (): void => {}
    const push = (item: Wire | { failure: unknown }): void => {
      queue.push(item)
      wake()
    }
    ws.onmessage = ({ data }) => {
      let m: Message | null = null
      try {
        m = JSON.parse(String(data)) as Message
      } catch {} // not JSON: hand the text on, the channel's schema decides (ok: false)
      if (typeof m !== 'object' || m === null) {
        return push({ kind: 'frame', event: 'message', data: String(data) })
      }
      if ('ping' in m) return push({ kind: 'beat' }) // a ping counts as a byte, never a frame
      push({
        kind: 'frame',
        event: m.event,
        data: JSON.stringify(m.data),
        ...(m.id === undefined ? {} : { id: m.id }),
      })
    }
    ws.onclose = ({ code }) =>
      push({ failure: code === 4401 ? { status: 401 } : new Error('closed') })
    signal.addEventListener('abort', () => ws.close(), { once: true }) // the channel's abort closes the socket
    try {
      for (;;) {
        while (queue.length === 0) await new Promise<void>((resolve) => (wake = resolve))
        const item = queue.shift()!
        if ('failure' in item) throw item.failure // { status } for the channel, an Error for a retry
        yield item
      }
    } finally {
      ws.close()
    }
  }
```
