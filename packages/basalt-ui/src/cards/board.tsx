import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import type { ComponentType, CSSProperties, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { landing } from '../core/drag-landing'
import { kanban } from '../core/messages/kanban'
import { useMessages } from '../core/messages/use-messages'
import type { DragData, DragEdge, DragLike, Tone, VirtualLike } from '../core/ports'
import { ScrollArea } from '../ui/scroll-area'
import { Segmented } from '../ui/segmented'
import { statusVariants } from '../ui/status'
import type { ColumnRef, KanbanCardProps, Move } from './contract'

type CardMove<C extends string> = Exclude<KanbanCardProps<C>['move'], 'static'>

export type BoardProps<C extends string, T extends { id: string; title: string }> = {
  /** The board's accessible name, the region its columns scroll in. */
  label: string
  /** In order. `tone` draws the dot before the name; `total` is a formatted sum (`$37,920`). */
  columns: readonly {
    id: C
    label: string
    tone?: Tone | undefined
    total?: string | undefined
    /** Takes no card, by drag or by menu. */
    disabled?: boolean | undefined
  }[]
  /** Every column's cards in order; a column's count is its length. */
  items: Readonly<Record<C, readonly T[]>>
  /** One card: a `KanbanCard` given `move` as it is, so its menu is the keyboard path. */
  card(item: T, move: CardMove<C>): ReactElement
  /** Every finished move, by drop or by menu: `index` is the card's final index in `to`. */
  onMove(move: Move<C>): void
  /** The drag engine: `drag` from `basalt-ui/ui/sortable-list`. Without it the menu moves cards. */
  drag?: DragLike | undefined
  /**
   * The one column shown below the regular container tier, where a switch above the board picks
   * it. Pass it with `onActiveChange` to hold it in a URL field: a controlled `active` without it
   * holds the switch still. Without `active` the board keeps its own, the first column at first.
   */
  active?: C | undefined
  onActiveChange?: ((column: C) => void) | undefined
  /**
   * Window every column: `VirtualList` from `basalt-ui/ui/virtual-list` and the fixed px height
   * of one card. The dragged card and the one just moved stay mounted.
   */
  virtual?: { list: VirtualLike; cardHeight: number } | undefined
}

/** The gap between cards, px: the step a virtual row adds under its card. */
const GAP = 10

/**
 * What every child of a column's body shares: room for a classic scrollbar on both edges (none for an
 * overlay bar), so the header, the cards and the empty state start and end on one edge whether or not
 * the list scrolls.
 */
const BODY = '[scrollbar-gutter:stable_both-edges]'

/** What a column passes `VirtualList` beyond the port; a stub ignores it. */
type ListHost = ComponentType<Parameters<VirtualLike>[0] & { className?: string }>

/** The last move: its card stays mounted in a virtual column, and takes focus once it remounts. */
type Moved<C extends string> = { id: string; to: C; index: number }

/**
 * `Move` applied to a board's cards: the card leaves `from` and lands at `index` in `to`. Pure,
 * so it is the `apply` of an `optimistic` target (`basalt-ui/data`), whose restore is the rollback.
 *
 * @useWhen a board moves cards between states and the move must land on the server before the next read
 * @neverWhen the order is set by hand inside one list (use SortableList from basalt-ui/ui/sortable-list)
 *
 * @example
 * ...optimistic<Move<Stage>, Cards>({ key: ['deals'], targets: [{ queryKey: ['deals'], apply: applyMove }] })
 */
export function applyMove<C extends string, T extends { id: string }>(
  items: Readonly<Record<C, readonly T[]>>,
  move: Move<C>,
): Record<C, T[]> {
  const next = Object.fromEntries(
    Object.entries<readonly T[]>(items).map(([id, cards]) => [id, [...cards]]),
  ) as Record<C, T[]>
  const from = next[move.from]
  const at = from.findIndex((card) => card.id === move.id)
  const [card] = at < 0 ? [] : from.splice(at, 1)
  if (card === undefined) return next
  next[move.to].splice(move.index, 0, card)
  return next
}

/**
 * Columns of `KanbanCard`s that move between states. A card moves by its menu (Move up, Move
 * down, Move to a column: the keyboard and assistive path, always there) and, given `drag`, by
 * pointer and touch within and between columns; both call the one `onMove` with the card's final
 * index. While a card is dragged it stays in place at 40 %, a tilted copy follows the pointer, the
 * column under it takes a brand border and a line marks the slot. Each move is said in a polite
 * live region and focus goes back to the moved card's menu. Columns scroll sideways in one region;
 * below the regular container tier only `active` shows.
 *
 * @useWhen work items move between states and the user moves them: a pipeline, an issue flow
 * @neverWhen the items are rows to compare (use DataTable) or the states are read-only and few (a grouped list)
 *
 * @example
 * <Board label="Issues" columns={stages} items={byStage} drag={drag} onMove={move.mutate}
 *   card={(issue, move) => <KanbanCard {...issue} move={move} />} />
 */
export function Board<C extends string, T extends { id: string; title: string }>({
  label,
  columns,
  items,
  card,
  onMove,
  drag,
  active,
  onActiveChange,
  virtual,
}: BoardProps<C, T>): ReactElement {
  const t = useMessages(kanban)
  const scope = useId()
  const root = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [moved, setMoved] = useState<Moved<C> | null>(null)
  // The move whose card already took focus back; read and written in the effect alone.
  const focusedFor = useRef<Moved<C> | null>(null)
  const [said, setSaid] = useState('')
  const [own, setOwn] = useState<C | undefined>(undefined)
  const shown = active ?? own ?? columns[0]?.id
  const pick = (column: string): void => {
    setOwn(column as C)
    onActiveChange?.(column as C)
  }
  const lanes: ColumnRef<C>[] = columns.map((col) => ({
    id: col.id,
    label: col.label,
    count: items[col.id].length,
    ...(col.disabled === true ? { disabled: true } : {}),
  }))

  const send = (move: Move<C>): void => {
    const target = lanes.find((col) => col.id === move.to)
    const title = items[move.from].find((item) => item.id === move.id)?.title
    if (target === undefined || title === undefined || target.disabled === true) return
    onMove(move)
    // Below the regular tier the target may be a hidden column: show it, so the card stays in view.
    const at = `[data-board="${CSS.escape(scope)}"] [data-column="${CSS.escape(move.to)}"]`
    const column = document.querySelector<HTMLElement>(at)
    if (column !== null && getComputedStyle(column).display === 'none') pick(move.to)
    const count = move.from === move.to ? target.count : target.count + 1
    setSaid(t('kanban.moved', title, target.label, move.index + 1, count))
    setMoved({ id: move.id, to: move.to, index: move.index })
  }

  const dropped = useEffectEvent(
    (source: DragData, target: DragData | null, edge: DragEdge | null): void => {
      const id = String(source['id'])
      const from = source['column'] as C
      const to = target?.['column'] as C | undefined
      if (to === undefined) return
      const own = from === to ? Number(source['index']) : -1
      const index =
        target?.['id'] === undefined || edge === null
          ? items[to].length - (from === to ? 1 : 0)
          : landing(own, Number(target['index']), edge)
      if (from === to && index === own) return
      send({ id, from, to, index })
    },
  )

  useEffect(() => {
    if (drag === undefined) return
    return drag.watch({
      onStart(source) {
        if (source['scope'] === scope) setDragId(String(source['id']))
      },
      onDrop({ source, target, edge }) {
        if (source['scope'] !== scope) return
        setDragId(null)
        dropped(source, target, edge)
      },
    })
  }, [drag, scope])

  // The card remounts in its new column once `items` carries the move; give its menu focus once it
  // shows and the menu that sent the move has gone (its focus manager holds focus while it closes).
  useEffect(() => {
    if (moved === null || focusedFor.current === moved) return
    const at = `[data-column="${CSS.escape(moved.to)}"] [data-card-id="${CSS.escape(moved.id)}"] [data-slot="kanban-menu"]`
    let frame = 0
    let frames = 0
    const focus = (): void => {
      const menu = root.current?.querySelector<HTMLElement>(at) ?? null
      const column = menu?.closest<HTMLElement>('[data-slot="board-column"]') ?? null
      // The move has landed once the card sits at its index: a parent may apply it after a round trip.
      const landed =
        menu?.closest<HTMLElement>('[data-slot="board-item"]')?.dataset['index'] ===
        String(moved.index)
      const ready =
        menu !== null &&
        landed &&
        column !== null &&
        getComputedStyle(column).display !== 'none' &&
        document.querySelector('[role="menu"]') === null
      if (!ready) {
        if (frames++ < 30) frame = requestAnimationFrame(focus)
        return
      }
      menu.focus()
      focusedFor.current = moved
    }
    focus()
    return () => cancelAnimationFrame(frame)
  }, [moved, items])

  const keepOf = (col: C): number | undefined => {
    const dragged = dragId === null ? -1 : items[col].findIndex((item) => item.id === dragId)
    if (dragged >= 0) return dragged
    return moved?.to === col ? moved.index : undefined
  }

  return (
    <div
      ref={root}
      data-slot="board"
      data-board={scope}
      className="@container flex min-w-0 flex-col gap-2.5"
    >
      {columns.length > 1 && shown !== undefined && (
        <div className="@regular:hidden">
          <Segmented
            aria-label={label}
            fill={columns.length <= 5}
            size="sm"
            value={shown}
            onValueChange={pick}
            options={columns.map((col) => ({ value: col.id, label: col.label }))}
          />
        </div>
      )}
      <ScrollArea orientation="horizontal" aria-label={label}>
        <div className="flex items-start gap-2.5 pb-1">
          {columns.map((col, c) => (
            <BoardColumn
              key={col.id}
              col={col}
              count={lanes[c]!.count}
              shown={col.id === shown}
              scope={scope}
              drag={col.disabled === true ? undefined : drag}
              empty={t('kanban.empty')}
            >
              {(() => {
                const cards = items[col.id]
                const renderAt = (index: number): ReactNode => {
                  const item = cards[index]!
                  return (
                    <BoardItem
                      key={item.id}
                      id={item.id}
                      column={col.id}
                      index={index}
                      scope={scope}
                      drag={drag}
                      droppable={col.disabled !== true}
                    >
                      {card(item, {
                        column: lanes[c]!,
                        index,
                        columns: lanes,
                        onMove: send,
                        dragging: item.id === dragId,
                      })}
                    </BoardItem>
                  )
                }
                if (cards.length === 0) return null
                if (virtual === undefined)
                  return (
                    <ol
                      className={cn(
                        'm-0 flex list-none flex-col gap-2.5 overflow-hidden p-0',
                        BODY,
                      )}
                    >
                      {cards.map((item, index) => (
                        <li key={item.id}>{renderAt(index)}</li>
                      ))}
                    </ol>
                  )
                const List = virtual.list as unknown as ListHost
                const keep = keepOf(col.id)
                const rowHeight = {
                  '--board-row': `${virtual.cardHeight + GAP}px`,
                } as CSSProperties
                return (
                  <List
                    className={cn('max-h-160', BODY)}
                    count={cards.length}
                    estimateSize={() => virtual.cardHeight + GAP}
                    getItemKey={(i) => cards[i]!.id}
                    {...(keep === undefined ? {} : { keepIndex: keep })}
                  >
                    {([row]) => (
                      <div className="h-(--board-row) pb-2.5 *:h-full" style={rowHeight}>
                        {renderAt(row!.index)}
                      </div>
                    )}
                  </List>
                )
              })()}
            </BoardColumn>
          ))}
        </div>
      </ScrollArea>
      <output className="sr-only">{said}</output>
    </div>
  )
}

function BoardColumn<C extends string>({
  col,
  count,
  shown,
  scope,
  drag,
  empty,
  children,
}: {
  col: BoardProps<C, { id: string; title: string }>['columns'][number]
  count: number
  shown: boolean
  scope: string
  drag: DragLike | undefined
  empty: string
  children: ReactNode
}): ReactElement {
  const ref = useRef<HTMLElement>(null)
  const [over, setOver] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (drag === undefined || element === null) return
    return drag.target({
      element,
      data: { scope, column: col.id },
      onHover: (edge) => setOver(edge !== null),
    })
  }, [drag, scope, col.id])

  return (
    <section
      ref={ref}
      aria-label={col.label}
      data-slot="board-column"
      data-column={col.id}
      data-over={over ? '' : undefined}
      data-shown={shown ? '' : undefined}
      className="hidden w-full min-w-0 shrink-0 flex-col gap-2.5 rounded-card border border-transparent bg-secondary p-2.5 transition-colors duration-fast data-over:border-brand data-over:bg-accent data-shown:flex @regular:flex @regular:w-72"
    >
      <header
        className={cn('flex h-9 min-w-0 items-center justify-between gap-2 overflow-hidden', BODY)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <h3
            className={cn(
              'm-0 min-w-0 truncate text-sm font-medium',
              col.tone === undefined ? 'text-foreground' : statusVariants({ tone: col.tone }),
            )}
          >
            {col.label}
          </h3>
          <span data-slot="board-count" className="text-xs text-muted-foreground tabular-nums">
            {count}
          </span>
        </span>
        {col.total !== undefined && (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{col.total}</span>
        )}
      </header>
      {count === 0 ? (
        <div className={cn('overflow-hidden', BODY)}>
          <p
            data-slot="board-empty"
            className="m-0 flex h-24 items-center justify-center rounded-inset border border-dashed border-line text-xs text-muted-foreground"
          >
            {empty}
          </p>
        </div>
      ) : (
        children
      )}
    </section>
  )
}

function BoardItem<C extends string>({
  id,
  column,
  index,
  scope,
  drag,
  droppable,
  children,
}: {
  id: string
  column: C
  index: number
  scope: string
  drag: DragLike | undefined
  droppable: boolean
  children: ReactElement
}): ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState<DragEdge | null>(null)

  useEffect(() => {
    const element = ref.current
    if (drag === undefined || element === null) return
    const data = { scope, id, column, index }
    const off = [drag.item({ element, data, tilt: true })]
    if (droppable) off.push(drag.target({ element, data, onHover: setEdge }))
    return () => {
      for (const cleanup of off) cleanup()
    }
  }, [drag, scope, id, column, index, droppable])

  return (
    <div
      ref={ref}
      data-slot="board-item"
      data-index={index}
      data-edge={edge ?? undefined}
      className="relative data-edge:before:pointer-events-none data-edge:before:absolute data-edge:before:inset-x-0 data-edge:before:h-0.5 data-edge:before:rounded-full data-edge:before:bg-brand data-[edge=after]:before:-bottom-1.5 data-[edge=before]:before:-top-1.5"
    >
      {children}
    </div>
  )
}
