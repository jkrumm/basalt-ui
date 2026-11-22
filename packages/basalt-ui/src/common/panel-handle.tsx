/**
 * The width handle every side panel draws on its inner edge, and the hook that holds the width the
 * reader chose. Internal: `Peek`, `Dock`, `PageAside` and a right `Sheet` compose it.
 */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactElement, RefObject } from 'react'

const STEP = 16
const STEP_BIG = 64
/** The room a panel leaves when its `max-width` does not compute to px (a percentage). */
const ROOM = 48

export type PanelHandleProps = {
  /** The panel it resizes; its width is read from the box and its widest from the `max-width` it computes to. */
  panel: RefObject<HTMLElement | null>
  /** The narrowest the panel goes, in px. */
  min: number
  /** The panel's width in px when the pointer or a key changes it, `null` once it is back at the default. */
  onResize: (px: number | null) => void
  /** Called once the pointer is released or a key was pressed: the width to save, or null once it is back at the default. */
  onCommit: (px: number | null) => void
  label: string
  /** The handle's `data-slot`, where a panel already published one (`peek-handle`); every handle carries `data-panel="handle"`. */
  slot?: string | undefined
}

type Bounds = { now: number; max: number }

function readBounds(panel: HTMLElement, min: number): Bounds {
  const now = panel.getBoundingClientRect().width
  const raw = getComputedStyle(panel).maxWidth
  const max = raw.endsWith('px') ? parseFloat(raw) : window.innerWidth - ROOM
  return { now, max: Number.isFinite(max) ? Math.max(max, min) : now }
}

/**
 * The drag and keyboard handle on a side panel's start edge. A window splitter (`role="separator"`)
 * that moves the panel's one width: the pointer follows the edge, ArrowLeft widens and ArrowRight
 * narrows by 16px (64px with Shift), Home and End go to the narrowest and the widest, Enter and a
 * double click return to the default. The value is the panel's px width; the library-free
 * alternative to a split group, because a panel is laid over or beside the page and has no sibling
 * to trade space with.
 */
export function PanelHandle({
  panel,
  min,
  onResize,
  onCommit,
  label,
  slot,
}: PanelHandleProps): ReactElement {
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const drag = useRef<{ x: number; start: number; max: number; last: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  // Re-read whenever the panel's box changes: a drag, a key, the window, the content area. A passive
  // effect, because the panel's ref is attached after this child's layout effects have run.
  useEffect(() => {
    const el = panel.current
    if (el === null) return undefined
    const measure = (): void => setBounds(readBounds(el, min))
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [panel, min])

  const clamp = (px: number, max: number): number => Math.min(Math.max(px, min), max)
  const apply = (px: number, max: number): number => {
    const next = clamp(px, max)
    onResize(next)
    return next
  }

  const reset = (): void => {
    onResize(null)
    onCommit(null)
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>): void => {
    const el = panel.current
    if (e.button !== 0 || el === null) return
    const now = readBounds(el, min)
    drag.current = { x: e.clientX, start: now.now, max: now.max, last: now.now }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current
    if (d === null) return
    // The panel sits on the end edge: moving the pointer toward the start widens it.
    d.last = apply(d.start + (d.x - e.clientX), d.max)
  }
  const endDrag = (e: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current
    if (d === null) return
    drag.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    // A click that never moved the edge chose nothing: the width stays where it was.
    if (d.last !== d.start) onCommit(d.last)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const el = panel.current
    if (el === null) return
    const now = readBounds(el, min)
    const step = e.shiftKey ? STEP_BIG : STEP
    let next: number
    if (e.key === 'ArrowLeft') next = now.now + step
    else if (e.key === 'ArrowRight') next = now.now - step
    else if (e.key === 'Home') next = min
    else if (e.key === 'End') next = now.max
    else if (e.key === 'Enter') {
      e.preventDefault()
      reset()
      return
    } else return
    e.preventDefault()
    onCommit(apply(next, now.max))
  }

  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a focusable window splitter, which `hr` is not (ARIA APG)
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={bounds === null ? undefined : Math.round(bounds.max)}
      aria-valuenow={bounds === null ? undefined : Math.round(bounds.now)}
      tabIndex={0}
      data-slot={slot}
      data-panel="handle"
      data-dragging={dragging ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={reset}
      // The hairline shows on hover, keyboard focus and while dragging; the hit area is the full 8px.
      className="absolute inset-y-0 start-0 z-10 w-2 cursor-col-resize touch-none outline-none select-none after:absolute after:inset-y-0 after:start-0 after:w-px after:bg-transparent after:transition-colors hover:after:bg-border focus-visible:after:w-0.5 focus-visible:after:bg-brand data-dragging:after:w-0.5 data-dragging:after:bg-brand motion-reduce:after:transition-none"
    />
  )
}

/** A stored width: `persisted`'s shape, so this module imports nothing outside `common`. */
export type WidthStore = {
  use(): readonly [number | null, (next: number | null) => void]
}

export type PanelWidth = {
  /** The width in px the reader chose, or `null` for the panel's own default. */
  width: number | null
  /** The handle's `onResize`. */
  resize: (px: number | null) => void
  /** The handle's `onCommit`: stores the width and hands it to `onWidthChange`. */
  commit: (px: number | null) => void
}

const usable = (px: number | null | undefined, min: number): number | null =>
  px !== undefined && px !== null && Number.isFinite(px) ? Math.max(px, min) : null

/**
 * The width a panel draws at: what the reader is dragging, else what the app saved and passed back
 * (`saved`), else what the panel's store remembers for its kind, else `null` (the default).
 */
export function usePanelWidth({
  store,
  name,
  min,
  saved,
  onWidthChange,
}: {
  store: WidthStore
  /** The store's key: a width the reader is dragging belongs to it, and is dropped when it changes. */
  name: string
  min: number
  saved?: number | undefined
  onWidthChange?: ((px: number | null) => void) | undefined
}): PanelWidth {
  const [stored, setStored] = store.use()
  const [live, setLive] = useState<{ px: number | null; name: string } | null>(null)
  const own = live !== null && live.name === name ? live : null
  const width = own !== null ? usable(own.px, min) : (usable(saved, min) ?? usable(stored, min))
  return {
    width,
    resize: (px) => setLive({ px, name }),
    commit: (px) => {
      setLive({ px, name })
      setStored(px)
      onWidthChange?.(px)
    },
  }
}
