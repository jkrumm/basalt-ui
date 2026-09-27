/**
 * Two small pieces shared by every touch-pinned surface in the chart layer — extracted so
 * `useChartCursor`/`useDiscreteCursor`/`ChartLegend`'s disclosure cannot drift apart on the same
 * contract (round 2's carried-forward gap: each had its own hand-rolled copy).
 */
import { useCallback, useEffect, useRef } from 'react'

/**
 * Outside-tap / Escape / scroll (optionally resize) dismissal for a pinned/open floating element.
 * Capture-phase `pointerdown` so a descendant that stops propagation on its own handler can't leave
 * the dismissal stuck.
 */
export function useDismissOnOutside({
  enabled,
  isInside,
  onDismiss,
  dismissOnResize = false,
  scrollExemptInside = false,
}: {
  enabled: boolean
  /** A tap (or, with `scrollExemptInside`, a scroll) landing where this returns true doesn't
   * dismiss. Omit to treat every tap as outside. */
  isInside?: (target: Node) => boolean
  onDismiss: () => void
  /** Also dismiss on a window `resize` — `ChartLegend`'s disclosure needs this, the touch-pinned
   * cursors don't (their host doesn't reflow independently of the chart it's pinned to). */
  dismissOnResize?: boolean
  /** Exempts a scroll whose target is `isInside` — `ChartLegend`'s own scrollable panel needs this
   * (`overflowY: auto`), the cursor hooks don't (a chart has no internal scroller to protect). */
  scrollExemptInside?: boolean
}): void {
  useEffect(() => {
    if (!enabled) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && isInside?.(event.target) === true) return
      onDismiss()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    const onScroll = (event: Event) => {
      if (scrollExemptInside && event.target instanceof Node && isInside?.(event.target) === true) {
        return
      }
      onDismiss()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('scroll', onScroll, true)
    if (dismissOnResize) window.addEventListener('resize', onDismiss)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('scroll', onScroll, true)
      if (dismissOnResize) window.removeEventListener('resize', onDismiss)
    }
  }, [enabled, isInside, onDismiss, dismissOnResize, scrollExemptInside])
}

export type TouchPin = {
  /** `onPointerDown` for a coarse press: snapshots whatever is currently committed (via
   * `getCommitted`) so a later `cancel` can restore exactly that, then tracks `pointerId`. */
  begin: (pointerId: number) => void
  /** `onPointerUp` for the tracked pointer: the press is now committed — nothing left to revert. */
  commit: (pointerId: number) => boolean
  /** `onPointerCancel`/`onPointerLeave` for the tracked pointer: the browser took the gesture (a
   * scroll) before the press committed — restores the pre-press value via `setCommitted`, or
   * leaves it clear when nothing was committed before. Returns whether this pointer was tracked. */
  cancel: (pointerId: number) => boolean
  /** Hard reset — no restore, just drop any in-flight press bookkeeping (an explicit `clear()`, e.g.
   * Escape or an outside tap, is about to overwrite the value directly anyway). */
  reset: () => void
}

/**
 * Provisional-press state machine shared by `useChartCursor`/`useDiscreteCursor`: a coarse press
 * shows a value immediately (PROVISIONAL, not yet committed) — `commit` on `pointerup` leaves it in
 * place, `cancel` on `pointercancel`/`pointerleave` (a scroll winning the gesture) restores whatever
 * was committed before this press started, rather than dropping it. This is what keeps a previously
 * COMMITTED pin alive through a second tap that gets cancelled instead of completed.
 */
export function useTouchPin<V>({
  getCommitted,
  setCommitted,
}: {
  /** Reads the value currently committed — snapshotted on `begin`, restored on `cancel`. */
  getCommitted: () => V
  setCommitted: (value: V) => void
}): TouchPin {
  const pressRef = useRef<number | null>(null)
  const backupRef = useRef<V | undefined>(undefined)
  const getCommittedRef = useRef(getCommitted)
  getCommittedRef.current = getCommitted
  const setCommittedRef = useRef(setCommitted)
  setCommittedRef.current = setCommitted

  const begin = useCallback((pointerId: number) => {
    backupRef.current = getCommittedRef.current()
    pressRef.current = pointerId
  }, [])

  const commit = useCallback((pointerId: number): boolean => {
    if (pressRef.current !== pointerId) return false
    pressRef.current = null
    backupRef.current = undefined
    return true
  }, [])

  const cancel = useCallback((pointerId: number): boolean => {
    if (pressRef.current !== pointerId) return false
    pressRef.current = null
    const backup = backupRef.current
    backupRef.current = undefined
    if (backup !== undefined) setCommittedRef.current(backup)
    return true
  }, [])

  const reset = useCallback(() => {
    pressRef.current = null
    backupRef.current = undefined
  }, [])

  return { begin, commit, cancel, reset }
}
