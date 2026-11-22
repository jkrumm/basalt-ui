/**
 * The `window` presentation of a `Peek`: a floating, non-modal box over the page that the reader
 * drags by its header and resizes from its edges and corners, and the chip it minimises to in the
 * corner. Internal: `Peek` owns the record, the header and the keys.
 */
import { useState } from 'react'
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent,
  ReactElement,
  ReactNode,
  Ref,
} from 'react'
import { cn } from '../core/cn'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'
import { Button } from '../ui/button'
import { windowStore } from './core/panel-store'
import type { WindowSize } from './core/panel-store'

/** The narrowest and the lowest a window goes: a header and a few lines of body. */
const MIN_W = 360
const MIN_H = 240
/** The size a window opens at before the reader resized one of its kind: 48 by 44rem, at most the viewport less 4rem. */
const OPEN_W = 768
const OPEN_H = 704
const ROOM = 64
/** How much of a dragged window stays on screen, so its header can always be grabbed again. */
const KEEP = 120

type Rect = { x: number; y: number; w: number; h: number }

type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

const EDGES: readonly Edge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

/** Each edge's hit strip: 8px wide on a side, 12px square on a corner. */
const EDGE_CLASS: Record<Edge, string> = {
  n: 'inset-x-3 top-0 h-2 cursor-ns-resize',
  s: 'inset-x-3 bottom-0 h-2 cursor-ns-resize',
  e: 'inset-y-3 end-0 w-2 cursor-ew-resize',
  w: 'inset-y-3 start-0 w-2 cursor-ew-resize',
  ne: 'end-0 top-0 size-3 cursor-nesw-resize',
  nw: 'start-0 top-0 size-3 cursor-nwse-resize',
  se: 'end-0 bottom-0 size-3 cursor-nwse-resize',
  sw: 'start-0 bottom-0 size-3 cursor-nesw-resize',
}

type WindowStyle = CSSProperties & {
  '--win-x': string
  '--win-y': string
  '--win-w': string
  '--win-h': string
}

function viewport(): { vw: number; vh: number } {
  return typeof window === 'undefined'
    ? { vw: OPEN_W + ROOM, vh: OPEN_H + ROOM }
    : { vw: window.innerWidth, vh: window.innerHeight }
}

/** A window of `size` centred in the viewport, no bigger than it less its room. */
function opening(size: WindowSize | null): Rect {
  const { vw, vh } = viewport()
  const w = Math.max(MIN_W, Math.min(size?.w ?? OPEN_W, vw - ROOM))
  const h = Math.max(MIN_H, Math.min(size?.h ?? OPEN_H, vh - ROOM))
  return { x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), w, h }
}

/** Keeps the header on screen. */
function placed(rect: Rect): Rect {
  const { vw, vh } = viewport()
  return {
    ...rect,
    x: Math.min(Math.max(rect.x, KEEP - rect.w), vw - KEEP),
    y: Math.min(Math.max(rect.y, 0), vh - KEEP / 2),
  }
}

/** The rect after the pointer moved `dx`, `dy` from where it took `edge`. */
function resized(start: Rect, edge: Edge, dx: number, dy: number): Rect {
  let { x, y, w, h } = start
  if (edge.includes('e')) w = Math.max(MIN_W, start.w + dx)
  if (edge.includes('s')) h = Math.max(MIN_H, start.h + dy)
  if (edge.includes('w')) {
    w = Math.max(MIN_W, start.w - dx)
    x = start.x + start.w - w
  }
  if (edge.includes('n')) {
    h = Math.max(MIN_H, start.h - dy)
    y = start.y + start.h - h
  }
  return { x, y, w, h }
}

