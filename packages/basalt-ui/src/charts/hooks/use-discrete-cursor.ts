import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type {
  KeyboardEventHandler,
  PointerEvent as ReactPointerEvent,
  PointerEventHandler,
} from 'react'
import { useDismissOnOutside, useTouchPin } from '../cursor/touch-pin'

/** A discrete target plus the viewport-space point its tooltip anchors to. */
export type DiscreteCursorTip<T> = { target: T; anchor: { x: number; y: number } }

type ActiveState = { key: string; anchor: { x: number; y: number } }

export type UseDiscreteCursorResult<T> = {
  /** The target whose tooltip should render, resolved from whichever mode last set it (hover, a
   * touch pin, or keyboard focus). `null` when nothing is active. */
  tip: DiscreteCursorTip<T> | null
  /** True once a coarse-pointer tap has PINNED `tip` open (survives pointer lift). */
  isPinned: boolean
  /** Pointer handlers for one target's shape — spread onto its `<g>`/`<rect>`. Fine pointers
   * (mouse/pen) hover; a coarse pointer (touch) pins on `pointerdown` instead. */
  pointerProps: (t: T) => {
    onPointerEnter: PointerEventHandler<Element>
    onPointerMove: PointerEventHandler<Element>
    onPointerDown: PointerEventHandler<Element>
    onPointerUp: PointerEventHandler<Element>
    onPointerLeave: PointerEventHandler<Element>
    onPointerCancel: PointerEventHandler<Element>
  }
  /** DOM id for a target's `role="option"` element — also `aria-activedescendant`'s value while
   * that target is active. Spread `id={optionId(t)}` on the same node that gets `pointerProps`. */
  optionId: (t: T) => string
  /** Dismisses a pin and clears keyboard focus. Already wired to Escape and an outside tap while
   * pinned; call it directly for anything else that should close the tooltip (e.g. data changing
   * out from under the focused key). */
  clear: () => void
  /** Spread on the ONE shared, focusable host (the chart's `<svg>`). */
  hostProps: {
    ref: (node: Element | null) => void
    tabIndex: 0
    role: 'listbox'
    'aria-label': string
    'aria-activedescendant': string | undefined
    onKeyDown: KeyboardEventHandler<Element>
    onBlur: () => void
  }
}

/**
 * Keyboard + focus + tap parity for a DISCRETE set of targets (donut slices, heatmap cells) — the
 * counterpart `HoverOverlay` gives a continuous cartesian domain (`docs/CHARTS-SPEC.md` §4).
 *
 * **Role choice**: `listbox`/`option` (WAI-ARIA APG "Listbox"), not `slider`. A cartesian domain is
 * one continuous value; a donut slice or heatmap cell is a named choice among discrete siblings.
 * `aria-activedescendant` announces the focused option's id while DOM focus stays on the one host.
 *
 * Three input modes converge on one `tip`: hover (fine pointer, ephemeral), a provisional tap that
 * `pointerup` commits into a pin (a `pointercancel` first — a scroll — clears it), and keyboard
 * stepping on the one focusable host (`columns` maps Up/Down to a full-row jump for a 2D grid;
 * Left/Right always step by one). Keyboard focus anchors the tooltip to the host's center — an
 * accepted simplification; the value still reaches a screen reader via the option's text.
 */
