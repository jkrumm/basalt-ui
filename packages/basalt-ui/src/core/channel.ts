/**
 * `createChannel`: one receive-only, resumable stream of frames behind a `Transport` seam.
 *
 * Runtime imports: `./channel-transport` (and through it `eventsource-parser`). No React, no Query,
 * and nothing runs at import or at `createChannel`: the connection opens on the first `subscribe`
 * (or the first pull of `frames()`), never on the server.
 */
import { fetchTransport } from './channel-transport'
import type { Transport, Wire } from './channel-transport'

export type { Transport, TransportContext, Wire } from './channel-transport'

/** The shape every frame has before a `schema` narrows it. `data` is `JSON.parse(raw)`, else the string. */
export type Envelope = { event: string; id?: string; data: unknown }

/** The only clock of a channel: injectable, so a test advances time instead of waiting. */
export type Scheduler = {
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
  now(): number
}

/** Standard Schema, declared structurally so this file never reaches into the register seam. */
export type ChannelSchema<F> = {
  readonly '~standard': {
    validate(value: unknown): ChannelSchemaResult<F> | Promise<ChannelSchemaResult<F>>
  }
}
type ChannelSchemaResult<F> = { value: F; issues?: undefined } | { issues: readonly unknown[] }

export type ChannelState = {
  status: 'idle' | 'connecting' | 'live' | 'retrying' | 'unauthorized' | 'failed' | 'done'
  /** Consecutive failed connects; back to 0 on the first byte of a connection. */
  attempt: number
  lastByteAt?: number
  lastFrameAt?: number
  error?: unknown
}

export type Delivered<F> =
  | { kind: 'frame'; ok: true; value: F; id?: string; event: string }
  | { kind: 'frame'; ok: false; raw: string; id?: string; event: string }
  | { kind: 'reset'; reason: 'expired' | 'gap' }

/** What `useSyncExternalStore` takes. The server snapshot is one constant object. */
export type ChannelStore<S> = {
  subscribe(onChange: () => void): () => void
  getSnapshot(): S
  getServerSnapshot(): S
}

export interface Channel<F> {
  subscribe(on: (d: Delivered<F>) => void): () => void
  frames(signal?: AbortSignal): AsyncIterable<F>
  readonly store: ChannelStore<ChannelState>
}

export type ChannelOptions<F> = {
  url?: string | (() => string)
  transport?: Transport
  headers?: () => HeadersInit | Promise<HeadersInit>
  resume?: 'header' | { param: string }
  schema?: ChannelSchema<F>
  greeting?: string
  beats?: readonly string[]
  end?: string | ((raw: { event: string; data: string }) => boolean)
  heartbeatMs?: number
  scheduler?: Scheduler
}

/**
 * Thrown out of `frames()` when frames may be missing: a lost cursor (`expired`) or a reconnect
 * without one (`gap`). Catch it, reload what the stream feeds, and call `frames()` again. Not a root
 * export (no app needs the class): recognise it by `error.name === 'ChannelReset'`; `error.reason` says why.
 *
 * @useWhen a `for await` over `channel.frames()` must reload its data after a reset.
 * @neverWhen you use `channel.subscribe`: there a reset arrives as `{ kind: 'reset' }`, nothing throws.
 */
export class ChannelReset extends Error {
  readonly reason: 'expired' | 'gap'
  constructor(reason: 'expired' | 'gap') {
    super(`channel reset: ${reason}`)
    this.name = 'ChannelReset'
    this.reason = reason
  }
}

const IDLE: ChannelState = { status: 'idle', attempt: 0 }
const BACKOFF_CAP_MS = 30_000
const CLOSE_DELAY_MS = 1_000
const SEEN_IDS = 256
const PUBLISH_BYTE_MS = 1_000

const defaultScheduler: Scheduler = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
}

function statusOf(e: unknown): number | undefined {
  if (typeof e !== 'object' || e === null || !('status' in e)) return undefined
  return typeof e.status === 'number' ? e.status : undefined
}

