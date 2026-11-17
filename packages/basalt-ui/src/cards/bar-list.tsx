import type {
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  LiHTMLAttributes,
  PointerEvent,
  ReactElement,
} from 'react'
import { AppLink } from '../core/link'
import { cn } from '../core/cn'
import { HostTitleContext } from '../core/could-not-load'
import { resolvePhase } from '../core/phase'
import type { FrameState } from '../core/phase'
import type { ListFocus } from '../core/ports'
import { useFormat } from '../core/format'
import { useRowsShown } from '../core/rows-shown'
import { useMessages } from '../core/messages/use-messages'
import { lists } from '../core/messages/lists'
import { Card, CardBand, CardPhase, Inset } from '../ui/card'
import { BAR_BODY_HEIGHT, DEFAULT_ROWS, ScrollRegion } from './bar-list-scroll'
import type { ListRows } from './bar-list-scroll'
import type { CardTarget, FrameHead, LegendEntry } from './contract'
import { Legend } from './data-panel'

/**
 * One ranked row. A row is a link, a button or inert; never a link and a button at once. The type
 * is declared here because `src/cards/contract.ts` has no `BarList` entry yet.
 */
export type BarListItem = CardTarget & {
  /** Identity across renders; defaults to the label. */
  key?: string
  label: string
  value: number
  /** A muted second figure or word after the label (a share, a status word). */
  secondary?: string
  /**
   * The row's segments by series key (`BarListProps.series`), stacked in the series' order on the
   * list's one scale. `value` stays the printed total, so the parts sum to it.
   */
  parts?: Readonly<Record<string, number>>
}

export type BarListProps = FrameHead &
  FrameState & {
    /** Rows in display order: sort them yourself, the list does not reorder. */
    items: readonly BarListItem[]
    /**
     * The scale end every bar fills against. Default: the largest value. Pass the total of the rows
     * and the list reads as a part of a whole: each row's share prints, and the bars sum to the full
     * track.
     */
    max?: number
    /** The body holds this many rows of height at every phase; more rows scroll. Default 5. */
    bodyRows?: ListRows
    /** @deprecated Use `bodyRows`; removed in the next minor. */
    rows?: ListRows
    /** Formats each value. Default: the number in the provider's locale. */
    format?: (value: number) => string
    /**
     * A chart's focus (`useChartFocus(items, …)`): row i is `focus.items[i]`, so pass the list in the
     * same order as the chart's items. Pointing at a row focuses its item, an item focused elsewhere
     * marks its row, and the list becomes one tab stop whose arrow keys, Home, End and Escape step
     * the shared focus.
     */
    focus?: ListFocus<unknown>
    /**
     * The series a row's `parts` stack by: their order (first at the bar's start), their colour and
     * a legend row under the header. With it each row's track draws its parts in the series colours,
     * 8 px tall; without it every bar is one neutral fill.
     */
    series?: readonly LegendEntry[]
  }

/** A row of body height, in `h-10` (40 px): the label line, a gap and the 4 px track. */
const ROW = 'flex h-10 w-full min-w-0 flex-col justify-center gap-1.5 rounded-ctrl px-2 -mx-2'

const TARGET =
  'cursor-pointer border-0 bg-transparent text-left text-foreground no-underline hover:bg-accent focus-ring focus-visible:-outline-offset-2'

/** What `useChartFocus` puts on an item beyond `ListFocusItem`: the kit dims a `data-dimmed` row. */
type MarkedItem = { 'data-chart-mark'?: ''; 'data-dimmed'?: '' }

/** The row's share of a chart's focus: only the keys a list row takes (never the chart's dimming). */
function rowFocus(
  focus: ListFocus<unknown>,
  i: number,
): LiHTMLAttributes<HTMLLIElement> & {
  ref: (element: Element | null) => void
} {
  const item = focus.item(i)
  return {
    ref: item.ref,
    onPointerEnter: item.onPointerEnter,
    onPointerDown: item.onPointerDown,
    onFocus: () => focus.set(i),
    ...((item as MarkedItem)['data-chart-mark'] !== undefined && { 'data-chart-mark': '' }),
    ...((item as MarkedItem)['data-dimmed'] !== undefined && { 'data-dimmed': '' }),
    ...(item['data-focused'] !== undefined && { 'data-focused': '' }),
  } as LiHTMLAttributes<HTMLLIElement> & { ref: (element: Element | null) => void }
}

