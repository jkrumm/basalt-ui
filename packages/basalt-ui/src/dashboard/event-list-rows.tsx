/** `EventList`'s row, day header and the flat rows of its windowed path. */
import type { VirtualRow } from '../common/virtual-rows'
import classes from './event-list.module.css'
import type { EventListProps } from './event-list'
import {
  formatEventTime,
  isValidEventDate,
  present,
  rowAttributes,
  toEventDate,
} from './event-list-model'
import type { EventGroup, RowContext } from './event-list-model'

export type EventItem = EventListProps['items'][number]

export function EventRow({
  item,
  ctx,
  first,
  last,
  tag: Tag,
}: {
  item: EventItem
  ctx: RowContext
  first: boolean
  last: boolean
  tag: 'li' | 'div'
}) {
  const at = toEventDate(item.at)
  const valid = isValidEventDate(at)
  const stamp = formatEventTime(at, ctx.timeMode, ctx.now)
  const hasMeta = present(item.body) || present(item.chips)
  return (
    <Tag
      className={classes.row}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a windowed row is a div under the seam's wrappers, never a li
      role={Tag === 'div' ? 'listitem' : undefined}
      data-event-id={item.id}
      data-untimed={stamp === '' ? '' : undefined}
      // A row whose only meta is chips and has no time: the chips join the sentence's line, not a line of their own.
      data-chips-only={stamp === '' && !present(item.body) && present(item.chips) ? '' : undefined}
      {...rowAttributes(ctx, first, last)}
    >
      {ctx.lead && <span className={classes.leading}>{item.leading}</span>}
      <span className={classes.line}>
        {present(item.actor) && <span className={classes.actor}>{item.actor} </span>}
        {item.title}
      </span>
      {stamp !== '' && (
        <time className={classes.time} {...(valid && { dateTime: at.toISOString() })}>
          {stamp}
        </time>
      )}
      {hasMeta && (
        <div className={classes.meta}>
          <MetaFlow body={item.body} chips={item.chips} />
        </div>
      )}
    </Tag>
  )
}

const TRAILING_WORD = /^([\s\S]*\s)(\S+)\s*$/

/**
 * The meta line's text flow: the body, then the chips after its last word. A string body hands its
 * final word to the chips in one unbreakable span, so the chips never wrap onto a line of their own;
 * a node body keeps the plain flow.
 */
function MetaFlow({ body, chips }: { body: EventItem['body']; chips: EventItem['chips'] }) {
  const hasBody = present(body)
  const hasChips = present(chips)
  const chipsNode = hasChips && <span className={classes.chips}>{chips}</span>
  if (!hasBody) return chipsNode
  if (!hasChips) return <span className={classes.body}>{body}</span>
  if (typeof body !== 'string') {
    return (
      <>
        <span className={classes.body}>{body}</span>
        {chipsNode}
      </>
    )
  }
  const [, lead = '', last = body.trim()] = TRAILING_WORD.exec(body) ?? []
  return (
    <>
      <span className={classes.body}>{lead}</span>
      <span className={classes.tail}>
        {last}
        {chipsNode}
      </span>
    </>
  )
}

const countLabel = (n: number): string => `· ${n} ${n === 1 ? 'event' : 'events'}`

/** The flat rows of the windowed path: a sticky header row per day, then its items. */
export function buildRows(
  groups: readonly EventGroup<EventItem>[],
  showHeaders: boolean,
  ctx: RowContext,
  headerText: (day: Date) => string,
): VirtualRow[] {
  return groups.flatMap((g) => {
    const itemRows = g.items.map((item, i) => ({
      key: `item:${item.id}`,
      node: (
        <EventRow item={item} ctx={ctx} first={i === 0} last={i === g.items.length - 1} tag="div" />
      ),
    }))
    if (!showHeaders) return itemRows
    return [
      {
        key: `day:${g.id}`,
        sticky: true,
        node: <DayHeader text={headerText(g.day)} count={g.items.length} windowed />,
      },
      ...itemRows,
    ]
  })
}

export function DayHeader({
  text,
  count,
  id,
  as: Tag = 'div',
  windowed = false,
}: {
  text: string
  count: number
  id?: string
  as?: 'h3' | 'div'
  /** A windowed header is its own list item, its inner element a level-3 heading like the plain `<h3>`. */
  windowed?: boolean
}) {
  const header = (
    <Tag
      id={id}
      data-day-header=""
      {...(windowed && { role: 'heading', 'aria-level': 3 })}
      className={classes.header}
    >
      {text}
      <span className={classes.count}>{countLabel(count)}</span>
    </Tag>
  )
  if (!windowed) return header
  // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- see EventRow: a windowed header is a div
  return <div role="listitem">{header}</div>
}
