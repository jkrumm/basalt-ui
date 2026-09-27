import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type {
  KeyboardEventHandler,
  PointerEvent as ReactPointerEvent,
  PointerEventHandler,
} from 'react'

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
 * counterpart `HoverOverlay` gives a continuous cartesian domain
 * (`docs/waves/RESPONSIVE-SPEC.md` §5).
 *
 * **Role choice**: `listbox`/`option` (WAI-ARIA APG "Listbox"), not `slider`. `HoverOverlay` uses
 * `role="slider"` because a cartesian domain IS one continuous value with a min/max; a donut slice
 * or a heatmap cell is a NAMED choice among many discrete siblings, which is exactly what a listbox
 * models. `aria-activedescendant` announces the focused option's id while DOM focus stays on the
 * one host — no per-shape `tabIndex`, matching `HoverOverlay`'s one-focusable-node shape.
 *
 * Three input modes converge on one `tip`:
 * - **Fine pointer** (mouse/pen): hover shows the tooltip, ephemeral — clears on pointer leave,
 *   unchanged from today's per-arc/per-cell handlers.
 * - **Coarse pointer** (touch): `pointerdown` shows AND PINS it. A pin survives lift, a tap on a
 *   different target moves it, and it's dismissed by a tap outside the host or Escape — the same
 *   pin-until-dismiss contract the cartesian kinds use for a scrub.
 * - **Keyboard**: the host is the one focusable node; arrow keys step `targets` by index and
 *   Escape clears (same key `HoverOverlay` uses). `columns`, when given, maps Up/Down to a
 *   full-row jump (`±columns`) so a 2D grid (Heatmap, row-major `targets`) gets real row/column
 *   movement over one flat list; Left/Right always step by one. Omitted (Donut's single ring),
 *   every arrow steps by one — Up/Down and Left/Right are equivalent.
 *
 * Keyboard focus has no pointer coordinate to anchor a tooltip at, so it anchors to the HOST's own
 * bounding-box center — an accepted simplification (exact per-arc/per-cell geometry would need
 * each kind to hand this hook a screen-space centroid resolver for one extra pixel of polish); the
 * value itself still reaches a screen reader via the option's accessible text.
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

  const clear = useCallback(() => {
    setActive(null)
    setPinned(false)
  }, [])

  // Coarse-pointer pin dismissal that can't be expressed as a per-target handler: a tap OUTSIDE
  // the host, or Escape, from anywhere on the page. A tap landing back INSIDE the host is handled
  // by the per-target `onPointerDown` in `pointerProps` instead (it MOVES the pin), so this
  // listener only ever fires for the "elsewhere" case — same shape as `ChartLegend`'s disclosure
  // dismissal.
  useEffect(() => {
    if (!pinned) return
    const onDocPointerDown = (event: PointerEvent): void => {
      const host = hostElRef.current
      if (host !== null && event.target instanceof Node && host.contains(event.target)) return
      clear()
    }
    const onDocKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') clear()
    }
    // Capture phase, matching `useChartCursor`'s equivalent listener: a bubble-phase listener
    // would never fire if some ancestor between the tapped element and `document` calls
    // `stopPropagation()` on its own `pointerdown` handler (e.g. a Mantine overlay elsewhere on
    // the page), leaving the pin stuck with no way to dismiss it via an outside tap.
    document.addEventListener('pointerdown', onDocPointerDown, true)
    document.addEventListener('keydown', onDocKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true)
      document.removeEventListener('keydown', onDocKeyDown)
    }
  }, [pinned, clear])

  const optionId = useCallback(
    (t: T): string => `${idPrefix}-${getKeyRef.current(t).replace(/\s+/g, '_')}`,
    [idPrefix],
  )

  const findTarget = (key: string): T | undefined =>
    targetsRef.current.find((t) => getKeyRef.current(t) === key)

  const pointerProps = (t: T): ReturnType<UseDiscreteCursorResult<T>['pointerProps']> => {
    const key = getKeyRef.current(t)
    const showAt = (event: ReactPointerEvent<Element>): void => {
      setActive({ key, anchor: { x: event.clientX, y: event.clientY } })
    }
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
      // Only a coarse pointer pins — a fine pointer's `down` is a no-op, it already shows via
      // enter/move above.
      onPointerDown: (event) => {
        if (event.pointerType === 'mouse') return
        setPinned(true)
        showAt(event)
      },
      onPointerLeave: (event) => {
        if (event.pointerType !== 'mouse' || pinned) return
        setActive(null)
      },
      onPointerCancel: (event) => {
        if (event.pointerType !== 'mouse' || pinned) return
        setActive(null)
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