/** The list's own keys, when it is one tab stop for the shared focus. */
function listFocus(focus: ListFocus<unknown>): {
  tabIndex: 0
  onKeyDown: (event: KeyboardEvent<HTMLUListElement>) => void
  onBlur: (event: FocusEvent<HTMLUListElement>) => void
  onPointerLeave: (event: PointerEvent<HTMLUListElement>) => void
} {
  return {
    tabIndex: 0,
    onKeyDown: (event) => {
      if (event.target !== event.currentTarget) return
      const next = focus.step(event.key)
      if (next === undefined) return
      event.preventDefault()
      focus.set(next)
    },
    onBlur: (event) => {
      const to = event.relatedTarget
      if (to instanceof Node && event.currentTarget.contains(to)) return
      focus.set(null)
    },
    onPointerLeave: (event) => {
      if (event.pointerType !== 'touch') focus.set(null)
    },
  }
}

const isWhole = (items: readonly BarListItem[], max: number | undefined): boolean => {
  if (max === undefined || max <= 0) return false
  const total = items.reduce((sum, item) => sum + (Number.isFinite(item.value) ? item.value : 0), 0)
  return Math.abs(total - max) <= max * 1e-9
}

const percentOf = (value: number, scale: number): number =>
  Number.isFinite(value) && scale > 0 ? Math.min(100, Math.max(0, (value / scale) * 100)) : 0

function BarSkeleton({ rows }: { rows: number }): ReactElement {
  const bar = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'
  return (
    <div aria-hidden="true" className="flex h-full flex-col overflow-clip">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-10 shrink-0 flex-col justify-center gap-1.5">
          <div className="flex items-center justify-between gap-6">
            <div className={cn(bar, 'h-3.5 w-1/3')} />
            <div className={cn(bar, 'h-3.5 w-10')} />
          </div>
          <div className={cn(bar, 'h-1 w-full')} />
        </div>
      ))}
    </div>
  )
}

/**
 * A ranked list on one shared scale: label, a thin bar against the largest value, the value as
 * text and an optional muted second figure. Each row is a link, a button or plain text. It holds
 * one body height at every phase, scrolls past `bodyRows`, and its loading skeleton draws the rows it
 * will become. Colour belongs to a verdict, so a single bar is neutral; a row with `parts` stacks
 * them in the colours of `series`, and the name stays on its own line above the bar at every width.
 *
 * @useWhen a card ranks a handful of named things by one number, or splits a total into its parts (a top-N list, a breakdown that replaces a donut), or ranks long names by a total stacked by kind (horizontal stacked bars)
 * @neverWhen the rows have several columns to compare (use a table) or the list is a stream of things that happened (use an event list)
 *
 * @example
 * <BarList
 *   title="Top projects"
 *   subtitle="by tokens"
 *   items={[{ label: 'argo', value: 1840, href: '/argo' }, { label: 'rb', value: 920 }]}
 *   phase={query}
 * />
 */
