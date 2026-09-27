import { localPoint } from '@visx/event'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, RefObject } from 'react'
import type { CursorResolution } from '../cursor/resolve'
import { buildDomainIndex, classifyDomain, resolveCursorPoint } from '../cursor/resolve'
import { useCursorState, useCursorStore } from '../cursor/scope'

/** Viewport-space pointer anchor the tooltip positions against. */
export type CursorAnchor = { x: number; y: number }

export type ChartCursor<T> = {
  /** The point this chart paints its crosshair + dots at — own hover, or a resolved sibling key. */
  point: T | null
  /** True when the pointer is over THIS chart. Only the source chart shows the floating tooltip. */
  isSource: boolean
  /** Latest pointer position in viewport coords, or null when not hovered. */
  anchor: CursorAnchor | null
  /**
   * True when the interaction that most recently placed THIS chart's cursor had
   * `event.pointerType !== 'mouse'` (touch or pen). Callers fold it into the anchored-tooltip
   * condition (`tooltip.follow` defaulting to `false` on touch, docs/CHARTS-SPEC.md §4) — a follower's own
   * anchoring is unaffected, since a follower is never the one whose pointer set this flag.
   */
  isTouch: boolean
  onPointerMove: (event: PointerEvent<SVGRectElement>) => void
  /** Coarse-pointer equivalent of hover: resolves the nearest point and shows the tooltip
   * immediately, with no preceding `pointermove` — a plain tap otherwise fires only
   * `pointerdown`/`pointerup`. The press is PROVISIONAL: it shows the tooltip but does not commit a
   * pin, which only `onPointerUp` does. Also what MOVES an existing touch pin to a new tap elsewhere
   * in the same chart (fine pointers ignore it; `onPointerMove` already covers hover for them). */
  onPointerDown: (event: PointerEvent<SVGRectElement>) => void
  /** Commits the provisional touch press — the same `pointerId` as the matching `onPointerDown` —
   * so the pin survives the lift. A `pointerup` for any other pointer is ignored. */
  onPointerUp: (event: PointerEvent<SVGRectElement>) => void
  /** `pointerleave`/`pointercancel`, sharing one handler. A still-UNCOMMITTED touch press cancelled
   * here is the browser taking the gesture (a scroll) and clears; once committed, touch no-ops so a
   * stray `pointercancel` cannot undo the pin. A fine pointer always clears. */
  onPointerLeave: (event: PointerEvent<SVGRectElement>) => void
  onKeyDown: (event: KeyboardEvent<SVGRectElement>) => void
  onBlur: () => void
}

/**
 * Wires a chart into the ambient cursor store: snaps the pointer to the nearest own point,
 * broadcasts it, and reads back a sibling's broadcast through domain-aware resolution — automatic,
 * no `resolveKey` escape hatch.
 *
 * The tooltip anchor is coalesced through `requestAnimationFrame` (one local write per frame on a
 * fast scrub); the BROADCAST is deduped instead, so a within-bucket scrub costs nothing and a real
 * bucket change reaches siblings on the same tick.
 *
 * Touch model (`docs/CHARTS-SPEC.md` §4): a fine pointer keeps hovering. A coarse pointer
 * (`onPointerDown`) resolves and shows the tooltip immediately, drag-scrubs via `onPointerMove`,
 * and COMMITS a pin on `onPointerUp` — `onPointerLeave` (also wired to `pointercancel`) no-ops once
 * committed. A press the browser turns into a scroll clears instead. The pin moves on a fresh tap,
 * clears on a `document` tap outside `boundaryRef`, on any scroll, or on Escape.
 */