function parseData(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

type Run<F> = {
  signal: AbortSignal
  /** Awaited before the next wire is pulled: a slow consumer slows the stream, not the heap. */
  deliver: (d: Delivered<F>) => void | Promise<void>
  /** Publishes to the channel store. */
  publish: (s: ChannelState) => void
}

type Outcome = { status: 'done' | 'unauthorized' | 'failed' | 'aborted'; error?: unknown }

/**
 * One receive-only stream of frames: SSE over `fetch` by default, any `Transport` otherwise.
 * Reconnects with jittered backoff (cap 30 s, reset on the first byte), resumes from the last
 * frame id (`resume`), replaces a connection that goes silent for 3x `heartbeatMs`, drops repeated
 * ids, and treats 401/403 as terminal. `subscribe` is refcounted (first opens, last closes after
 * 1 s); `frames()` is an own, pull-based run (an unconsumed frame holds the stream);
 * `store` is a `useSyncExternalStore` source with a constant server snapshot. Frames that fail
 * `schema` arrive as `ok: false` on `subscribe`; `frames()` yields valid values only.
 *
 * @useWhen an app reads a server push stream (SSE, a WebSocket behind a `Transport`) and needs
 * resume, a watchdog and a connection status instead of a hand-rolled `EventSource`.
 * @neverWhen the data is polled (use a query with a cadence), or you need to send over the same
 * socket (a transport is receive-only; keep the send path on the app's socket).
 *
 * @example
 * const channel = createChannel({ url: '/v1/stream', headers: authHeaders, greeting: 'hello' })
 * const off = channel.subscribe((d) => d.kind === 'frame' && d.ok && handle(d.value))
 */
export function createChannel<F = Envelope>(o: ChannelOptions<F>): Channel<F> {
  if (!o.url && !o.transport) throw new Error('createChannel: pass `url` or `transport`')
  const transport: Transport =
    o.transport ?? fetchTransport({ url: o.url!, headers: o.headers, resume: o.resume })
  const sched = o.scheduler ?? defaultScheduler
  const silenceMs = 3 * (o.heartbeatMs ?? 15_000)
  const beats = new Set(o.beats)
  const seen = new Set<string>()

  // ---- store ------------------------------------------------------------------------------
  let state: ChannelState = IDLE
  const listeners = new Set<() => void>()
  const setState = (next: ChannelState) => {
    state = next
    for (const l of Array.from(listeners)) l()
  }
  const store: ChannelStore<ChannelState> = {
    subscribe(onChange) {
      listeners.add(onChange)
      return () => void listeners.delete(onChange)
    },
    getSnapshot: () => state,
    getServerSnapshot: () => IDLE,
  }

  // ---- envelope ---------------------------------------------------------------------------
  const isEnd = (frame: { event: string; data: string }): boolean => {
    if (o.end === undefined) return false
    return typeof o.end === 'function' ? o.end(frame) : frame.event === o.end
  }

  async function toDelivered(w: Extract<Wire, { kind: 'frame' }>): Promise<Delivered<F>> {
    const id = w.id === undefined ? {} : { id: w.id }
    const envelope: Envelope = { event: w.event, ...id, data: parseData(w.data) }
    const base = { kind: 'frame', event: w.event, ...id } as const
    if (!o.schema) return { ...base, ok: true, value: envelope as F }
    try {
      const result = await o.schema['~standard'].validate(envelope)
      if (result.issues) return { ...base, ok: false, raw: w.data }
      return { ...base, ok: true, value: result.value }
    } catch {
      return { ...base, ok: false, raw: w.data }
    }
  }

  // ---- the run: connect, read, retry ------------------------------------------------------
  async function drive(run: Run<F>): Promise<Outcome> {
    const { signal } = run
    let cursor: string | undefined
    let st: ChannelState = { status: 'connecting', attempt: 0 }
    let published = 0
    let lastByteAt = sched.now()
    let wasLive = false
    let current: AbortController | undefined
    let tripped = false
    let wake: (() => void) | undefined

    const set = (patch: Partial<ChannelState>) => {
      st = { ...st, ...patch }
      run.publish(st)
    }
    const trip = () => {
      tripped = true
      current?.abort()
    }
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      if (wake) return wake()
      // a clock comparison, never a timer: a hidden tab's timers are throttled or frozen
      if (current && sched.now() - lastByteAt > silenceMs) trip()
    }
    const onOnline = () => wake?.()
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible)
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('online', onOnline)
    }
    run.publish(st)

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const finish = () => {
          sched.clear(handle)
          signal.removeEventListener('abort', finish)
          wake = undefined
          resolve()
        }
        const handle = sched.set(finish, ms)
        wake = finish
        signal.addEventListener('abort', finish, { once: true })
      })

    try {
      while (!signal.aborted) {
        const ac = new AbortController()
        current = ac
        tripped = false
        const onAbort = () => ac.abort()
        signal.addEventListener('abort', onAbort, { once: true })
        lastByteAt = sched.now()
        let watchdog = sched.set(trip, silenceMs)
        let gotByte = false
        let needGap = wasLive && cursor === undefined
        let failure: unknown
        const aborted = new Promise<never>((_, reject) => {
          ac.signal.addEventListener(
            'abort',
            () => reject(ac.signal.reason ?? new Error('aborted')),
            {
              once: true,
            },
          )
        })
        aborted.catch(() => {})
        const iterator = transport({
          ...(cursor === undefined ? {} : { cursor }),
          signal: ac.signal,
        })[Symbol.asyncIterator]()
        try {
          for (;;) {
            const step = await Promise.race([iterator.next(), aborted])
            if (step.done) break
            const now = sched.now()
            lastByteAt = now
            sched.clear(watchdog)
            watchdog = sched.set(trip, silenceMs)
            const first = !gotByte
            gotByte = true
            if (first) {
              st = { ...st, attempt: 0, error: undefined }
              if (o.greeting === undefined) wasLive = true
            }
            const w = step.value
            const goingLive = first && o.greeting === undefined
            if (goingLive || now - published >= PUBLISH_BYTE_MS || first) {
              published = now
              set({
                lastByteAt: now,
                ...(goingLive ? { status: 'live' as const } : {}),
              })
            }
            if (needGap) {
              needGap = false
              await run.deliver({ kind: 'reset', reason: 'gap' })
            }
            if (w.kind === 'beat') continue
            if (beats.has(w.event)) continue
            if (isEnd(w)) {
              set({ status: 'done' })
              return { status: 'done' }
            }
            if (w.id !== undefined) {
              if (seen.has(w.id)) continue
              seen.add(w.id)
              if (seen.size > SEEN_IDS) seen.delete(seen.values().next().value!)
              if (o.resume) cursor = w.id
            }
            if (w.event === o.greeting) {
              wasLive = true
              set({ status: 'live' })
            }
            set({ lastFrameAt: now })
            await run.deliver(await toDelivered(w))
          }
          failure = new Error('channel: stream ended')
        } catch (e) {
          failure = e
        } finally {
          sched.clear(watchdog)
          signal.removeEventListener('abort', onAbort)
          current = undefined
          ac.abort()
          void iterator.return?.()?.catch(() => {})
        }
        if (signal.aborted) return { status: 'aborted' }
        const code = tripped ? undefined : statusOf(failure)
        if (code === 401 || code === 403) {
          set({ status: 'unauthorized', error: failure })
          return { status: 'unauthorized', error: failure }
        }
        if (code === 410 && cursor !== undefined) {
          cursor = undefined
          seen.clear()
          // the reset says it all: the restart is not also a gap
          wasLive = false
          await run.deliver({ kind: 'reset', reason: 'expired' })
          set({ status: 'connecting' })
          continue
        }
        if (
          code !== undefined &&
          code >= 400 &&
          code < 500 &&
          ![408, 410, 425, 429].includes(code)
        ) {
          set({ status: 'failed', error: failure })
          return { status: 'failed', error: failure }
        }
        if (tripped && gotByte) {
          // a link that carried bytes and went silent is half open, not refused: replace it now
          set({ status: 'connecting' })
          continue
        }
        const attempt = (gotByte ? 0 : st.attempt) + 1
        const base = Math.min(BACKOFF_CAP_MS, 1_000 * 2 ** (attempt - 1))
        set({ status: 'retrying', attempt, error: failure })
        await sleep(base * (0.5 + Math.random() / 2))
        if (signal.aborted) break
        set({ status: 'connecting' })
      }
      return { status: 'aborted' }
    } finally {
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', onVisible)
      if (typeof globalThis.removeEventListener === 'function') {
        globalThis.removeEventListener('online', onOnline)
      }
    }
  }

  // ---- hub: the refcounted subscription ---------------------------------------------------
  const subs = new Set<{ on: (d: Delivered<F>) => void }>()
  let hub: AbortController | undefined
  let closeTimer: unknown
  let closing = false

  const stop = () => {
    closing = false
    hub?.abort()
    hub = undefined
    setState(IDLE)
  }
  const start = () => {
    const ac = new AbortController()
    hub = ac
    void drive({
      signal: ac.signal,
      publish: (s) => {
        if (hub === ac) setState(s)
      },
      deliver: (d) => {
        for (const sub of Array.from(subs)) {
          try {
            sub.on(d)
          } catch (e) {
            console.error('createChannel: a subscriber threw', e)
          }
        }
      },
    })
  }

  function subscribe(on: (d: Delivered<F>) => void): () => void {
    const sub = { on }
    subs.add(sub)
    if (closing) {
      sched.clear(closeTimer)
      closing = false
    }
    if (!hub) start()
    return () => {
      if (!subs.delete(sub) || subs.size > 0) return
      closing = true
      closeTimer = sched.set(stop, CLOSE_DELAY_MS)
    }
  }

  // ---- frames: an own run, pulled one frame at a time -------------------------------------
  async function* frames(signal?: AbortSignal): AsyncGenerator<F> {
    const ac = new AbortController()
    const abort = () => ac.abort()
    if (signal?.aborted) return
    signal?.addEventListener('abort', abort, { once: true })
    let slot: { d: Delivered<F>; ack: () => void } | undefined
    let waiting: (() => void) | undefined
    let outcome: Outcome | undefined
    void drive({
      signal: ac.signal,
      publish: (s) => {
        if (!hub) setState(s)
      },
      deliver: (d) =>
        new Promise<void>((ack) => {
          slot = { d, ack }
          waiting?.()
        }),
    })
      .catch((error: unknown): Outcome => ({ status: 'failed', error }))
      .then((r) => {
        outcome = r
        waiting?.()
      })
    try {
      for (;;) {
        while (!slot && !outcome) await new Promise<void>((r) => (waiting = r))
        waiting = undefined
        if (!slot) break
        const { d, ack } = slot
        slot = undefined
        if (d.kind === 'reset') throw new ChannelReset(d.reason)
        if (d.ok) yield d.value
        ack()
      }
      if (outcome?.status === 'unauthorized' || outcome?.status === 'failed') throw outcome.error
    } finally {
      signal?.removeEventListener('abort', abort)
      ac.abort()
      slot?.ack()
    }
  }

  return { subscribe, frames, store }
}