export function BarList(props: BarListProps): ReactElement {
  const { items, max, format, phase, empty, focus, series } = props
  const rows = props.bodyRows ?? props.rows ?? DEFAULT_ROWS
  const { title, subtitle, icon, info } = props
  const f = useFormat()
  const t = useMessages(lists)
  const rowsShown = useRowsShown()
  const scale = max ?? items.reduce((top, item) => Math.max(top, item.value || 0), 0)
  const whole = isWhole(items, max)
  const show = format ?? ((n: number): string => f.number(n))
  const emptyState = empty ?? (items.length === 0 ? { cause: t('lists.noItems') } : null)
  // The body holds `rows` rows of height: past that it scrolls, and the header says how many show.
  // Only a body that is drawn says it, so the frame fills no slot before ready.
  const scrolls = items.length > rows && resolvePhase({ phase, empty: emptyState }).body
  return (
    <div data-slot="bar-list" className="@container min-w-0">
      <Card flush>
        <CardBand
          title={title}
          {...(subtitle !== undefined && { subtitle })}
          {...(icon !== undefined && { icon })}
          {...(info !== undefined && { info })}
          {...(scrolls && {
            end: (
              <span
                data-slot="bar-list-scroll-cue"
                className="text-xs whitespace-nowrap text-muted-foreground tabular-nums"
              >
                {rowsShown(rows, items.length)}
              </span>
            ),
          })}
        />
        {series !== undefined && series.length > 0 && <Legend entries={series} />}
        <Inset className={cn('flex flex-col', BAR_BODY_HEIGHT[rows])}>
          <HostTitleContext.Provider value={title}>
            <CardPhase
              phase={phase}
              empty={emptyState}
              skeleton={<BarSkeleton rows={rows} />}
              className="flex flex-1 flex-col"
            >
              {() => (
                <ScrollRegion label={title}>
                  {/* The explicit role is deliberate: `list-style: none` makes Safari drop the implicit one. */}
                  <ul
                    // oxlint-disable-next-line jsx-a11y/no-redundant-roles
                    role="list"
                    aria-label={title}
                    data-whole={whole ? '' : undefined}
                    className="m-0 list-none p-0"
                    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- with a shared focus the list is the one tab stop that steps it
                    {...(focus !== undefined && listFocus(focus))}
                  >
                    {items.map((item, i) => (
                      <li
                        key={item.key ?? `${item.label}-${i}`}
                        data-slot="bar-list-row"
                        {...(focus !== undefined && rowFocus(focus, i))}
                        className={
                          focus === undefined ? undefined : '[&[data-focused]>*]:bg-accent'
                        }
                      >
                        <Row
                          item={item}
                          percent={percentOf(item.value, scale)}
                          segments={
                            series === undefined ? undefined : segmentsOf(item, series, scale, show)
                          }
                          value={Number.isFinite(item.value) ? show(item.value) : '—'}
                          secondary={
                            item.secondary ??
                            (whole && Number.isFinite(item.value)
                              ? f.percent(item.value / scale, {
                                  maximumFractionDigits: 0,
                                })
                              : undefined)
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </ScrollRegion>
              )}
            </CardPhase>
          </HostTitleContext.Provider>
        </Inset>
      </Card>
    </div>
  )
}

/** One drawn part of a stacked row: its series, its share of the track and its value as text. */
type Segment = {
  key: string
  label: string
  color: LegendEntry['color']
  percent: number
  text: string
}

/** A row's parts in the series' order; a part that is zero, negative or not a number draws nothing. */
function segmentsOf(
  item: BarListItem,
  series: readonly LegendEntry[],
  scale: number,
  show: (n: number) => string,
): Segment[] {
  return series.flatMap((s) => {
    const value = item.parts?.[s.key]
    if (value === undefined || !Number.isFinite(value) || value <= 0) return []
    return [
      {
        key: s.key,
        label: s.label,
        color: s.color,
        percent: percentOf(value, scale),
        text: show(value),
      },
    ]
  })
}

type RowProps = {
  item: BarListItem
  percent: number
  /** Present on a stacked list: the track draws these in place of the one neutral fill. */
  segments: readonly Segment[] | undefined
  value: string
  secondary: string | undefined
}

/** The 8 px track of a stacked row: each part in its series colour, a hairline between parts. */
function StackedTrack({ segments }: { segments: readonly Segment[] }): ReactElement {
  return (
    <>
      <span
        data-slot="bar-list-track"
        data-stacked=""
        aria-hidden="true"
        className="flex h-2 overflow-clip rounded-full bg-selected"
      >
        {segments.map((s) => (
          <span
            key={s.key}
            data-slot="bar-list-segment"
            data-series={s.key}
            // The divider is a border inside the part's own width, so the parts sum to the scale.
            className="block h-full shrink-0 border-card bg-(--swatch-light) not-first:border-l dark:bg-(--swatch-dark)"
            style={
              {
                width: `${s.percent}%`,
                '--swatch-light': s.color.light,
                '--swatch-dark': s.color.dark,
              } as CSSProperties
            }
          />
        ))}
      </span>
      <span className="sr-only">{segments.map((s) => `${s.label} ${s.text}`).join(', ')}</span>
    </>
  )
}

function Row({ item, percent, segments, value, secondary }: RowProps): ReactElement {
  const content = (
    <>
      <span className="flex min-w-0 items-baseline gap-2">
        <span
          data-slot="bar-list-label"
          className="min-w-0 flex-1 truncate text-sm"
          title={item.label}
        >
          {item.label}
        </span>
        {secondary !== undefined && (
          <span data-slot="bar-list-secondary" className="shrink-0 text-xs text-muted-foreground">
            {secondary}
          </span>
        )}
        <span data-slot="bar-list-value" className="shrink-0 text-sm font-medium tabular-nums">
          {value}
        </span>
      </span>
      {segments === undefined ? (
        <span
          data-slot="bar-list-track"
          aria-hidden="true"
          className="block h-1 rounded-full bg-selected"
        >
          <span
            data-slot="bar-list-fill"
            className="block h-full rounded-full bg-muted-foreground"
            style={{ width: `${percent}%` }}
          />
        </span>
      ) : (
        <StackedTrack segments={segments} />
      )}
    </>
  )
  if (item.href !== undefined) {
    return (
      <AppLink data-slot="bar-list-target" href={item.href} className={cn(ROW, TARGET)}>
        {content}
      </AppLink>
    )
  }
  if (item.onClick !== undefined) {
    return (
      <button
        data-slot="bar-list-target"
        type="button"
        onClick={item.onClick}
        className={cn(ROW, TARGET)}
      >
        {content}
      </button>
    )
  }
  return <div className={ROW}>{content}</div>
}
