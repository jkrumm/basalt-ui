/**
 * Board — status columns of cards (docs/waves/design-parity/SPEC.md § 6.8): a column header (status
 * dot, title, count, right-aligned `total`), then cards stacked 6 px apart, each column scrolling alone
 * inside a `ScrollArea` bounded by `height`. Choose it for work that moves through states (a queue
 * of agent runs, a review pipeline); a table is for comparing rows. No drag and drop: a card changes
 * column when its data does.
 *
 * Cards are typed data: a caption (`actor · type`), a `title`, an optional linked `record`, a `status`
 * line and one optional `meter` slot. `record.href` renders as a link only when it is http(s) or
 * relative; anything else stays text. The theme owns the card's inset, radius and surface.
 *
 * Keyboard: the board is one tab stop (roving tabindex). ArrowUp/Down and Home/End move within a
 * column; ArrowLeft/Right jump to the nearest non-empty column on the same row index (clamped to its
 * last card). Enter and Space call `onOpen`, and so does a click anywhere on the card. A polite live
 * region announces "<column>, card i of n: <title>" on every move.
 *
 * Semantics: each column is a `role="group"` named by its title and count, its cards a `list` of
 * `listitem`s; the focusable element is one `button` per card, named by the card title (its
 * `::after` stretches over the card, so the whole card is the target). No `grid` role.
 *
 * Compact (`useSizeClass() === 'compact'`): one column at a time under a `SegmentedControl` labelled
 * "<title> <count>" (not `ViewTabs`: past three options it becomes a `Select` on a phone, and the
 * board's switcher is always the track). The selected column is a store field when you pass `field` (an enum field whose
 * values are column ids, like `ViewTabs`'s; the URL or storage then remembers it), else internal
 * state. An empty column is one muted line (`empty`); an empty board is the
 * `EmptyState` tile (`empty` on the board); `loading` is column-shaped skeletons. An error is the
 * caller's: put the board in a `Section` with `query`.
 *
 * @example
 * import { Board } from 'basalt-ui'
 *
 * <Board
 *   label="Warden board"
 *   height={480}
 *   onOpen={(id) => openTimeline(id)}
 *   columns={[
 *     { id: 'needs', title: 'Needs you', tone: VX.status.warn, total: '3 items', cards: [
 *       { id: '41', actor: 'warden', type: 'PR review', title: 'Fix the cache key', record: { label: '#482', href: url }, status: 'Waiting 2 h' },
 *     ] },
 *     { id: 'done', title: 'Done', empty: 'Nothing finished today', cards: [] },
 *   ]}
 * />
 */
import { ScrollArea, SegmentedControl, Skeleton, Card, VisuallyHidden } from '@mantine/core'
import { Fragment, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import { useSizeClass } from '../shell/use-size-class'
import type { EnumField, FieldHandle } from '../state'
import { StatusDot } from '../theme/status-dot'
import { VX } from '../tokens'
import classes from './board.module.css'
import { isBoardKey, isSafeHref, moveOnBoard } from './board-nav'
import type { BoardPos } from './board-nav'
import { EmptyState } from './empty-state'

export type BoardProps<T extends string = string> = BasaltProps & {
  /** Accessible name of the board. Default "Board". */
  label?: string
  /** Columns in display order. Column and card `id`s must be unique within their parent. */
  columns: readonly {
    id: T
    title: string
    /** Colour of the header's status dot (a `VX.status.*` token). Default muted. */
    tone?: string
    /** Right-aligned header text, already formatted ("3 items", "$12.40"). */
    total?: string
    /** The muted line an empty column shows. Default "Nothing here". */
    empty?: string
    cards: readonly {
      id: string
      actor?: string
      type?: string
      title: string
      /** A linked record; `href` is a link only when http(s) or relative. */
      record?: { label: string; href?: string }
      /** One muted status line ("Deferred · waiting on CI"). */
      status?: string
      /** An optional meter or preview; the one ReactNode slot. */
      meter?: ReactNode
    }[]
  }[]
  /** Called with the card and column ids on Enter, Space or a click. */
  onOpen?: (cardId: string, columnId: string) => void
  /** Each column scrolls alone inside a box of this height. Omitted: content-sized. */
  height?: number | string
  /** Renders column-shaped skeletons. */
  loading?: boolean
  /** The tile shown when no column has a card. Default "Nothing on the board". */
  empty?: { title: string; description?: string; action?: ReactNode }
  /**
   * Compact: the store field holding the selected column id (an enum field of the column ids, the
   * type `ViewTabs` takes). Omitted: internal state, first column.
   */
  field?: FieldHandle<EnumField<T>>
}

const DEFAULT_EMPTY = { title: 'Nothing on the board' } as const
const SKELETON_COLUMNS = 3
const SKELETON_CARDS = 3

const cardKey = (col: string, card: string): string => `${col}\u0000${card}`

function SkeletonColumn({ title }: { title?: string }) {
  return (
    <div className={classes.column} aria-hidden>
      <div className={classes.head}>
        {title === undefined ? (
          <Skeleton className={classes.skeletonTitle} />
        ) : (
          <span className={classes.title}>{title}</span>
        )}
      </div>
      <div className={classes.list}>
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
          <Card key={i} className={classes.card}>
            <Skeleton className={classes.skeletonCaption} />
            <Skeleton className={classes.skeletonLine} />
            <Skeleton className={classes.skeletonStatus} />
          </Card>
        ))}
      </div>
    </div>
  )
}

