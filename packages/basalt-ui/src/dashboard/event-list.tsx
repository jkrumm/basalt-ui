/**
 * EventList — a day-grouped feed or timeline of things that happened: a leading glyph, the actor and
 * a sentence on line one; line two leads with the mono time, then the muted body and the chips. Choose it
 * for activity, history and audit trails; a table is for comparing rows, this is for reading them
 * in order. An HTML/CSS primitive (no chart engine).
 *
 * The caller's order is kept — the list never sorts. `order` only says which end is "earlier", so
 * day groups and the `earlier` control land on the right edge. Days are local. Item `id`s are the
 * rows' identity (keys, prepend anchoring): keep them unique and stable.
 *
 * The row is two lines at every width: line one is the glyph and `actor + sentence` (it wraps at every density, never truncates); line two leads with the time, then the body (it wraps, never
 * truncates), then the chips (they follow its last word in the same flow, each chip unbroken). A row with no body or
 * chips still has line two, the time alone; an untimed row's line two is body and chips only.
 *
 * Above 200 rows the rows window through the package's one lazy virtual-list seam
 * (`@tanstack/react-virtual`, an optional peer); at or below it the list is plain DOM and the peer is
 * never loaded. A list crossing 200 rows keeps its scroll node and may land a few rows off its place. With `height` the list owns its scroll node — an oldest-first list then opens on its
 * newest end and keeps the visible row across a prepend; without it the rows follow the nearest
 * scrolling ancestor (the shell's scrollport) and the page keeps scrolling. States follow `BarList`:
 * `loading` is row-shaped skeletons (the box keeps its height), an empty list is an `EmptyState` tile
 * (`empty`) that sizes to its content.
 * An error is the caller's: `QueryState` is not a public export, so put the list in a `Section`
 * with `query` (it owns the failure and its retry) or render your own error note.
 *
 * @example
 * import { EventList } from 'basalt-ui'
 *
 * <EventList
 *   label="Activity"
 *   items={[{ id: 'e1', at: Date.now(), actor: 'Ada', title: 'merged #482', chips: <Badge>main</Badge> }]}
 *   earlier={{ onLoad: loadMore, remaining: 12 }}
 * />
 *
 * // A record's history: rail, full sentences, oldest first, in a box that opens on the newest event.
 * <EventList label="History" density="timeline" order="oldest-first" height={440} items={events} />
 */