export function useDiscreteCursor<T>({
  targets,
  getKey,
  columns,
  ariaLabel = 'Chart data — use arrow keys to navigate, Escape to dismiss',
}: {
  targets: readonly T[]
  getKey: (t: T) => string
  /** Row width for a 2D grid — see the Up/Down mapping above. Omit for a 1D ring. */
  columns?: number
  /** Accessible name for the shared listbox host. */
  ariaLabel?: string
}): UseDiscreteCursorResult<T> {
  const [active, setActive] = useState<ActiveState | null>(null)
  const [pinned, setPinned] = useState(false)
  const hostElRef = useRef<Element | null>(null)
  const idPrefix = useId()

  // Mirrors `active`/`pinned` so the provisional-press machine below can read the CURRENT committed
  // value synchronously from an event handler, without either living in a ref of its own.
  const activeRef = useRef(active)
  activeRef.current = active
  const pinnedRef = useRef(pinned)
  pinnedRef.current = pinned

  // Read through refs so a keypress or an outside tap arriving between renders (the two
  // `document`-level listeners below) always sees the LATEST list/accessor, not the ones closed
  // over when the effect was installed — `targets` and `columns` can both change every render (a
  // filtered dataset, a resize).
  const targetsRef = useRef(targets)
  targetsRef.current = targets
  const getKeyRef = useRef(getKey)
  getKeyRef.current = getKey
  const columnsRef = useRef(columns)
  columnsRef.current = columns

  // `pointermove`/`pointerenter` flood far faster than one `setActive` is worth on a fast scrub
  // across many targets — coalesced to one commit per animation frame, the same treatment
  // `useChartCursor`'s own hover path gives its (costlier) nearest-point search. Cancelled on
  // unmount and in `clear()` — which `onPointerLeave`/`onPointerCancel` below also route through —
  // so a frame already in flight cannot resurrect a hover the clear just dismissed.
  const moveFrameRef = useRef<number | null>(null)
  const pendingActiveRef = useRef<ActiveState | null>(null)
  useEffect(
    () => () => {
      if (moveFrameRef.current !== null) cancelAnimationFrame(moveFrameRef.current)
    },
    [],
  )
  const scheduleActive = useCallback((next: ActiveState) => {
    pendingActiveRef.current = next
    if (moveFrameRef.current !== null) return
    moveFrameRef.current = requestAnimationFrame(() => {
      moveFrameRef.current = null
      setActive(pendingActiveRef.current)
    })
  }, [])

  // Cancels a hover frame already in flight and clears what it was about to commit — called by
  // every SYNCHRONOUS writer of `active` (a touch press, a keyboard step, `clear()` itself) before
  // it writes. Without this, a `pointermove` scheduled a tick earlier (coalesced onto
  // `moveFrameRef`/`pendingActiveRef`, per `scheduleActive` above) is still in flight when one of
  // those writes lands, and the frame fires a moment later and overwrites it right back with the
  // stale hover target — the keyboard/touch target "reverts" to whatever was last hovered.
  const cancelPendingFrame = useCallback(() => {
    if (moveFrameRef.current !== null) {
      cancelAnimationFrame(moveFrameRef.current)
      moveFrameRef.current = null
    }
    pendingActiveRef.current = null
  }, [])

  // The provisional-press commit/revert machine (`docs/CHARTS-SPEC.md` §4) — shared with
  // `useChartCursor`. The committed value IS `active` whenever `pinned` is true — there is no
  // separate ref to keep in sync, `pinnedRef`/`activeRef` above already mirror both.
  const touchPin = useTouchPin<ActiveState | null>({
    getCommitted: () => (pinnedRef.current ? activeRef.current : null),
    setCommitted: (value) => {
      setActive(value)
      setPinned(value !== null)
    },
  })

  const clear = useCallback(() => {
    cancelPendingFrame()
    touchPin.reset()
    setActive(null)
    setPinned(false)
  }, [touchPin, cancelPendingFrame])

  // Coarse-pointer pin dismissal that can't be expressed as a per-target handler: a tap OUTSIDE
  // the host, or Escape, from anywhere on the page. A tap landing back INSIDE the host is handled
  // by the per-target `onPointerDown` in `pointerProps` instead (it MOVES the pin), so this
  // listener only ever fires for the "elsewhere" case — same shape as `ChartLegend`'s disclosure
  // dismissal. Shared with `useChartCursor` (`touch-pin.ts`).
  const isInsideHost = useCallback(
    (target: Node): boolean => hostElRef.current?.contains(target) === true,
    [],
  )
  useDismissOnOutside({ enabled: pinned, isInside: isInsideHost, onDismiss: clear })

  // Index in `targetsRef`, NOT the key: Heatmap's `cellKey` joins cells with `\u0000`, which would
  // leak a NUL into a DOM id, and an id has to be a valid DOM token. Resolved by KEY, not reference:
  // Heatmap builds a fresh `{ row, col, value }` object per cell render, so a reference lookup always
  // misses. A `Map` built once per `targets` change keeps `optionId` O(1) on the render loop the
  // touch-scrub path re-runs every frame.
  const indexByKey = useMemo(() => {
    const map = new Map<string, number>()
    targets.forEach((t, i) => map.set(getKeyRef.current(t), i))
    return map
  }, [targets])
  const optionId = useCallback(
    (t: T): string => `${idPrefix}-${indexByKey.get(getKeyRef.current(t)) ?? -1}`,
    [idPrefix, indexByKey],
  )

  // O(1) via `indexByKey` rather than a fresh scan — the same Map `optionId` already builds.
  const findTarget = (key: string): T | undefined => {
    const index = indexByKey.get(key)
    return index === undefined ? undefined : targetsRef.current[index]
  }

  const pointerProps = (t: T): ReturnType<UseDiscreteCursorResult<T>['pointerProps']> => {
    const key = getKeyRef.current(t)
    const showAt = (event: ReactPointerEvent<Element>): void => {
      scheduleActive({ key, anchor: { x: event.clientX, y: event.clientY } })
    }
    // Shared by `onPointerLeave` and `onPointerCancel`: a still-UNCOMMITTED press ending here is the
    // browser taking the gesture (a scroll) — `touchPin.cancel` restores whatever was COMMITTED
    // before this press started (or leaves it clear when nothing was), regardless of `pinned`. The
    // two used to diverge (`onPointerCancel` checked this, `onPointerLeave` didn't), which left a
    // stale press and a stuck readout on the leave-before-cancel ordering a scroll off a small hit
    // target commonly produces.
    const cancelIfUncommitted = (event: ReactPointerEvent<Element>): boolean =>
      touchPin.cancel(event.pointerId)
    // `pointerType !== 'mouse'` throughout (never `=== 'touch'`), matching `useChartCursor` —
    // pen counts as coarse too, so a stylus tap gets the same pin-until-dismiss contract a finger
    // does, not the fine-pointer hover path.
    return {
      onPointerEnter: (event) => {
        // Guarded on `pinned`, not just pointer type: while a touch tap has pinned a DIFFERENT
        // target, a stray mouse hover elsewhere (a hybrid touchscreen + mouse device) must not
        // silently steal `active` out from under the pin — it would leave that new hover's
        // tooltip stuck on lift, since leave/cancel below still see `pinned` and no-op.
        if (event.pointerType !== 'mouse' || pinned) return
        showAt(event)
      },
      onPointerMove: (event) => {
        if (event.pointerType !== 'mouse' || pinned) return
        showAt(event)
      },
      // Only a coarse pointer presses — a fine pointer's `down` is a no-op, it already shows via
      // enter/move above. The press is PROVISIONAL: it snapshots whatever is committed now (so a
      // cancel can restore it) BEFORE showing the readout, which only `onPointerUp` commits. On
      // touch the readout anchors to the HOST's top edge rather than the finger, which would cover
      // it; a missing host falls back to the pointer.
      onPointerDown: (event) => {
        if (event.pointerType === 'mouse') return
        touchPin.begin(event.pointerId)
        // A hover frame scheduled just before this press (e.g. a hybrid touch+mouse device) must
        // not be allowed to land after this — see `cancelPendingFrame`'s own doc.
        cancelPendingFrame()
        const rect = hostElRef.current?.getBoundingClientRect()
        setActive({
          key,
          anchor:
            rect === undefined
              ? { x: event.clientX, y: event.clientY }
              : { x: rect.left + rect.width / 2, y: rect.top },
        })
      },
      // A completed tap commits the pin. Only the tracked pointer commits — and only a coarse one:
      // some browsers assign a touch's `pointerId` the same value (1) mouse pointers use, so a
      // `pointerType` check keeps an unrelated mouse `pointerup` reusing that id from committing an
      // abandoned touch press.
      onPointerUp: (event) => {
        if (event.pointerType === 'mouse') return
        if (!touchPin.commit(event.pointerId)) return
        setPinned(true)
      },
      // A still-uncommitted press ending here is the browser taking the gesture (a scroll); clear it
      // regardless of `pinned`. Otherwise keep the fine-pointer/pinned guard. Routes through the
      // same `clear()` the outside-tap/Escape dismissal uses (mirrors `useChartCursor`'s own
      // `onPointerLeave`) rather than a bare `setActive(null)` — a `pointermove` scheduled just
      // before this event fires is still in flight (coalesced onto `moveFrameRef`/
      // `pendingActiveRef`), and only `clear()` cancels it. A bare `setActive(null)` left that frame
      // free to land a tick later and resurrect the tooltip this leave/cancel was meant to dismiss.
      onPointerLeave: (event) => {
        if (cancelIfUncommitted(event)) return
        if (event.pointerType !== 'mouse' || pinned) return
        clear()
      },
      onPointerCancel: (event) => {
        if (cancelIfUncommitted(event)) return
        if (event.pointerType !== 'mouse' || pinned) return
        clear()
      },
    }
  }

  const onKeyDown: KeyboardEventHandler<Element> = (event) => {
    const list = targetsRef.current
    if (list.length === 0) return
    if (event.key === 'Escape') {
      clear()
      return
    }
    const cols = columnsRef.current
    let delta = 0
    switch (event.key) {
      case 'ArrowRight':
        delta = 1
        break
      case 'ArrowLeft':
        delta = -1
        break
      case 'ArrowDown':
        delta = cols ?? 1
        break
      case 'ArrowUp':
        delta = -(cols ?? 1)
        break
      default:
        return
    }
    event.preventDefault()

    const currentIndex =
      active === null ? -1 : list.findIndex((t) => getKeyRef.current(t) === active.key)
    // Mirrors `useChartCursor`'s onKeyDown: no current focus starts one step before/after the
    // domain edge, so the first arrow press lands on the first or last target.
    const base = currentIndex === -1 ? (delta > 0 ? -1 : list.length) : currentIndex
    const nextIndex = Math.min(Math.max(base + delta, 0), list.length - 1)
    const next = list[nextIndex] as T

    const rect = hostElRef.current?.getBoundingClientRect()
    const anchor =
      rect === undefined
        ? { x: 0, y: 0 }
        : { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    // A hover frame scheduled just before this keypress must not be allowed to land after this —
    // see `cancelPendingFrame`'s own doc.
    cancelPendingFrame()
    setActive({ key: getKeyRef.current(next), anchor })
  }

  const tip: DiscreteCursorTip<T> | null = (() => {
    if (active === null) return null
    const target = findTarget(active.key)
    return target === undefined ? null : { target, anchor: active.anchor }
  })()

  return {
    tip,
    isPinned: pinned,
    pointerProps,
    optionId,
    clear,
    hostProps: {
      ref: (node) => {
        hostElRef.current = node
      },
      tabIndex: 0,
      role: 'listbox',
      'aria-label': ariaLabel,
      'aria-activedescendant': tip === null ? undefined : optionId(tip.target),
      onKeyDown,
      onBlur: () => {
        if (!pinned) clear()
      },
    },
  }
}
