/**
 * The one panel anatomy `Peek`, `Dock`, `PageAside` and a right `Sheet` share: the class strings of
 * a header at the bar height (lead, title, tag, then the controls and close), a body that scrolls
 * and an optional footer band, and the width handle every side panel draws on its inner edge with
 * the hook that holds the width the reader chose. One module the `ui` and the `page` layers both
 * read, so an ejected `Sheet` resolves it from `basalt-ui/core/panel`.
 */
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactElement, RefObject } from 'react'

/**
 * The header row: under a shell with a page bar band the band's height (`--page-bar-h`, unset while
 * no band is mounted), so a side panel's hairline meets the band's, else 48px; the title's lead
 * inset, the controls' tighter end inset.
 */
export const PANEL_HEADER =
  'flex h-[var(--page-bar-h,3rem)] shrink-0 items-center gap-1 border-b border-border ps-4 pe-2 outline-none'

/** The record's heading in the header. */
export const PANEL_TITLE =
  'm-0 min-w-0 flex-1 truncate font-head text-sm font-semibold text-foreground'

/** The short mono tag before the title (`#12`). */
export const PANEL_TAG = 'shrink-0 font-mono text-xs text-muted-foreground'

/** The leading glyph or avatar's box, before the title. */
export const PANEL_LEAD = 'me-1 flex shrink-0 items-center text-muted-foreground'

/** The scrolling body. */
export const PANEL_BODY = 'min-h-0 flex-1 overscroll-contain p-4'

/** The footer band a form's actions sit in. */
export const PANEL_FOOTER =
  'flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-3'

/** The hairline between the record's actions and the presentation menu and close. */
export const PANEL_DIVIDER = 'mx-1 h-4 w-px shrink-0 bg-border'

/** The widest a side panel goes under a shell: never closer than 3rem to the rail. */
export const PANEL_MAX = 'calc(100vw - var(--shell-rail-w, 0px) - 3rem)'

const STEP = 16
const STEP_BIG = 64
/** The room a panel leaves when its `max-width` does not compute to px (a percentage). */
const ROOM = 48

/** The handle's box and hairline; `EDGE_CLASS` puts it on the panel's start or end edge, `TOP_CLASS` on a drawer's top. */
const HANDLE_CLASS =
  'absolute inset-y-0 z-10 w-2 cursor-col-resize touch-none select-none focus-ring focus-visible:-outline-offset-2 after:absolute after:inset-y-0 after:w-px after:bg-transparent after:transition-colors hover:after:bg-border data-dragging:after:w-0.5 data-dragging:after:bg-brand motion-reduce:after:transition-none'

const EDGE_CLASS = {
  start: `${HANDLE_CLASS} start-0 after:start-0`,
  // Centred on the column's hairline, so the list's own scrollbar stays clear of the hit area.
  end: `${HANDLE_CLASS} -end-1 after:start-1`,
  // A drawer's top edge: the same hairline turned a quarter, on a bar 8px tall that rows are never under.
  top: 'absolute inset-x-0 top-0 z-10 h-2 cursor-row-resize touch-none select-none focus-ring focus-visible:-outline-offset-2 after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-transparent after:transition-colors hover:after:bg-border data-dragging:after:h-0.5 data-dragging:after:bg-brand motion-reduce:after:transition-none',
} as const

export type PanelHandleProps = {
  /** The panel it resizes; its width is read from the box and its widest from the `max-width` it computes to. */
  panel: RefObject<HTMLElement | null>
  /** The narrowest the panel goes, in px (the shortest, for a `top` edge). */
  min: number
  /** The panel's width in px when the pointer or a key changes it, `null` once it is back at the default. */
  onResize: (px: number | null) => void
  /** Called once the pointer is released or a key was pressed: the width to save, or null once it is back at the default. */
  onCommit: (px: number | null) => void
  label: string
  /** The handle's `data-slot`, where a panel already published one (`peek-handle`); every handle carries `data-panel="handle"`. */
  slot?: string | undefined
  /** The edge the handle sits on: `start` for a side panel (the default), `end` for a column that widens toward its end, `top` for a bottom drawer that grows upward and moves its height. */
  edge?: 'start' | 'end' | 'top' | undefined
  /** The tallest a `top` drawer goes, in px, read at the moment it is asked: the room above its foot. */
  limit?: (() => number) | undefined
}

type Bounds = { now: number; max: number }

function readBounds(panel: HTMLElement, min: number, limit?: () => number): Bounds {
  if (limit !== undefined) {
    const height = panel.getBoundingClientRect().height
    return { now: height, max: Math.max(limit(), min) }
  }
  const now = panel.getBoundingClientRect().width
  const raw = getComputedStyle(panel).maxWidth
  const max = raw.endsWith('px') ? parseFloat(raw) : window.innerWidth - ROOM
  return { now, max: Number.isFinite(max) ? Math.max(max, min) : now }
}

/**
 * The drag and keyboard handle on a panel's edge: its start edge for a side panel, its end edge with
 * `edge="end"` for a list column. A window splitter (`role="separator"`) that moves the panel's one
 * width: the pointer follows the edge, and moving it outward from the panel widens it. The key that
 * widens is ArrowLeft on the start edge and ArrowRight on the end edge, the other narrows; each steps
 * 16px (64px with Shift). Home and End go to the narrowest and the widest, Enter and a double click
 * return to the default. The value is the panel's px width; the library-free alternative to a split
 * group, because a panel is laid over or beside the page and has no sibling to trade space with.
 */
export function PanelHandle({
  panel,
  min,
  onResize,
  onCommit,
  label,
  slot,
  edge = 'start',
  limit,
}: PanelHandleProps): ReactElement {
  const top = edge === 'top'
  // The latest `limit`, so an inline one does not restart the observer below on every render.
  const room = useRef(limit)
  useEffect(() => {
    room.current = limit
  })
  const read = (el: HTMLElement): Bounds => readBounds(el, min, top ? room.current : undefined)
  const [bounds, setBounds] = useState<Bounds | null>(null)
  const drag = useRef<{ x: number; start: number; max: number; last: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  // Re-read whenever the panel's box changes: a drag, a key, the window, the content area. A passive
  // effect, because the panel's ref is attached after this child's layout effects have run.
  useEffect(() => {
    const el = panel.current
    if (el === null) return undefined
    const measure = (): void => setBounds(readBounds(el, min, top ? room.current : undefined))
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [panel, min, top])

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
    const now = read(el)
    drag.current = { x: top ? e.clientY : e.clientX, start: now.now, max: now.max, last: now.now }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>): void => {
    const d = drag.current
    if (d === null) return
    const at = top ? e.clientY : e.clientX
    const outward = edge === 'end' ? at - d.x : d.x - at
    d.last = apply(d.start + outward, d.max)
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
    const now = read(el)
    const step = e.shiftKey ? STEP_BIG : STEP
    const widen = top ? 'ArrowUp' : edge === 'start' ? 'ArrowLeft' : 'ArrowRight'
    const narrow = top ? 'ArrowDown' : edge === 'start' ? 'ArrowRight' : 'ArrowLeft'
    let next: number
    if (e.key === widen) next = now.now + step
    else if (e.key === narrow) next = now.now - step
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
      aria-orientation={top ? 'horizontal' : 'vertical'}
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
      // The hairline shows on hover and while dragging, keyboard focus draws the shared ring inside the 8px
      // hit area, so a panel that clips its overflow keeps it whole.
      className={EDGE_CLASS[edge]}
    />
  )
}

/** A stored width: `persisted`'s shape, so this module imports nothing but React. */
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
