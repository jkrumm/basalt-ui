/**
 * `fakeChannel`: a `Channel` a test drives by hand. `emit` delivers a frame, `setStatus` moves the
 * store, `drop` simulates a lost connection (status `retrying`), `end` finishes the stream (status
 * `done`, every `frames()` completes). Same surface as `createChannel`, so the code under test
 * cannot tell the two apart.
 *
 * Runtime imports: none beyond the channel types.
 */
import { ChannelReset } from '../core/channel'
import type { Channel, ChannelState, Delivered } from '../core/channel'

export type FakeChannel<F> = Channel<F> & {
  /** Deliver a frame. `m.event` defaults to `'message'`. */
  emit(frame: F, m?: { id?: string; event?: string }): void
  /** Deliver a reset, as a lost cursor or a reconnect without one would. */
  reset(reason?: 'expired' | 'gap'): void
  setStatus(status: ChannelState['status']): void
  /** The connection dropped: status `retrying`, attempt + 1. */
  drop(): void
  /** The stream finished: status `done`; open `frames()` loops complete. */
  end(): void
}

const IDLE: ChannelState = { status: 'idle', attempt: 0 }

export function fakeChannel<F>(): FakeChannel<F> {
  let state: ChannelState = IDLE
  const stateListeners = new Set<() => void>()
  const subs = new Set<(d: Delivered<F>) => void>()
  const pulls = new Set<(d: Delivered<F> | 'end') => void>()

  const setState = (next: ChannelState) => {
    state = next
    for (const l of Array.from(stateListeners)) l()
  }
  const deliver = (d: Delivered<F>) => {
    for (const s of Array.from(subs)) s(d)
    for (const p of Array.from(pulls)) p(d)
  }

  return {
    subscribe(on) {
      subs.add(on)
      if (state.status === 'idle') setState({ status: 'live', attempt: 0 })
      return () => void subs.delete(on)
    },
    async *frames(signal) {
      const queue: (Delivered<F> | 'end')[] = []
      let wake: (() => void) | undefined
      const push = (d: Delivered<F> | 'end') => {
        queue.push(d)
        wake?.()
      }
      pulls.add(push)
      signal?.addEventListener('abort', () => push('end'), { once: true })
      try {
        for (;;) {
          while (queue.length === 0) await new Promise<void>((r) => (wake = r))
          const d = queue.shift()!
          if (d === 'end') return
          if (d.kind === 'reset') throw new ChannelReset(d.reason)
          if (d.ok) yield d.value
        }
      } finally {
        pulls.delete(push)
      }
    },
    store: {
      subscribe(onChange) {
        stateListeners.add(onChange)
        return () => void stateListeners.delete(onChange)
      },
      getSnapshot: () => state,
      getServerSnapshot: () => IDLE,
    },
    emit(frame, m = {}) {
      setState({ ...state, status: 'live', lastFrameAt: Date.now() })
      deliver({
        kind: 'frame',
        ok: true,
        value: frame,
        event: m.event ?? 'message',
        ...(m.id === undefined ? {} : { id: m.id }),
      })
    },
    reset(reason = 'gap') {
      deliver({ kind: 'reset', reason })
    },
    setStatus(status) {
      setState({ ...state, status })
    },
    drop() {
      setState({ ...state, status: 'retrying', attempt: state.attempt + 1 })
    },
    end() {
      setState({ ...state, status: 'done' })
      for (const p of Array.from(pulls)) p('end')
    },
  }
}
