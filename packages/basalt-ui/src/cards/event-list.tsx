import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { useFormat } from '../core/format'
import { useIntl } from '../core/provider-props'
import { lists } from '../core/messages/lists'
import { useMessages } from '../core/messages/use-messages'
import type { FrameState } from '../core/phase'
import type { IconComponent } from '../core/ports'
import { Avatar } from '../ui/avatar'
import { Card, CardBand, CardPhase, Inset } from '../ui/card'
import { bodyHeight, listRows, ScrollRegion } from './bar-list-scroll'
import type { ListRows } from './bar-list-scroll'
import type { FrameHead } from './contract'
import {
  groupByDay,
  isInstant,
  isLongBody,
  periodOf,
  toInstant,
  warnLargeFeed,
} from './event-list-model'
import type { Period } from './event-list-model'
import { usePeriodLabel } from './period-label'

/** Who did it, with a face: the name prints beside it, the face is drawn in the lead column. */
export type EventActor = {
  name: string
  /** An image URL; until it loads, and if it fails, the initials or the icon stay. */
  src?: string
  icon?: IconComponent
  /** `person` (default) is a circle, `object` a rounded square: a system or a company. */
  shape?: 'person' | 'object'
}

/** One event. Declared here because `src/cards/contract.ts` has no `EventList` entry yet. */
export type EventListItem = {
  /** The row's identity: unique and stable. */
  id: string
  at: Date | number
  /** A name, or a name with a face (an `Avatar` leads the row, in place of `icon`). */
  actor?: string | EventActor
  /** What happened, one line; it truncates, never wraps. */
  title: string
  body?: string
  icon?: IconComponent
  chips?: readonly string[]
}

export type EventListProps = FrameHead &
  FrameState & {
    /** Events in display order: the list never re-sorts. */
    items: readonly EventListItem[]
    /** The body holds this many rows of height at every phase; more rows scroll. Default 5. */
    bodyRows?: ListRows
    /** Rows shown before, and added by each "Show more". Default 25. */
    pageSize?: number
    /**
     * How the feed is headed: `day` (default) is one header per day, Today and Yesterday first;
     * `period` is This week, Earlier this month, then each month by name and each earlier year.
     */
    group?: 'day' | 'period'
    /** The first day of the week for `group="period"`, 0 for Sunday. Default 1, Monday. */
    weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
    /**
     * The instant "Today" is measured from. Default: the client clock, read once after mount; until
     * then days read as dates, so the server markup and the hydrating paint match.
     */
    now?: Date | number
  }

const DEFAULT_PAGE = 25

const subscribeNever = (): (() => void) => () => {}

/** The client clock, read once after mount: a server render never reads `Date.now()`. */
function useClientClock(): number | null {
  const at = useRef<number | null>(null)
  return useSyncExternalStore(
    subscribeNever,
    () => (at.current ??= Date.now()),
    () => null,
  )
}

const BAR = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'

const FOLD =
  'relative shrink-0 cursor-pointer border-0 bg-transparent p-0 text-micro font-medium text-muted-foreground hover:text-foreground focus-ring after:absolute after:-inset-2 pointer-coarse:after:-inset-3'

/** The face an actor draws: an object is a name with a face, a string is a name alone. */
const faceOf = (actor: EventListItem['actor']): EventActor | undefined =>
  typeof actor === 'object' ? actor : undefined

const MORE =
  'relative inline-flex h-6 cursor-pointer items-center rounded-ctrl border-0 bg-secondary px-2 text-xs font-medium text-foreground shadow-raised hover:bg-accent focus-ring after:absolute after:inset-x-0 after:top-1/2 after:h-full after:-translate-y-1/2 pointer-coarse:after:min-h-11'

