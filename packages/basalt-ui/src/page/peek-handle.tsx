import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactElement, RefObject } from 'react'
import { cn } from '../core/cn'

/** The narrowest a peek goes: wide enough for a record's header and a line of body. */
export const PEEK_MIN = 384
const STEP = 16
const STEP_BIG = 64

export type PeekHandleProps = {
  /** The panel it resizes; its width is read from the box and its widest from the `max-width` it computes to. */
  panel: RefObject<HTMLElement | null>
  /** The panel's width in px when the pointer or a key changes it, and on every key press. */
  onResize: (px: number | null) => void
  /** Called once the pointer is released or a key was pressed: the width to save, or null once it is back at the default. */
  onCommit: (px: number | null) => void
  label: string
}

type Bounds = { now: number; max: number }

function readBounds(panel: HTMLElement): Bounds {
  const now = panel.getBoundingClientRect().width
  const max = parseFloat(getComputedStyle(panel).maxWidth)
  return { now, max: Number.isFinite(max) ? Math.max(max, PEEK_MIN) : now }
}

function clamp(px: number, max: number): number {
  return Math.min(Math.max(px, PEEK_MIN), max)
}

/**
 * The drag and keyboard handle on a `Peek`'s start edge. A window splitter (`role="separator"`) that
 * moves the panel's one width: the pointer follows the edge, ArrowLeft widens and ArrowRight narrows
 * by 16px (64px with Shift), Home and End go to the narrowest and the widest, Enter and a double
 * click return to the default. The value is the panel's px width; the library-free alternative to a
 * split group, because a peek is laid over the page and has no sibling to trade space with.
 */
export function PeekHandle({ panel, onResize, onCommit, label }: PeekHandleProps): ReactElement {
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const drag = useRef<{ x: number; start: number; max: number; last: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  // Re-read whenever the panel's box changes: a drag, a key, the window, the content area. A passive
  // effect, because the panel's ref is attached after this child's layout effects have run.
  useEffect(() => {
    const el = panel.current
    if (el === null) return undefined
    const measure = (): void => setBounds(readBounds(el))
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [panel])

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
    const now = readBounds(el)
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
    // A click that never moved the edge chose nothing: the width stays the responsive default.
    if (d.last !== d.start) onCommit(d.last)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const el = panel.current
    if (el === null) return
    const now = readBounds(el)
    const step = e.shiftKey ? STEP_BIG : STEP
    let next: number
    if (e.key === 'ArrowLeft') next = now.now + step
    else if (e.key === 'ArrowRight') next = now.now - step
    else if (e.key === 'Home') next = PEEK_MIN
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
      aria-valuemin={PEEK_MIN}
      aria-valuemax={bounds === null ? undefined : Math.round(bounds.max)}
      aria-valuenow={bounds === null ? undefined : Math.round(bounds.now)}
      tabIndex={0}
      data-slot="peek-handle"
      data-dragging={dragging ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={reset}
      className={cn(
        'absolute inset-y-0 start-0 z-10 w-2 cursor-col-resize touch-none outline-none select-none',
        // The hairline shows on hover, keyboard focus and while dragging; the hit area is the full 8px.
        'after:absolute after:inset-y-0 after:start-0 after:w-px after:bg-transparent after:transition-colors motion-reduce:after:transition-none',
        'hover:after:bg-border focus-visible:after:w-0.5 focus-visible:after:bg-brand data-dragging:after:w-0.5 data-dragging:after:bg-brand',
      )}
    />
  )
}