/** Follows the pointer on the window until it is released; `done` gets the last rect. */
function track(
  event: PointerEvent<HTMLElement>,
  start: Rect,
  next: (dx: number, dy: number) => Rect,
  set: (rect: Rect) => void,
  done?: (rect: Rect) => void,
): void {
  event.preventDefault()
  const x0 = event.clientX
  const y0 = event.clientY
  let last = start
  const move = (e: globalThis.PointerEvent): void => {
    last = next(e.clientX - x0, e.clientY - y0)
    set(last)
  }
  const up = (): void => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    done?.(last)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

/** A press on the header's own controls is theirs, not a drag. */
const CONTROL = 'button, a, input, select, textarea, [role="separator"], [role="menuitem"]'

export type PeekWindowProps = {
  kind: string
  title: string
  panelRef: Ref<HTMLDialogElement>
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  /** Draws the header; the window hands it the drag. */
  header: (drag: (event: PointerEvent<HTMLElement>) => void) => ReactNode
  children: ReactNode
}

/**
 * The window: `<dialog open>` (not modal: no scrim, nothing inert), fixed over the page above every
 * shell panel and below a dialog. The header drags it and keeps it on screen; eight handles resize
 * it down to 360 by 240 px, and the size is remembered per record kind.
 */
export function PeekWindow({
  kind,
  title,
  panelRef,
  onKeyDown,
  header,
  children,
}: PeekWindowProps): ReactElement {
  const store = windowStore(kind)
  const [rect, setRect] = useState<Rect>(() => opening(store.get()))
  const style: WindowStyle = {
    '--win-x': `${rect.x}px`,
    '--win-y': `${rect.y}px`,
    '--win-w': `${rect.w}px`,
    '--win-h': `${rect.h}px`,
  }
  const drag = (event: PointerEvent<HTMLElement>): void => {
    if (event.button !== 0) return
    if (event.target instanceof Element && event.target.closest(CONTROL) !== null) return
    track(event, rect, (dx, dy) => placed({ ...rect, x: rect.x + dx, y: rect.y + dy }), setRect)
  }
  const resize = (edge: Edge) => (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    track(
      event,
      rect,
      (dx, dy) => resized(rect, edge, dx, dy),
      setRect,
      (last) => {
        // A press that never moved the edge chose no size.
        if (last.w !== rect.w || last.h !== rect.h) store.set({ w: last.w, h: last.h })
      },
    )
  }
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape and the step keys bubble from the controls inside; the window itself takes no input
    <dialog
      ref={panelRef}
      open
      aria-label={title}
      tabIndex={-1}
      data-slot="peek"
      data-present="window"
      onKeyDown={onKeyDown}
      style={style}
      className={cn(
        'fixed start-(--win-x) top-(--win-y) z-40 m-0 flex h-(--win-h) max-h-none w-(--win-w) max-w-none flex-col overflow-hidden',
        'rounded-card border border-border bg-popover p-0 text-popover-foreground shadow-overlay outline-none',
        'transition-[translate,opacity] duration-slow ease-standard starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none',
        '[&>header]:cursor-grab [&>header]:select-none',
      )}
    >
      {header(drag)}
      {children}
      {EDGES.map((edge) => (
        <div
          key={edge}
          aria-hidden="true"
          data-panel="window-edge"
          data-edge={edge}
          onPointerDown={resize(edge)}
          className={cn('absolute z-10 touch-none', EDGE_CLASS[edge])}
        />
      ))}
    </dialog>
  )
}

export type PeekChipProps = {
  title: string
  tag?: string | undefined
  chipRef: Ref<HTMLElement>
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  onRestore: () => void
  onClose: () => void
}

/** The minimised window: a chip in the end corner with the title, restore and close. */
export function PeekChip({
  title,
  tag,
  chipRef,
  onKeyDown,
  onRestore,
  onClose,
}: PeekChipProps): ReactElement {
  const t = useMessages(page)
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape bubbles from its two buttons; the chip itself takes no input
    <section
      ref={chipRef}
      aria-label={title}
      tabIndex={-1}
      data-slot="peek"
      data-present="chip"
      onKeyDown={onKeyDown}
      className={cn(
        'fixed end-4 bottom-4 z-40 flex h-12 w-80 max-w-[calc(100vw-2rem)] items-center gap-1 ps-4 pe-2',
        'rounded-card border border-border bg-popover text-popover-foreground shadow-overlay outline-none',
        'transition-[translate,opacity] duration-slow ease-standard starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none',
      )}
    >
      {tag !== undefined && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground">{tag}</span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
      <Button
        variant="ghost"
        size="sm"
        shape="icon"
        aria-label={t('page.restore')}
        data-panel="restore"
        onClick={onRestore}
      >
        <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
          <path d="M3 4.5h10v8H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        shape="icon"
        aria-label={t('page.closePeek')}
        data-panel="close"
        onClick={onClose}
      >
        <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
          <path
            d="M4 4l8 8M12 4l-8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </Button>
    </section>
  )
}