function EventSkeleton({ rows }: { rows: number }): ReactElement {
  return (
    <div aria-hidden="true" className="flex h-full flex-col overflow-clip">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-14 shrink-0 items-start gap-3 py-1.5">
          <div className={cn(BAR, 'size-5 rounded-full')} />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className={cn(BAR, 'h-3.5 w-2/3')} />
            <div className={cn(BAR, 'h-3 w-1/3')} />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * A feed of things that happened, headed by day or (`group="period"`) by This week, Earlier this month,
 * month and year: a leading glyph or the actor's face joined to the next entry by a connector, the
 * actor and a sentence on line one, the time, a body and chips on line two. A long body folds to one
 * line with an expander. It reads in order; a table compares rows. It holds one
 * body height at every phase and scrolls past `bodyRows`. It never windows: it shows `pageSize` rows
 * and a "Show more" control, and warns once in development above 200 rows.
 *
 * @useWhen a card lists activity, history or an audit trail in the order it happened
 * @neverWhen the rows are compared by columns (use a table) or ranked by one number (use a bar list)
 *
 * @example
 * <EventList
 *   title="Activity"
 *   items={[{ id: 'e1', at: Date.now(), actor: 'Ada', title: 'merged #482', chips: ['main'] }]}
 *   phase={query}
 * />
 */
export function EventList(props: EventListProps): ReactElement {
  const { items, pageSize = DEFAULT_PAGE, now, phase, empty } = props
  const rows = listRows(props.bodyRows)
  const { title, subtitle, icon, info } = props
  const f = useFormat()
  const { timeZone } = useIntl()
  const t = useMessages(lists)
  const label = usePeriodLabel()
  const labelId = useId()
  const clock = useClientClock()
  const [pages, setPages] = useState(1)
  useEffect(() => warnLargeFeed(items.length), [items.length])

  const today = now !== undefined ? toInstant(now) : clock === null ? null : new Date(clock)
  const dayOf = (at: Date): string => f.date(at, 'short')
  const shown = items.slice(0, pageSize * pages)
  const remaining = items.length - shown.length
  // Period headings need a "now": until the client clock is read they read as dates, as days do.
  const byPeriod = props.group === 'period' && today !== null
  const periodFor = (at: Date): Period =>
    periodOf(at, today ?? at, {
      timeZone,
      days: false,
      ...(props.weekStartsOn !== undefined && { weekStartsOn: props.weekStartsOn }),
    })
  const groups = groupByDay(shown, byPeriod ? (at) => periodFor(at).key : dayOf)
  const headed = groups.some((g) => isInstant(g.day))
  const lead = items.some((item) => item.icon !== undefined || faceOf(item.actor) !== undefined)
  const yesterday = today === null ? null : new Date(today.getTime() - 86_400_000)
  const heading = (day: Date): string => {
    if (byPeriod) return label(periodFor(day), day)
    if (today !== null && dayOf(day) === dayOf(today)) return label(periodOf(day, day), day)
    if (yesterday !== null && dayOf(day) === dayOf(yesterday)) {
      return label(periodOf(day, new Date(day.getTime() + 86_400_000)), day)
    }
    return `${f.date(day, 'weekday')}, ${f.date(day, 'short')}`
  }
  const emptyState = empty ?? (items.length === 0 ? { cause: t('lists.noEvents') } : null)

  return (
    <div data-slot="event-list" className="@container min-w-0">
      <Card flush>
        <CardBand
          title={title}
          {...(subtitle !== undefined && { subtitle })}
          {...(icon !== undefined && { icon })}
          {...(info !== undefined && { info })}
        />
        <Inset className="flex grow flex-col" style={bodyHeight(rows, 14)}>
          <CardPhase
            phase={phase}
            empty={emptyState}
            skeleton={<EventSkeleton rows={rows} />}
            className="flex flex-1 flex-col"
          >
            {() => (
              <ScrollRegion label={title}>
                {groups.map((g) => {
                  const headerId = `${labelId}-${g.id}`
                  return (
                    <section key={g.id} data-slot="event-list-day">
                      {headed && (
                        <h3
                          id={headerId}
                          data-slot="event-list-header"
                          className="sticky top-0 z-10 m-0 flex h-6 items-center gap-1 bg-inset text-micro font-medium text-muted-foreground"
                        >
                          {isInstant(g.day) ? heading(g.day) : ''}
                          <span className="font-normal">
                            · {t('lists.eventCount', g.items.length)}
                          </span>
                        </h3>
                      )}
                      <ol
                        // The explicit role is deliberate: `list-style: none` makes Safari drop the implicit one.
                        // oxlint-disable-next-line jsx-a11y/no-redundant-roles
                        role="list"
                        {...(headed ? { 'aria-labelledby': headerId } : { 'aria-label': title })}
                        className="m-0 list-none p-0"
                      >
                        {g.items.map((item, i) => (
                          <Row
                            key={item.id}
                            item={item}
                            lead={lead}
                            first={i === 0}
                            dated={byPeriod}
                            last={i === g.items.length - 1}
                          />
                        ))}
                      </ol>
                    </section>
                  )
                })}
                {remaining > 0 && (
                  <div className="flex justify-center py-2">
                    <button
                      type="button"
                      data-slot="event-list-more"
                      className={MORE}
                      onClick={() => setPages((n) => n + 1)}
                    >
                      {t('lists.showMore', remaining)}
                    </button>
                  </div>
                )}
              </ScrollRegion>
            )}
          </CardPhase>
        </Inset>
      </Card>
    </div>
  )
}

function Row({
  item,
  lead,
  first,
  last,
  dated,
}: {
  item: EventListItem
  lead: boolean
  first: boolean
  last: boolean
  /** The time carries its day: a period heading names a span, not a day. */
  dated: boolean
}): ReactElement {
  const f = useFormat()
  const t = useMessages(lists)
  const bodyId = useId()
  const [open, setOpen] = useState(false)
  const at = toInstant(item.at)
  const valid = isInstant(at)
  const Icon = item.icon
  const face = faceOf(item.actor)
  const name = typeof item.actor === 'string' ? item.actor : item.actor?.name
  const folds = item.body !== undefined && isLongBody(item.body)
  return (
    <li
      data-slot="event-list-row"
      data-event-id={item.id}
      className="relative flex min-h-14 items-start gap-3 py-1.5"
    >
      {lead && (
        <>
          {/* The rail runs behind the lead column, 2 px clear of each face: one line per group. */}
          {!first && (
            <span
              aria-hidden="true"
              data-slot="event-list-connector"
              className="absolute top-0 left-[9.5px] h-1 w-px bg-border"
            />
          )}
          {!last && (
            <span
              aria-hidden="true"
              data-slot="event-list-connector"
              className="absolute top-7 bottom-0 left-[9.5px] w-px bg-border"
            />
          )}
          <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
            {face !== undefined ? (
              <Avatar
                size="sm"
                name={face.name}
                aria-hidden="true"
                {...(face.src !== undefined && { src: face.src })}
                {...(face.icon !== undefined && { icon: face.icon })}
                {...(face.shape !== undefined && { shape: face.shape })}
              />
            ) : (
              Icon !== undefined && <Icon className="size-icon" aria-hidden="true" />
            )}
          </span>
        </>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span data-slot="event-list-line" className="truncate text-sm">
          {name !== undefined && <span className="font-medium">{name} </span>}
          {item.title}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <time
            data-slot="event-list-time"
            className="shrink-0 tabular-nums"
            {...(valid && { dateTime: at.toISOString() })}
          >
            {valid ? (dated ? `${f.date(at, 'day')}, ${f.time(at)}` : f.time(at)) : '—'}
          </time>
          {item.body !== undefined && !folds && (
            <span data-slot="event-list-body" className="min-w-0 truncate">
              {item.body}
            </span>
          )}
          {item.chips?.map((chip) => (
            <span
              key={chip}
              data-slot="event-list-chip"
              className="shrink-0 rounded-chip bg-selected px-1.5 text-micro text-foreground"
            >
              {chip}
            </span>
          ))}
        </span>
        {item.body !== undefined && folds && (
          <span className="flex min-w-0 items-baseline gap-2 text-xs text-muted-foreground">
            <span
              id={bodyId}
              data-slot="event-list-body"
              data-folded={open ? undefined : ''}
              className={cn('min-w-0 flex-1', open ? 'whitespace-pre-line' : 'truncate')}
            >
              {item.body}
            </span>
            <button
              type="button"
              data-slot="event-list-fold"
              aria-expanded={open}
              aria-controls={bodyId}
              className={FOLD}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? t('lists.collapseBody') : t('lists.expandBody')}
            </button>
          </span>
        )}
      </span>
    </li>
  )
}