import { Button, VisuallyHidden } from '@mantine/core'
import { useId, useRef, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { markFigureBody, useCardPending } from '../charts/card-pending-context'
import { cx, pickDataAttributes } from '../common/props'
import type { BasaltProps, DataAttributes } from '../common/props'
import { VirtualRows } from '../common/virtual-rows'
import classes from './event-list.module.css'
import { EmptyState } from './empty-state'
import { buildRows, DayHeader, EventRow } from './event-list-rows'
import {
  defaultDayLabel,
  groupByDay,
  isValidEventDate,
  present,
  skeletonRowCount,
  toEventDate,
} from './event-list-model'
import type { RowContext } from './event-list-model'
import {
  useHeldHeight,
  useOpenAtEnd,
  usePrependAnchor,
  useRowBoundary,
  useScrolledEdge,
} from './event-list-scroll'
import { SkeletonRows } from './event-list-skeleton'

/** Rows above this window through the virtual-list seam; at or below it the list is plain DOM. */
const VIRTUALIZE_THRESHOLD = 200

export type EventListProps = BasaltProps &
  DataAttributes & {
    /** Accessible name of the list. Default "Events". */
    label?: string
    /** Events in display order — kept as given, never re-sorted. `id`s must be unique within the list. */
    items: readonly {
      id: string
      at: Date | number
      actor?: ReactNode
      title: ReactNode
      body?: ReactNode
      /** A glyph or avatar in the leading column. */
      leading?: ReactNode
      chips?: ReactNode
    }[]
    /** `feed`: compact, about 52 px a two-line row until a sentence wraps. `timeline`: a rail, full sentences, body and chips in full. */
    density?: 'feed' | 'timeline'
    /** The 1 px line through the leading column joining rows within a day group. Default: `density === 'timeline'`. */
    rail?: boolean
    /** Day headers (`micro` mono, muted, with the row count) or one flat list. Default `day`. */
    group?: 'day' | 'none'
    /**
     * The instant "Today" and relative times are measured from. Default: the client clock, read once
     * after mount; until then (the server render, the hydrating paint) days read as dates and a
     * `relative` time as a date-time, so server and client markup match.
     */
    now?: number | Date
    /** Overrides the `Today` / `Yesterday` / short-date header text. Without a clock yet, `now` is the day itself. */
    dayLabel?: (day: Date, now: Date) => string
    /**
     * The time column. Default `clock` when grouped by day, `date-time` when not. A function formats it
     * yourself; one returning an empty string renders no time for that row (an untimed entry).
     */
    time?: 'clock' | 'relative' | 'date-time' | ((at: Date) => string)
    /** Which end of `items` is earlier. Does not sort. Default `newest-first`. */
    order?: 'newest-first' | 'oldest-first'
    /**
     * A quiet "Show earlier (N)" control at the earlier end (bottom for newest-first, top for
     * oldest-first). With `height`, prepending (oldest-first) keeps the visible row where it is and a
     * list opens on its newest end; a content-sized list leaves scrolling to the page.
     */
    earlier?: { onLoad: () => void; loading?: boolean; remaining?: number }
    /** The list owns a scroll node of this height (modal, aside, card). Omitted: content-sized. */
    height?: number | string
    /** Renders row-shaped skeletons. */
    loading?: boolean
    /** Skeleton rows while loading. Default: the rows `items` holds now (a refetch, capped at 30), else 5. */
    loadingRows?: number
    /**
     * The empty state, an `EmptyState` in a ring-edged tile that sizes to its content (no void in a
     * bounded `height`). Default: "Nothing has happened yet" with a one-line why.
     */
    empty?: { title: string; description?: string; action?: ReactNode }
  }

const subscribeNever = (): (() => void) => () => {}

/**
 * The client clock, read once after mount through `useSyncExternalStore` (the server snapshot is
 * `null`, like `SyncButton`'s age): a server render never reads `Date.now()`, and the hydrating
 * paint matches it before React re-renders with the real clock.
 */
function useClientClock(): number | null {
  const at = useRef<number | null>(null)
  return useSyncExternalStore(
    subscribeNever,
    () => (at.current ??= Date.now()),
    () => null,
  )
}

/** Whether these rows were plain before: set while plain rows show, cleared when the rows go. */
function usePlainBefore(hasRows: boolean, windowed: boolean): boolean {
  const [plain, setPlain] = useState(false)
  const next = hasRows ? plain || !windowed : false
  if (next !== plain) setPlain(next)
  return next
}

const DEFAULT_EMPTY = {
  title: 'Nothing has happened yet',
  description: 'Events appear here as they happen.',
} as const

export function EventList({
  label = 'Events',
  items,
  density = 'feed',
  rail,
  group = 'day',
  now,
  dayLabel,
  time,
  order = 'newest-first',
  earlier,
  height,
  loading: loadingProp = false,
  loadingRows,
  empty = DEFAULT_EMPTY,
  className,
  style,
  ...rest
}: EventListProps) {
  const clock = useClientClock()
  const cardPending = useCardPending()
  const loading = loadingProp || cardPending
  // The scroll node as state, so a windowed list can wait for it (see `VirtualRows` `scrollRoot`).
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null)
  const labelId = useId()
  const nowDate = now !== undefined ? new Date(now) : clock === null ? null : new Date(clock)
  const grouped = group === 'day'
  const withRail = rail ?? density === 'timeline'
  const ctx: RowContext = {
    density,
    rail: withRail,
    lead: withRail || items.some((i) => present(i.leading)),
    timeMode: time ?? (grouped ? 'clock' : 'date-time'),
    now: nowDate,
  }
  const oldestFirst = order === 'oldest-first'
  const hasRows = !loading && items.length > 0
  const virtualised = hasRows && items.length > VIRTUALIZE_THRESHOLD
  const ownScroll = height !== undefined
  const opensAtEnd = oldestFirst && ownScroll
  const plainBefore = usePlainBefore(hasRows, virtualised)
  usePrependAnchor(scrollEl, opensAtEnd && hasRows && !virtualised, items)
  useOpenAtEnd(scrollEl, opensAtEnd && hasRows && !virtualised, items.length)
  useRowBoundary(scrollEl, opensAtEnd && hasRows && !virtualised)
  useScrolledEdge(ownScroll ? scrollEl : null)
  useHeldHeight(
    scrollEl,
    loading ? 'loading' : !hasRows ? 'none' : virtualised ? 'windowed' : 'plain',
  )

  const control =
    earlier === undefined || !hasRows ? null : (
      <div className={classes.earlier} data-end={oldestFirst ? 'top' : 'bottom'}>
        <Button
          variant="default"
          size="compact-sm"
          className={classes.earlierButton}
          loading={earlier.loading === true}
          onClick={earlier.onLoad}
        >
          {earlier.remaining === undefined ? 'Show earlier' : `Show earlier (${earlier.remaining})`}
        </Button>
      </div>
    )

  let content: ReactNode
  if (loading) {
    content = (
      <div aria-busy="true" className={classes.skeleton}>
        <VisuallyHidden>{`Loading ${label}`}</VisuallyHidden>
        <SkeletonRows
          count={skeletonRowCount(loadingRows, items.length)}
          ctx={ctx}
          grouped={grouped}
          height={height}
        />
      </div>
    )
  } else if (items.length === 0) {
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
    const groups = grouped
      ? groupByDay(items)
      : [{ day: toEventDate(items[0]?.at ?? 0), key: 'all', id: 'all#0', items }]
    // A list with no real instant has no day to name: no headers, whatever `group` says.
    const showHeaders = grouped && groups.some((g) => isValidEventDate(g.day))
    // A caller's `dayLabel` only ever sees a real day.
    const headerText = (day: Date): string =>
      !isValidEventDate(day)
        ? ''
        : dayLabel === undefined
          ? defaultDayLabel(day, nowDate)
          : dayLabel(day, nowDate ?? day)
    if (virtualised) {
      const seam = {
        rows: buildRows(groups, showHeaders, ctx, headerText),
        overscan: 8,
        estimateSize: density === 'timeline' ? 96 : 60,
        className: classes.virtual,
        anchorTo: oldestFirst ? ('end' as const) : ('start' as const),
        // The shell scrollport is never jumped: only an own scroll node opens on its newest end.
        // And only when the rows first appeared windowed: a list crossing 200 on an `earlier` load
        // does not jump to the newest end.
        initialScroll: opensAtEnd && !plainBefore ? ('end' as const) : ('start' as const),
        // Own scroll node → the seam windows against it; none → the nearest scrolling ancestor.
        ...(ownScroll && { scrollRoot: scrollEl }),
      }
      content = (
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the seam renders divs, so the list role is explicit
        <div role="list" aria-label={label}>
          <VirtualRows scroll="parent" {...seam} />
        </div>
      )
    } else {
      content = groups.map((g) => {
        // Per run (day + occurrence), so the same day can open two runs and a same-day prepend
        // does not remount the group.
        const headerId = `${labelId}-${g.id}`
        return (
          <div key={g.id} className={classes.group}>
            {showHeaders && (
              <DayHeader id={headerId} text={headerText(g.day)} count={g.items.length} as="h3" />
            )}
            <ol
              className={classes.list}
              // The explicit role is deliberate: `list-style: none` makes Safari/VoiceOver drop the implicit one.
              // oxlint-disable-next-line jsx-a11y/no-redundant-roles
              role="list"
              {...(showHeaders ? { 'aria-labelledby': headerId } : { 'aria-label': label })}
            >
              {g.items.map((item, i) => (
                <EventRow
                  key={item.id}
                  item={item}
                  ctx={ctx}
                  first={i === 0}
                  last={i === g.items.length - 1}
                  tag="li"
                />
              ))}
            </ol>
          </div>
        )
      })
    }
  }

  // The box keeps its height for rows and skeletons; an empty state sizes to its content.
  const boxed = ownScroll && (loading || items.length > 0)
  // The CSS keys the cue's wording on it: beside the control the count says "loaded".
  const hasEarlierControl = boxed && control !== null
  // `--event-list-trim` is set by `useRowBoundary`: the box gives up the remainder of a row it would cut.
  const scrollStyle: CSSProperties | undefined = boxed
    ? {
        height: `calc(${typeof height === 'number' ? `${height}px` : String(height)} - var(--event-list-trim, 0px))`,
      }
    : undefined
  return (
    <div
      {...pickDataAttributes(rest)}
      className={cx(classes.frame, className)}
      style={style}
      data-density={density}
    >
      {oldestFirst && control}
      {/* theme-allow raw-scroll-container — the list owns its scroll node when given a height, like the virtual seam. */}
      <div
        ref={setScrollEl}
        className={cx(classes.root, boxed && classes.scroll)}
        {...(hasEarlierControl && { 'data-earlier': '' })}
        style={scrollStyle}
      >
        {/* One wrapper around whatever shows, so its box is the content's box (see useHeldHeight). */}
        <div>{content}</div>
      </div>
      {!oldestFirst && control}
    </div>
  )
}

markFigureBody(EventList)
