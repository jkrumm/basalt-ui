import { useLayoutEffect, useRef } from 'react'

/**
 * A derived value that feeds back into its own next computation — hysteresis, "was X last frame" —
 * without the anti-pattern of mutating a ref during render (`ChartCard`'s short-card flag, P0-1;
 * `Donut`'s side/stacked layout, P2-10, both hit the SAME bug independently: a render a concurrent
 * commit discards must not still poison the next real one's input).
 *
 * `compute` is called with the PREVIOUS committed value (never mutated here) and returns this
 * render's value; the ref only updates in a `useLayoutEffect`, after the value has actually
 * committed. Internal only — not on any public barrel.
 *
 * @example
 * const short = useHysteresis(
 *   (wasShort) => measuredHeight > 0 && measuredHeight < (wasShort ? EXIT : ENTER),
 *   false,
 * )
 */
export function useHysteresis<T>(compute: (previous: T) => T, initial: T): T {
  const ref = useRef(initial)
  const value = compute(ref.current)
  useLayoutEffect(() => {
    ref.current = value
  }, [value])
  return value
}
