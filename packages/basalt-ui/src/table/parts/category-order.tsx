/**
 * The order of a status column's categories (docs/v3/concepts/data-table.md section 3, owner review
 * 1): the column's options as a list the user rearranges, by dragging a row or from the keyboard.
 * Each change writes `request.ranks` through `setRank`, which also sorts the table by the column,
 * so the rows behind the popup follow at once and the URL and a saved view carry the order.
 *
 * Keyboard: the grips are one tab stop; Up and Down move between them, Alt with Up or Down moves
 * the focused category one place, Alt with Home or End to the top or the bottom, and a live region
 * says where it went. Pointer: a mouse drags the whole row, touch drags by the grip (the rest of
 * the row still scrolls a sheet). Reset to default drops the rank.
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { Button } from '../../ui/button'
import { Status } from '../../ui/status'
import type { KindSpec } from '../core/kinds-spec'
import type { TableModel } from '../use-data-table'

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

/**
 * The rearrangeable list of one status column's categories. Renders inside the header's popover
 * and inline in the `Filters (n)` sheet.
 */
export function CategoryOrder<T>({
  model,
  spec,
  titleId,
}: {
  model: TableModel<T>
  spec: KindSpec<T>
  /** The id of the list's title, so a popover holding it can take its name from it. */
  titleId?: string
}): ReactElement {
  const t = useMessages(table)
  const hintId = useId()
  const ownTitleId = useId()
  const titleOf = titleId ?? ownTitleId
  const committed = model.rankOf(spec.id)
  const [drag, setDrag] = useState<Drag | null>(null)
  const order = drag?.order ?? committed
  const [stop, setStop] = useState<string | undefined>(undefined)
  const [announce, setAnnounce] = useState('')
  const grips = useRef(new Map<string, HTMLElement>())
  const refocus = useRef<string | null>(null)
  const ranked = (model.state.request.ranks?.[spec.id]?.length ?? 0) > 0
  const labelOf = (value: string): string => spec.labels?.[value] ?? value
  const tabStop = stop !== undefined && order.includes(stop) ? stop : order[0]

  // React moves a keyed row by re-inserting its node, which drops focus; put it back on the grip.
  useEffect(() => {
    if (refocus.current === null) return
    grips.current.get(refocus.current)?.focus()
    refocus.current = null
  })

  const commit = (value: string, next: readonly string[]): void => {
    model.setRank(spec.id, next)
    setAnnounce(t('table.orderMoved', labelOf(value), next.indexOf(value) + 1, next.length))
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
    <div data-slot="table-order" className="flex min-w-0 flex-col gap-2">
      <span id={titleOf} className="font-medium">
        {t('table.orderOf', spec.header)}
      </span>
      <ol aria-labelledby={titleOf} className="m-0 flex list-none flex-col p-0">
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
              {spec.tone === undefined ? (
                <span className="min-w-0 flex-1 truncate">{labelOf(value)}</span>
              ) : (
                <Status tone={spec.tone(value)} className="min-w-0 flex-1">
                  {labelOf(value)}
                </Status>
              )}
              <span aria-hidden="true" className="text-xs text-muted-foreground tabular-nums">
                {index + 1}
              </span>
            </li>
          )
        })}
      </ol>
      <div className="flex items-center justify-between gap-2">
        <span id={hintId} className="text-xs text-muted-foreground">
          {t('table.orderHint')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={!ranked}
          onClick={() => {
            model.setRank(spec.id, spec.options ?? [])
            setAnnounce('')
          }}
        >
          {t('table.orderReset')}
        </Button>
      </div>
      <output aria-live="polite" className="sr-only">
        {announce}
      </output>
    </div>
  )
}
