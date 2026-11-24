/**
 * The rail's width handle, on its inner edge: a window splitter (`role="separator"`) whose value is
 * the open rail's width in px. The pointer follows the edge; ArrowLeft and ArrowRight move it 16 px
 * (64 with Shift) toward narrower and wider as the reading direction says; Home and End go to the
 * bounds; a double click or Enter returns to the default. Hidden once the rail is collapsed, absent
 * where there is no width control (a rail drawn alone) and where the rail is not drawn (compact).
 */
import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactElement } from 'react'
import { cn } from '../../core/cn'
import { RAIL_EXPANDED_PX, useRailWidth } from './grid'
import { RAIL_TEXT } from './rail-text'

const STEP = 16
const STEP_BIG = 64

const direction = (el: HTMLElement): 1 | -1 => (getComputedStyle(el).direction === 'rtl' ? -1 : 1)

export function RailResizeHandle(): ReactElement | null {
  const control = useRailWidth()
  const drag = useRef<{ x: number; start: number; dir: 1 | -1 } | null>(null)
  const [dragging, setDragging] = useState(false)
  if (control === null) return null
  const { width, min, max, setWidth, reset } = control

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    drag.current = { x: event.clientX, start: width, dir: direction(event.currentTarget) }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current
    if (d === null) return
    setWidth(d.start + (event.clientX - d.x) * d.dir)
  }
  const endDrag = (event: PointerEvent<HTMLDivElement>): void => {
    if (drag.current === null) return
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? STEP_BIG : STEP
    const dir = direction(event.currentTarget)
    const next: number | undefined = {
      ArrowRight: width + step * dir,
      ArrowLeft: width - step * dir,
      Home: min,
      End: max,
    }[event.key]
    if (event.key === 'Enter') {
      event.preventDefault()
      reset()
      return
    }
    if (next === undefined) return
    event.preventDefault()
    setWidth(next)
  }

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a window splitter is interactive: it takes focus, the pointer and the arrow keys
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a window splitter is a focusable separator with a value; `hr` is neither
      role="separator"
      aria-orientation="vertical"
      aria-label={RAIL_TEXT.resize}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width}
      tabIndex={0}
      data-slot="shell-rail-resize"
      data-dragging={dragging ? '' : undefined}
      data-default={width === RAIL_EXPANDED_PX ? '' : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      onDoubleClick={reset}
      className={cn(
        'group/resize absolute inset-y-0 end-0 z-20 flex w-2 cursor-ew-resize touch-none justify-end focus-ring focus-visible:-outline-offset-2 @max-[120px]:hidden',
        'focus-visible:[&>span]:bg-brand data-dragging:[&>span]:bg-brand hover:[&>span]:bg-brand',
      )}
    >
      <span
        aria-hidden="true"
        className="h-full w-px bg-transparent transition-colors motion-reduce:transition-none"
      />
    </div>
  )
}