export function useChartCursor<T>({
  data,
  chartId,
  getKey,
  xScale,
  marginLeft,
  resolution = 'nearest',
  boundaryRef,
}: {
  data: readonly T[]
  chartId: string
  getKey: (d: T) => string
  /** Own x scale — maps a domain key to a plot-local x offset. */
  xScale: (key: string) => number | undefined
  marginLeft: number
  /**
   * How a sibling's broadcast key resolves against this chart's own points. Default `'nearest'`
   * (point domains). Pass `'leading'` when `getKey` returns a bucket's leading edge (a weekly
   * series keyed by its Monday, a monthly series keyed by its 1st) — see {@link CursorResolution}.
   */
  resolution?: CursorResolution
  /**
   * Element a touch tap OUTSIDE dismisses the pin against (`docs/CHARTS-SPEC.md` §4). One
   * capture-phase `document` `pointerdown` listener clears the pin when the target falls outside
   * this ref — added on pinning, removed on unpin/unmount. Omit to skip outside-dismiss (a tap
   * elsewhere in the chart and Escape still work); never throws for a missing ref.
   */
  boundaryRef?: RefObject<Element | null>
}): ChartCursor<T> {
  const store = useCursorStore()
  const cursor = useCursorState()
  const [anchor, setAnchor] = useState<CursorAnchor | null>(null)
  // Whether the interaction that most recently placed THIS chart's cursor was coarse (touch/pen).
  // Branched per EVENT (`event.pointerType`), never a static media query — a hybrid device can
  // carry both inputs, and a media query can't tell which one just fired.
  const [isTouch, setIsTouch] = useState(false)

  // Accessors read through refs so the pointer callbacks stay referentially stable: the natural
  // call style is an inline arrow, fresh every render, and re-creating these would re-bind the
  // overlay's listeners on every cursor frame in every sibling chart.
  const getKeyRef = useRef(getKey)
  getKeyRef.current = getKey
  const xScaleRef = useRef(xScale)
  xScaleRef.current = xScale

  const index = useMemo(
    () => buildDomainIndex(data, getKeyRef.current, resolution),
    [data, resolution],
  )
  // Mirrors `index`'s memo shape (deps built off `data`, reading the accessor through a ref) —
  // `resolution` is left out because `kind` never reads it, and `exhaustive-deps` enforces that.
  const kind = useMemo(() => classifyDomain(data.map((d) => getKeyRef.current(d))), [data])

  const frameRef = useRef<number | null>(null)
  const pendingRef = useRef<CursorAnchor | null>(null)
  // The `pointerId` of a coarse press that has shown the tooltip but not yet committed the pin
  // (`pointerup`). A `pointercancel`/`pointerleave` naming this pointer before it commits is the
  // browser taking the gesture — a scroll — and must clear rather than commit.
  const pressRef = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      // Release the shared cursor if this chart still owns it. Unmounting while hovered (a filter
      // drops the chart, a tab switches) fires no leave/blur, so the store would keep pointing at
      // a dead chartId — and any sibling whose domain resolves that stale key would paint a ghost
      // crosshair with no way to clear it. Same ownership guard as `clear()`.
      if (store.get().source === chartId) store.set(null, null, null)
    },
    [store, chartId],
  )

  const scheduleAnchor = useCallback((next: CursorAnchor) => {
    pendingRef.current = next
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      setAnchor(pendingRef.current)
    })
  }, [])

  // Shared by `onPointerMove` (fine-pointer hover) AND `onPointerDown` (the coarse-pointer tap that
  // has to resolve immediately, with no preceding move) — the nearest-point search plus the
  // broadcast, so the two paths cannot drift apart.
  const resolveToNearest = useCallback(
    (event: PointerEvent<SVGRectElement>) => {
      if (data.length === 0) return
      // Explicit reference node: `localPoint(event)` resolves it from `event.target`, which is the
      // overlay rect only while the overlay is genuinely the topmost hit element. Passing
      // `currentTarget` pins the coordinate space to the overlay regardless of what a kind draws
      // above it.
      const local = localPoint(event.currentTarget, event.nativeEvent)
      if (local === null) return
      const px = local.x - marginLeft

      let closest = data[0] as T
      let minDist = Infinity
      for (const d of data) {
        const x = xScaleRef.current(getKeyRef.current(d)) ?? 0
        const dist = Math.abs(x - px)
        if (dist < minDist) {
          minDist = dist
          closest = d
        }
      }

      setIsTouch(event.pointerType !== 'mouse')
      scheduleAnchor({ x: event.clientX, y: event.clientY })
      store.set(getKeyRef.current(closest), chartId, kind)
    },
    [data, marginLeft, chartId, store, scheduleAnchor, kind],
  )

  const onPointerMove = resolveToNearest
  // A tap fires `pointerdown` + `pointerup` with no `pointermove` in between, so hover's resolve
  // path never runs for it — this is what makes a tap show anything at all. It also MOVES an
  // existing touch pin: a fresh `pointerdown` elsewhere in the chart re-resolves and re-broadcasts
  // exactly like the first one, with nothing extra to wire.
  const onPointerDown = useCallback(
    (event: PointerEvent<SVGRectElement>) => {
      resolveToNearest(event)
      // A coarse press is PROVISIONAL: record the pointer so `onPointerUp` can commit the pin and a
      // `pointercancel`/`pointerleave` for the SAME still-uncommitted pointer can undo it. A fine
      // pointer never sets a press — its hover path has no pin to protect.
      if (event.pointerType !== 'mouse') pressRef.current = event.pointerId
    },
    [resolveToNearest],
  )
  // A completed tap: the pin is now committed, so `onPointerLeave`'s touch no-op keeps it past the
  // lift. Only the tracked pointer commits — a stray `pointerup` is ignored.
  const onPointerUp = useCallback((event: PointerEvent<SVGRectElement>) => {
    if (pressRef.current === event.pointerId) pressRef.current = null
  }, [])

  const clear = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    pendingRef.current = null
    pressRef.current = null
    setAnchor(null)
    // Only clear the SHARED cursor if this chart still owns it: moving fast from chart A to B lets
    // A's leave fire after B's move, and an unconditional clear would wipe B's cursor.
    if (store.get().source === chartId) store.set(null, null, null)
  }, [store, chartId])

  // `pointerleave`/`pointercancel` share this one handler (`HoverOverlay` wires both to `onLeave`).
  // A still-uncommitted touch press cancelled here is the browser taking the gesture (a scroll) and
  // clears. Once COMMITTED by touch it is a no-op — otherwise a stray `pointercancel` would undo the
  // pin the tap was meant to set. Escape's `clear()` in `onKeyDown` bypasses this guard entirely, by
  // design: it is the one dismissal that must work regardless of pointer type.
  const onPointerLeave = useCallback(
    (event: PointerEvent<SVGRectElement>) => {
      if (pressRef.current === event.pointerId) {
        clear()
        return
      }
      if (isTouch) return
      clear()
    },
    [isTouch, clear],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<SVGRectElement>) => {
      if (data.length === 0) return
      if (event.key === 'Escape') {
        clear()
        return
      }
      const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (delta === 0) return
      event.preventDefault()

      const current = store.get().key
      const currentIndex = data.findIndex((d) => getKeyRef.current(d) === current)
      const nextIndex = Math.min(
        Math.max((currentIndex === -1 ? (delta > 0 ? -1 : data.length) : currentIndex) + delta, 0),
        data.length - 1,
      )
      const next = data[nextIndex] as T
      const rect = event.currentTarget.getBoundingClientRect()
      const x = xScaleRef.current(getKeyRef.current(next)) ?? 0
      scheduleAnchor({ x: rect.left + x, y: rect.top })
      store.set(getKeyRef.current(next), chartId, kind)
    },
    [data, store, chartId, clear, scheduleAnchor, kind],
  )

  // A broadcast from a domain of a DIFFERENT kind is filtered out here, before resolution is even
  // attempted — a category chart never resolves a date chart's key just because both happen to
  // parse. `isSource` is unaffected: it compares `chartId`, not `kind`, and a chart's own broadcast
  // always carries its own kind by construction.
  const point =
    cursor.key === null || cursor.kind !== kind ? null : resolveCursorPoint(index, cursor.key)
  const isSource = cursor.source === chartId

  // Tap-outside dismissal (spec §5): while THIS chart is both pinned by touch and still the cursor's
  // source, one capture-phase `document` `pointerdown` listener clears it the moment the event
  // target falls outside `boundaryRef`. Gating on `isSource` (not `isTouch` alone) means the
  // listener follows the pin — a sibling chart stealing the source on its own touch tap detaches
  // this one instead of leaving a second stale listener alive. The same effect carries the two
  // other "the pin no longer points at anything" dismissals: a capture-phase `scroll` (a fixed
  // tooltip detaches from its chart) and a document-level `Escape`.
  useEffect(() => {
    if (!isTouch || !isSource || boundaryRef === undefined) return
    const onDocumentPointerDown = (event: globalThis.PointerEvent) => {
      const boundary = boundaryRef.current
      if (boundary !== null && event.target instanceof Node && boundary.contains(event.target)) {
        return
      }
      clear()
    }
    const onScroll = () => clear()
    const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') clear()
    }
    document.addEventListener('pointerdown', onDocumentPointerDown, true)
    document.addEventListener('scroll', onScroll, true)
    document.addEventListener('keydown', onDocumentKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onDocumentPointerDown, true)
      document.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('keydown', onDocumentKeyDown)
    }
  }, [isTouch, isSource, boundaryRef, clear])

  return {
    point,
    isSource,
    anchor,
    isTouch,
    onPointerMove,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    onKeyDown,
    onBlur: clear,
  }
}
