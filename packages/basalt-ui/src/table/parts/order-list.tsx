/**
 * A list the reader rearranges, by dragging a row or from the keyboard: a status column's
 * categories (`category-order.tsx`) and the table's columns (the toolbar's Display list).
 *
 * Keyboard: the grips are one tab stop; Up and Down move between them, Alt with Up or Down moves
 * the focused entry one place, Alt with Home or End to the top or the bottom, and a live region
 * says where it went. Pointer: a mouse drags the whole row, touch drags by the grip (the rest of
 * the row still scrolls a sheet). The order is written once, on release or on the key.
 */
import { useEffect, useId, useRef, useState } from 'react'
import type {
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactElement,
  ReactNode,
} from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Button } from '../../ui/button'

type Drag = {
  value: string
  pointer: number
  /** The list order while the row is held; written once, on release. */
  order: readonly string[]
  startY: number
  startIndex: number
  /** One row's height: how far the pointer travels to pass a neighbour. */
  pitch: number
  dy: number
}

function GripGlyph(): ReactElement {
  return (
    <svg viewBox="0 0 10 16" className="h-3.5 w-2.5" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="3" r="1.25" />
      <circle cx="7" cy="3" r="1.25" />
      <circle cx="3" cy="8" r="1.25" />
      <circle cx="7" cy="8" r="1.25" />
      <circle cx="3" cy="13" r="1.25" />
      <circle cx="7" cy="13" r="1.25" />
    </svg>
  )
}

const moved = (order: readonly string[], value: string, to: number): readonly string[] => {
  const from = order.indexOf(value)
  return order.toSpliced(from, 1).toSpliced(to, 0, value)
}

export type OrderListProps = {
  /** The committed order of the entries' values. */
  order: readonly string[]
  /** An entry's name, read by its grip and the live region. */
  labelOf: (value: string) => string
  /** A move ended: `next` is the whole new order. */
  onCommit: (value: string, next: readonly string[]) => void
  /** What a row shows after its grip. */
  renderItem: (value: string, index: number) => ReactNode
  /** The id of the list's title. */
  labelledBy: string
  /** Beside the hint under the list (a reset button). */
  footer?: ReactNode
  /** Drawn first, above the movable rows, with no grip (the identity column). */
  lead?: ReactNode
  /** Cleared when the list resets, so a stale announcement is not read again. */
  announceKey?: unknown
}

