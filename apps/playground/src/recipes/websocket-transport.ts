// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
import { createChannel } from 'basalt-ui'
// #region recipe:websocket-transport
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
// #endregion

// The wiring the prose names: compiled here, not part of the recipe region.
export const changes = createChannel({
  transport: webSocketTransport(
    (cursor) => `wss://api.example.com/ws${cursor ? `?cursor=${cursor}` : ''}`,
  ),
  resume: 'header',
})
