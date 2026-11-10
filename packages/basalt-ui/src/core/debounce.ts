/**
 * `debounce` — trailing-edge debounce with an optional `maxWait`, and `useDebouncedCallback`, its
 * React binding. The hook flushes a pending call on unmount instead of dropping it, so a draft
 * typed just before navigation still lands.
 */
import { useEffect, useRef, useState } from 'react'

export type DebounceOptions = {
  /** Longest delay between the first un-flushed call and the invocation, however busy the input. */
  maxWait?: number
}

export type Debounced<A extends unknown[]> = {
  call(...a: A): void
  /** Runs the pending call now, if any. */
  flush(): void
  /** Drops the pending call. */
  cancel(): void
  pending(): boolean
}

export function debounce<A extends unknown[]>(
  fn: (...a: A) => void,
  ms: number,
  o?: DebounceOptions,
): Debounced<A> {
  let args: A | null = null
  let trailing: ReturnType<typeof setTimeout> | null = null
  let ceiling: ReturnType<typeof setTimeout> | null = null

  const clear = (): void => {
    if (trailing !== null) clearTimeout(trailing)
    if (ceiling !== null) clearTimeout(ceiling)
    trailing = null
    ceiling = null
  }

  const flush = (): void => {
    clear()
    if (args === null) return
    const pending = args
    args = null
    fn(...pending)
  }

  return {
    call(...a) {
      args = a
      if (trailing !== null) clearTimeout(trailing)
      trailing = setTimeout(flush, ms)
      if (o?.maxWait !== undefined && ceiling === null) ceiling = setTimeout(flush, o.maxWait)
    },
    flush,
    cancel() {
      clear()
      args = null
    },
    pending: () => args !== null,
  }
}

/**
 * A debounced callback that is stable across renders and always runs the latest `fn`. The pending
 * call is flushed on unmount. `ms` and `maxWait` are read at the first render.
 */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...a: A) => void,
  ms: number,
  o?: DebounceOptions,
): Debounced<A> {
  const latest = useRef(fn)
  useEffect(() => {
    latest.current = fn
  })
  // oxlint-disable-next-line react/refs -- `latest` is read when the timer fires, never during render
  const [control] = useState(() => debounce((...a: A) => latest.current(...a), ms, o))

  useEffect(() => () => control.flush(), [control])
  return control
}
