import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import type { FrameState } from '../core/phase'
import { useFormat } from '../core/format'
import { useMessages } from '../core/messages/use-messages'
import { lists } from '../core/messages/lists'
import { Card, CardBand, CardPhase, Inset } from '../ui/card'
import { BAR_BODY_HEIGHT, DEFAULT_ROWS, ScrollRegion } from './bar-list-scroll'
import type { ListRows } from './bar-list-scroll'
import type { CardTarget, FrameHead } from './contract'

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
    rows?: ListRows
    /** Formats each value. Default: the number in the provider's locale. */
    format?: (value: number) => string
  }

/** A row of body height, in `h-10` (40 px): the label line, a gap and the 4 px track. */
const ROW = 'flex h-10 w-full min-w-0 flex-col justify-center gap-1.5 rounded-ctrl px-2 -mx-2'

const TARGET =
  'cursor-pointer border-0 bg-transparent text-left text-foreground no-underline hover:bg-accent focus-ring focus-visible:-outline-offset-2'

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
 * one body height at every phase, scrolls past `rows`, and its loading skeleton draws the rows it
 * will become. Colour belongs to a verdict, so every bar is neutral.
 *
 * @useWhen a card ranks a handful of named things by one number, or splits a total into its parts (a top-N list, a breakdown that replaces a donut)
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
  const { items, max, rows = DEFAULT_ROWS, format, phase, empty } = props
  const { title, subtitle, icon, info } = props
  const f = useFormat()
  const t = useMessages(lists)
  const scale = max ?? items.reduce((top, item) => Math.max(top, item.value || 0), 0)
  const whole = isWhole(items, max)
  const show = format ?? ((n: number): string => f.number(n))
  const emptyState = empty ?? (items.length === 0 ? { cause: t('lists.noItems') } : null)
  return (
    <div data-slot="bar-list" className="@container min-w-0">
      <Card flush>
        <CardBand
          title={title}
          {...(subtitle !== undefined && { subtitle })}
          {...(icon !== undefined && { icon })}
          {...(info !== undefined && { info })}
        />
        <Inset className={cn('flex flex-col', BAR_BODY_HEIGHT[rows])}>
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
                >
                  {items.map((item, i) => (
                    <li key={item.key ?? `${item.label}-${i}`} data-slot="bar-list-row">
                      <Row
                        item={item}
                        percent={percentOf(item.value, scale)}
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
        </Inset>
      </Card>
    </div>
  )
}

type RowProps = {
  item: BarListItem
  percent: number
  value: string
  secondary: string | undefined
}

function Row({ item, percent, value, secondary }: RowProps): ReactElement {
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
      <span
        data-slot="bar-list-track"
        aria-hidden="true"
        className="block h-1 rounded-full bg-selected"
      >
        {/* theme-allow hidden-inline-style — the width is the row's data (a share of the scale), not styling */}
        <span
          data-slot="bar-list-fill"
          className="block h-full rounded-full bg-muted-foreground"
          style={{ width: `${percent}%` }}
        />
      </span>
    </>
  )
  if (item.href !== undefined) {
    return (
      <a data-slot="bar-list-target" href={item.href} className={cn(ROW, TARGET)}>
        {content}
      </a>
    )
  }
  if (item.onSelect !== undefined) {
    return (
      <button
        data-slot="bar-list-target"
        type="button"
        onClick={item.onSelect}
        className={cn(ROW, TARGET)}
      >
        {content}
      </button>
    )
  }
  return <div className={ROW}>{content}</div>
}