type BoardViewProps<T extends string> = Omit<BoardProps<T>, 'field'> & {
  /** The selected column id and its setter, from the field or from internal state. */
  picked: T | undefined
  onPick: (columnId: T) => void
}

/** The field's `use()` is a hook, so the field and internal-state forms are two components over one view. */
function FieldBoard<T extends string>({
  field,
  ...props
}: Omit<BoardProps<T>, 'field'> & { field: FieldHandle<EnumField<T>> }) {
  const [picked, setPicked] = field.use()
  return <BoardView {...props} picked={picked} onPick={setPicked} />
}

function InternalBoard<T extends string>(props: Omit<BoardProps<T>, 'field'>) {
  const [picked, setPicked] = useState<T | undefined>(undefined)
  return <BoardView {...props} picked={picked} onPick={setPicked} />
}

export function Board<T extends string = string>({ field, ...props }: BoardProps<T>) {
  return field === undefined ? (
    <InternalBoard {...props} />
  ) : (
    <FieldBoard field={field} {...props} />
  )
}

function BoardView<T extends string>({
  label = 'Board',
  columns,
  onOpen,
  height,
  loading = false,
  empty = DEFAULT_EMPTY,
  picked,
  onPick,
  className,
  style,
}: BoardViewProps<T>) {
  const compact = useSizeClass() === 'compact'
  const labelId = useId()
  const [active, setActive] = useState<{ col: string; card: string } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const buttons = useRef(new Map<string, HTMLButtonElement>())
  const pending = useRef<string | null>(null)

  const sizes = columns.map((c) => c.cards.length)
  const total = sizes.reduce((a, b) => a + b, 0)
  const selected = columns.find((c) => c.id === picked) ?? columns[0]
  const selectColumn = onPick

  // The roving stop sits in what is rendered: the focused card if it still exists there (compact
  // renders only the selected column), else the first card of the first rendered non-empty column.
  const selectedIndex = selected === undefined ? -1 : columns.indexOf(selected)
  const rendered = (colIndex: number): boolean => !compact || colIndex === selectedIndex
  const firstCol = columns.findIndex((c, i) => rendered(i) && c.cards.length > 0)
  const activeCol = columns.findIndex((c) => c.id === active?.col)
  const activeRow = columns[activeCol]?.cards.findIndex((c) => c.id === active?.card) ?? -1
  const stop: BoardPos | null =
    activeCol >= 0 && activeRow >= 0 && rendered(activeCol)
      ? { col: activeCol, row: activeRow }
      : firstCol >= 0
        ? { col: firstCol, row: 0 }
        : null

  // A move in compact may first have to mount the target column; focus lands after that render.
  useEffect(() => {
    const key = pending.current
    if (key === null) return
    // One shot: a target that did not mount is dropped, never retried on a later render.
    pending.current = null
    buttons.current.get(key)?.focus()
  })

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, from: BoardPos): void => {
    if (!isBoardKey(event.key)) return
    event.preventDefault()
    const to = moveOnBoard(sizes, from, event.key)
    const col = to && columns[to.col]
    const card = col && col.cards[to.row]
    if (!to || !col || !card) return
    pending.current = cardKey(col.id, card.id)
    setActive({ col: col.id, card: card.id })
    setAnnouncement(`${col.title}, card ${to.row + 1} of ${col.cards.length}: ${card.title}`)
    if (compact && col.id !== selected?.id) selectColumn(col.id)
  }

  const renderColumn = (col: (typeof columns)[number], colIndex: number): ReactNode => {
    const headId = `${labelId}-${col.id}`
    const list =
      col.cards.length === 0 ? (
        <p className={classes.emptyLine}>{col.empty ?? 'Nothing here'}</p>
      ) : (
        // The explicit role is deliberate: `list-style: none` makes Safari/VoiceOver drop the implicit one.
        // oxlint-disable-next-line jsx-a11y/no-redundant-roles
        <ul className={classes.list} role="list" aria-labelledby={headId}>
          {col.cards.map((card, row) => {
            const here = stop?.col === colIndex && stop.row === row
            const caption = [card.actor, card.type].filter(Boolean).join(' · ')
            return (
              <li key={card.id}>
                <Card className={classes.card}>
                  {caption !== '' && <p className={classes.caption}>{caption}</p>}
                  <button
                    type="button"
                    className={classes.open}
                    tabIndex={here ? 0 : -1}
                    ref={(el) => {
                      const key = cardKey(col.id, card.id)
                      if (el) buttons.current.set(key, el)
                      else buttons.current.delete(key)
                    }}
                    onFocus={() => setActive({ col: col.id, card: card.id })}
                    onKeyDown={(e) => onKeyDown(e, { col: colIndex, row })}
                    onClick={() => onOpen?.(card.id, col.id)}
                  >
                    {card.title}
                  </button>
                  {card.record !== undefined &&
                    (card.record.href !== undefined && isSafeHref(card.record.href) ? (
                      <a
                        className={classes.record}
                        href={card.record.href}
                        {...(/^https?:/i.test(card.record.href) && {
                          target: '_blank',
                          rel: 'noreferrer',
                        })}
                      >
                        {card.record.label}
                      </a>
                    ) : (
                      <span className={classes.record}>{card.record.label}</span>
                    ))}
                  {card.status !== undefined && <p className={classes.status}>{card.status}</p>}
                  {card.meter !== undefined && <div className={classes.meter}>{card.meter}</div>}
                </Card>
              </li>
            )
          })}
        </ul>
      )
    return (
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a named group of cards, not a fieldset
      <div key={col.id} className={classes.column} role="group" aria-labelledby={headId}>
        <div className={classes.head}>
          <StatusDot color={col.tone ?? VX.muted} />
          <h3 id={headId} className={classes.title}>
            {col.title}
            <VisuallyHidden>{`, ${col.cards.length} ${col.cards.length === 1 ? 'card' : 'cards'}`}</VisuallyHidden>
          </h3>
          <span className={classes.count} aria-hidden>
            {col.cards.length}
          </span>
          {col.total !== undefined && <span className={classes.total}>{col.total}</span>}
        </div>
        <ScrollArea.Autosize
          {...(height !== undefined && { mah: height })}
          type="auto"
          offsetScrollbars="y"
        >
          {list}
        </ScrollArea.Autosize>
      </div>
    )
  }

  let content: ReactNode
  if (loading) {
    content = (
      <div aria-busy="true">
        <VisuallyHidden>{`Loading ${label}`}</VisuallyHidden>
        <div className={classes.columns}>
          {compact ? (
            <SkeletonColumn />
          ) : columns.length > 0 ? (
            columns.map((c) => <SkeletonColumn key={c.id} title={c.title} />)
          ) : (
            Array.from({ length: SKELETON_COLUMNS }, (_, i) => <SkeletonColumn key={i} />)
          )}
        </div>
      </div>
    )
  } else if (total === 0) {
    content = (
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a polite live region whose name is the visually hidden label inside
      <div className={classes.empty} role="status">
        <VisuallyHidden>{label}</VisuallyHidden>
        <EmptyState
          tier="section"
          title={empty.title}
          {...(empty.description !== undefined && { description: empty.description })}
          {...(empty.action !== undefined && { action: empty.action })}
        />
      </div>
    )
  } else {
    content = (
      <Fragment>
        {compact && (
          // theme-allow raw-selection-control — the board's own column switcher, its selection is the board's own (a `field` when given, else internal), not a page filter.
          <SegmentedControl
            aria-label={`${label} column`}
            fullWidth
            size="ctl"
            value={selected?.id ?? ''}
            onChange={(id) => {
              const col = columns.find((c) => c.id === id)
              if (col) selectColumn(col.id)
            }}
            data={columns.map((c) => ({ value: c.id, label: `${c.title} ${c.cards.length}` }))}
          />
        )}
        <div className={classes.columns}>
          {compact
            ? selected && renderColumn(selected, columns.indexOf(selected))
            : columns.map(renderColumn)}
        </div>
        <VisuallyHidden component="output" aria-live="polite">
          {announcement}
        </VisuallyHidden>
      </Fragment>
    )
  }

  return (
    <div className={cx(classes.root, className)} style={style} data-board="">
      {content}
    </div>
  )
}