/** The rearrangeable list; renders inside a popover or inline in a sheet. */
export function OrderList({
  order: committed,
  labelOf,
  onCommit,
  renderItem,
  labelledBy,
  footer,
  lead,
  announceKey,
}: OrderListProps): ReactElement {
  const t = useMessages(table)
  const hintId = useId()
  const [drag, setDrag] = useState<Drag | null>(null)
  const order = drag?.order ?? committed
  const [stop, setStop] = useState<string | undefined>(undefined)
  // The announcement is read only under the reset it was made in: a reset clears it without an effect.
  const [said, setSaid] = useState<{ key: unknown; text: string }>({ key: announceKey, text: '' })
  const announce = Object.is(said.key, announceKey) ? said.text : ''
  const grips = useRef(new Map<string, HTMLElement>())
  const refocus = useRef<string | null>(null)
  const tabStop = stop !== undefined && order.includes(stop) ? stop : order[0]

  // React moves a keyed row by re-inserting its node, which drops focus; put it back on the grip.
  useEffect(() => {
    if (refocus.current === null) return
    grips.current.get(refocus.current)?.focus()
    refocus.current = null
  })

  const commit = (value: string, next: readonly string[]): void => {
    onCommit(value, next)
    setSaid({
      key: announceKey,
      text: t('table.orderMoved', labelOf(value), next.indexOf(value) + 1, next.length),
    })
  }
  const moveTo = (value: string, to: number): void => {
    const from = order.indexOf(value)
    if (to < 0 || to >= order.length || to === from) return
    refocus.current = value
    commit(value, moved(order, value, to))
  }
  const focusAt = (index: number): void => {
    const value = order[Math.max(0, Math.min(order.length - 1, index))]
    if (value === undefined) return
    setStop(value)
    grips.current.get(value)?.focus()
  }

  const onKeyDown = (event: KeyboardEvent, value: string): void => {
    const index = order.indexOf(value)
    const key = event.key
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return
    event.preventDefault()
    const last = order.length - 1
    const to =
      key === 'ArrowUp' ? index - 1 : key === 'ArrowDown' ? index + 1 : key === 'Home' ? 0 : last
    if (event.altKey) moveTo(value, to)
    else focusAt(to)
  }

  const start = (event: ReactPointerEvent<HTMLLIElement>, value: string): void => {
    if (event.button !== 0 || drag !== null) return
    const onGrip = (event.target as HTMLElement).closest('[data-order-grip]') !== null
    if (event.pointerType !== 'mouse' && !onGrip) return
    // A control in the row (a column's checkbox) keeps its own click.
    if (!onGrip && (event.target as HTMLElement).closest('button, input, [role="checkbox"]')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setStop(value)
    grips.current.get(value)?.focus()
    setDrag({
      value,
      pointer: event.pointerId,
      order,
      startY: event.clientY,
      startIndex: order.indexOf(value),
      pitch: Math.max(1, event.currentTarget.offsetHeight),
      dy: 0,
    })
  }
  const follow = (event: ReactPointerEvent<HTMLLIElement>): void => {
    if (drag === null || event.pointerId !== drag.pointer) return
    const dy = event.clientY - drag.startY
    const target = Math.max(
      0,
      Math.min(drag.order.length - 1, drag.startIndex + Math.round(dy / drag.pitch)),
    )
    const next =
      target === drag.order.indexOf(drag.value) ? drag.order : moved(drag.order, drag.value, target)
    setDrag({ ...drag, order: next, dy })
  }
  const end = (event: ReactPointerEvent<HTMLLIElement>, cancel: boolean): void => {
    if (drag === null || event.pointerId !== drag.pointer) return
    setDrag(null)
    const changed = drag.order.some((v, i) => v !== committed[i])
    if (!cancel && changed) {
      refocus.current = drag.value
      commit(drag.value, drag.order)
    }
  }

  return (
    <>
      <ol aria-labelledby={labelledBy} className="m-0 flex list-none flex-col p-0">
        {lead}
        {order.map((value, index) => {
          const held = drag?.value === value
          const offset = held ? drag.dy - (index - drag.startIndex) * drag.pitch : 0
          return (
            <li
              key={value}
              data-slot="table-order-row"
              data-dragging={held ? '' : undefined}
              style={held ? { transform: `translateY(${offset}px)` } : undefined}
              className="relative flex min-h-8 cursor-grab items-center gap-2 rounded-ctrl pe-2 select-none hover:bg-accent data-dragging:z-10 data-dragging:cursor-grabbing data-dragging:bg-popover data-dragging:shadow-overlay pointer-coarse:min-h-11"
              onPointerDown={(event) => start(event, value)}
              onPointerMove={follow}
              onPointerUp={(event) => end(event, false)}
              onPointerCancel={(event) => end(event, true)}
            >
              <Button
                ref={(node: HTMLElement | null) => {
                  if (node === null) grips.current.delete(value)
                  else grips.current.set(value, node)
                }}
                data-order-grip=""
                shape="icon"
                size="sm"
                variant="ghost"
                tabIndex={value === tabStop ? 0 : -1}
                aria-label={t('table.orderHandle', labelOf(value), index + 1, order.length)}
                aria-describedby={hintId}
                className="cursor-grab touch-none text-muted-foreground"
                onFocus={() => setStop(value)}
                onKeyDown={(event) => onKeyDown(event, value)}
              >
                <GripGlyph />
              </Button>
              {renderItem(value, index)}
            </li>
          )
        })}
      </ol>
      <div className="flex items-center justify-between gap-2">
        <span id={hintId} className="text-xs text-muted-foreground">
          {t('table.orderHint')}
        </span>
        {footer}
      </div>
      <output aria-live="polite" className="sr-only">
        {announce}
      </output>
    </>
  )
}
