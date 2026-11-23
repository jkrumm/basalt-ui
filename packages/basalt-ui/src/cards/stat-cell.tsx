import { useContext } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { AppLink } from '../core/link'
import { OfflineLine } from '../core/offline-line'
import { resolveFrame } from '../core/phase'
import type { Empty, ErrorKind, ResolvedPhase } from '../core/phase'
import { PhaseBoundary } from '../core/phase-boundary'
import { useRetryOwner } from '../core/retry-owner'
import { useMessages } from '../core/messages/use-messages'
import { cards } from '../core/messages/cards'
import type { Box, BoxSlot } from '../core/ports'
import { DeltaBadge } from '../ui/badge'
import { CardInfo, cardVariants } from '../ui/card'
import { Meter } from '../ui/meter'
import { couldNotLoad } from '../core/could-not-load'
import type { CardTarget, StatCellProps as ContractProps, StatRow } from './contract'
import { StatusMark, formatValue, useStaleText } from './stat-card-parts'
import {
  MAX_ROWS,
  StatGroupCollapsedContext,
  StatGroupContext,
  useAboutLabel,
  warnOnce,
} from './stat-group-shared'

/**
 * The contract's `StatCellProps`. `rows` is a readonly array, so a list the page maps from data
 * passes as it is; at most four draw, and a fifth warns in development.
 */
export type StatCellProps = ContractProps

/** The chart box: the one track a cell gives a trend. */
const CHART_HEIGHT = 28

// One class string per track, written out so the scanner sees each. The figure's 4 px top padding keeps its text box (taller than its line at the display size) clear of the caption above. A track holds one fixed height
// whatever the phase, so a loading, empty or error cell is exactly as tall as a ready one. The figure
// is the card hero's size from `@regular` and a step down in a narrow container, where two cells
// share a line.
const T_CAPTION = 'row-start-1 flex h-4 min-w-0 items-center gap-1'
const T_FIGURE = 'row-start-2 flex h-8 pt-1 min-w-0 items-center gap-2 @regular:h-9'
// A solo empty cause or an error cause may wrap to more lines than the figure track is tall: the track grows with it.
const T_FIGURE_WRAP = 'row-start-2 flex min-h-8 pt-1 min-w-0 items-center gap-2 @regular:min-h-9'
// The pill and its base label share a line while they fit; a base label too wide for the cell moves whole under the pill and the track grows with it.
const T_BASE = 'row-start-3 flex min-h-6 min-w-0 flex-wrap items-center gap-x-1.5'
const T_METER = 'row-start-4 mt-1 h-8.5 min-w-0 overflow-clip'
const T_CHART = 'row-start-5 mt-1 h-7 min-w-0 overflow-clip'
const T_ROWS = [
  'row-start-6 h-5 min-w-0',
  'row-start-7 h-5 min-w-0',
  'row-start-8 h-5 min-w-0',
  'row-start-9 h-5 min-w-0',
] as const
const T_FOOT = 'row-start-10 flex h-4 min-w-0 items-center'

/** Spans the meter, chart and row tracks (4 to 9): where `empty.cause` is read. */
const SPAN_BODY = 'col-start-1 row-start-4 row-end-10 flex min-w-0 items-center gap-2'

/**
 * A strip cell is ruled on its left and top. The strip's grid sits 1 px up and left of its card,
 * which clips the first column's left rule and the first line's top rule, so a rule only ever
 * divides two cells, whatever the line breaks.
 */
const STRIP_CELL =
  'row-span-10 grid-rows-subgrid border-t border-l border-border px-(--card-edge) py-3'

const BAR = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'

const ACTION =
  'relative z-10 inline-flex h-6 shrink-0 cursor-pointer items-center rounded-ctrl border-0 bg-secondary px-2 text-xs font-medium text-foreground shadow-raised hover:bg-accent focus-ring pointer-coarse:min-h-11'

/**
 * How a meter in a cell prints its numbers when it names no `format` of its own: with the figure's
 * unit and as many fraction digits as the figure shows (two at most when the figure is no number), so
 * the meter never prints a raw float beside a rounded headline.
 */
const meterFormatOf = (
  value: StatCellProps['value'],
  unit: string | undefined,
): ((v: number) => string) => {
  const shown = typeof value === 'number' ? formatValue(value) : null
  const digits = shown === null ? undefined : (/\.(\d+)/.exec(shown)?.[1]?.length ?? 0)
  const numbers = new Intl.NumberFormat('en', {
    minimumFractionDigits: digits ?? 0,
    maximumFractionDigits: digits ?? 2,
  })
  return (v) => (unit === undefined ? numbers.format(v) : `${numbers.format(v)} ${unit}`)
}

const rowsOf = (rows: StatCellProps['rows']): StatRow[] => {
  const shown: StatRow[] = []
  for (const row of rows ?? []) if (row) shown.push(row)
  if (shown.length > MAX_ROWS) {
    warnOnce(
      'rows',
      `A StatCell holds ${shown.length} rows (over ${MAX_ROWS}). Only the first ${MAX_ROWS} draw: move the rest to a list or a table.`,
    )
  }
  return shown.slice(0, MAX_ROWS)
}

/**
 * One cell of a `StatGroup`, or a lone cell on its own tracks: a caption (icon, label, qualifier,
 * definition glyph), the figure with its verdict, the delta pill on the line under it beside the base
 * it names ("vs prior 7 days", from `delta.label`), then the meter, chart, rows and foot line it
 * declares. Inside a group its tracks are shared with its neighbours; a track a cell does
 * not declare is left empty, and one nobody declares collapses. It owns its height at every phase
 * and its loading skeleton draws the declared shape; `chart` is called only in `ready` and `stale`,
 * in a 28 px box.
 *
 * `empty` follows `ChartCard`: with a query as `phase` it takes effect only once the settled `data` is empty
 * (an empty array, or where `empty.when(data)` says so for an object result), so it is passed unconditionally;
 * with a `Phase` it applies whenever it is set. A `meter` without a `format` prints with the cell's unit and
 * as many digits as its figure shows.
 *
 * @useWhen a status bar or KPI row shows one figure with its qualifier, meter, trend and a few rows
 * @neverWhen the figure stands alone as a card (use a stat card) or the rows are the content (use a list)
 *
 * @example
 * <StatCell
 *   label="Recovery"
 *   qualifier="7 day"
 *   value={82}
 *   unit="%"
 *   status={{ tone: 'good', label: 'Optimal' }}
 *   meter={{ label: 'Recovery', value: 82, max: 100 }}
 *   rows={[{ label: 'HRV', value: '64 ms' }, { label: 'Resting', value: '48 bpm' }]}
 *   phase={query}
 * />
 */
export function StatCell(props: StatCellProps): ReactElement {
  const {
    label,
    icon: Icon,
    qualifier,
    info,
    value,
    unit,
    delta,
    status,
    sub,
    srText,
    meter,
  } = props
  const { chart } = props
  const { href, onClick, phase, empty, swatch, subMono } = props
  const variant = useContext(StatGroupContext)
  const collapsed = useContext(StatGroupCollapsedContext)
  const about = useAboutLabel()
  const resolved = resolveFrame({ phase, empty })
  const staleText = useStaleText(resolved.tag === 'stale' && resolved.refreshFailed)
  const rows = rowsOf(props.rows)
  const figure = formatValue(value ?? null)
  const hidden = srText === undefined ? undefined : true
  const spans = meter !== undefined || chart !== undefined || rows.length > 0
  const body = resolved.body
  const root = cn(
    // `isolate`: the cell's raised action stacks inside it, never over a sticky page bar.
    'relative isolate grid min-w-0 grid-cols-1',
    variant === null && 'grid-rows-[repeat(10,auto)]',
    variant === 'strip' && STRIP_CELL,
    variant === 'cards' && 'row-span-10 mb-3 grid-rows-subgrid',
    // The group draws one message over the cells: a strip keeps each caption, cards hold only their size.
    collapsed && variant === 'cards' && 'invisible',
    collapsed &&
      variant === 'strip' &&
      '[&>:not([data-slot=stat-caption]):not([data-slot=stat-target])]:invisible',
  )
  const inner = (
    <>
      {href !== undefined && <Target label={label} href={href} />}
      {onClick !== undefined && <Target label={label} onClick={onClick} />}
      <div data-slot="stat-caption" className={T_CAPTION}>
        {swatch !== undefined && (
          <span
            data-slot="stat-swatch"
            aria-hidden="true"
            className="mr-0.5 size-2 shrink-0 rounded-full"
            style={{ background: `light-dark(${swatch.light}, ${swatch.dark})` }}
          />
        )}
        {Icon !== undefined && (
          <Icon className="mr-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        {qualifier !== undefined && (
          <p className="shrink-[2] truncate text-xs text-muted-foreground">{qualifier}</p>
        )}
        {info !== undefined && (
          <CardInfo label={about(label)} className="-my-1">
            {info}
          </CardInfo>
        )}
        {resolved.tag === 'stale' && (
          <span
            aria-hidden="true"
            className="ml-auto size-1.5 shrink-0 animate-pulse rounded-full bg-muted-foreground motion-reduce:animate-none"
          />
        )}
      </div>
      {srText !== undefined && <span className="sr-only">{srText}</span>}
      <Figure
        resolved={resolved}
        figure={figure}
        unit={unit}
        status={status}
        hidden={hidden}
        solo={!spans}
        label={label}
        empty={resolved.tag === 'empty' ? resolved.empty : undefined}
        grouped={variant !== null}
        collapsed={collapsed}
      />
      {delta !== undefined && (
        <div data-slot="stat-base" aria-hidden={hidden} className={T_BASE}>
          {resolved.tag === 'loading' && (
            <>
              <div className={cn(BAR, 'h-5 w-12 shrink-0 rounded-full')} />
              {delta.label !== undefined && <div className={cn(BAR, 'h-3 w-1/3')} />}
            </>
          )}
          {body && !collapsed && (
            <>
              <DeltaBadge value={delta.value} polarity={delta.polarity} />
              {delta.label !== undefined && (
                <p className="min-w-0 text-xs text-muted-foreground">{delta.label}</p>
              )}
            </>
          )}
        </div>
      )}
      {meter !== undefined && (
        <div data-slot="stat-meter" aria-hidden={hidden} className={T_METER}>
          {resolved.tag === 'loading' ? (
            <MeterSkeleton />
          ) : (
            body && <Meter {...meter} format={meter.format ?? meterFormatOf(value, unit)} />
          )}
        </div>
      )}
      {chart !== undefined && (
        <div data-slot="stat-chart" aria-hidden={hidden} className={T_CHART}>
          {resolved.tag === 'loading' && <div className={cn(BAR, 'h-full')} />}
          {body && (
            <PhaseBoundary
              fallback={({ reset }) => <ErrorLine kind={undefined} retry={reset} compact />}
            >
              <ChartSlot
                slot={chart}
                box={{ height: CHART_HEIGHT, phase: resolved.tag === 'stale' ? 'stale' : 'ready' }}
              />
            </PhaseBoundary>
          )}
        </div>
      )}
      {rows.map((row, i) => (
        <div key={row.label} data-slot="stat-row" aria-hidden={hidden} className={T_ROWS[i]}>
          {resolved.tag === 'loading' && <RowSkeleton />}
          {body && <Row row={row} />}
        </div>
      ))}
      {resolved.tag === 'empty' && spans && !collapsed && (
        <div data-slot="stat-empty" className={SPAN_BODY}>
          <EmptyLine empty={resolved.empty} wrap />
        </div>
      )}
      {sub !== undefined && (
        <div data-slot="stat-foot" className={T_FOOT}>
          {resolved.tag === 'loading' ? (
            <div className={cn(BAR, 'h-3 w-3/4')} />
          ) : (
            <p
              data-monospace={subMono === true ? '' : undefined}
              className={cn(
                'truncate text-xs text-muted-foreground',
                subMono === true && 'font-mono tabular-nums',
              )}
            >
              {sub}
            </p>
          )}
        </div>
      )}
      {resolved.tag === 'stale' && <output className="sr-only">{staleText}</output>}
    </>
  )
  const common = {
    'data-slot': 'stat-cell',
    'data-phase': resolved.tag,
    'aria-busy': resolved.tag === 'loading' || undefined,
    role: 'group',
    'aria-label': label,
  } as const
  if (variant === 'cards') {
    // One element, so `data-slot="stat-cell"` survives: the card chrome is the `Card` class table.
    return (
      <div
        {...common}
        data-surface="card"
        className={cn(cardVariants({ flush: true }), root, 'px-(--card-edge) py-3')}
      >
        {inner}
      </div>
    )
  }
  return (
    <div {...common} className={root}>
      {inner}
    </div>
  )
}

type FigureProps = {
  resolved: ResolvedPhase
  figure: string | null
  unit: string | undefined
  status: StatCellProps['status']
  hidden: true | undefined
  /** No other track is declared, so a cause or an error is read in the figure's own track. */
  solo: boolean
  /** The cell's label: the default error text names it, as a card's title does. */
  label: string
  empty: Empty | undefined
  /** The cell sits in a `StatGroup`: a failed cell names itself and never prints a raw error text. */
  grouped: boolean
  /** The group draws one message for every cell: this figure track holds its height and says nothing. */
  collapsed: boolean
}

function Figure({
  resolved,
  figure,
  unit,
  status,
  hidden,
  solo,
  label,
  empty,
  grouped,
  collapsed,
}: FigureProps): ReactElement {
  if (collapsed && (resolved.tag === 'error' || resolved.tag === 'empty')) {
    return <div data-slot="stat-figure" aria-hidden="true" className={T_FIGURE} />
  }
  if (resolved.tag === 'loading') {
    return (
      <div data-slot="stat-figure" aria-hidden="true" className={T_FIGURE}>
        <div className={cn(BAR, 'h-6 w-20')} />
      </div>
    )
  }
  if (resolved.tag === 'offline') {
    return (
      <output data-slot="stat-figure" className={T_FIGURE}>
        <OfflineLine />
      </output>
    )
  }
  if (resolved.tag === 'error') {
    return (
      <div data-slot="stat-figure" className={T_FIGURE_WRAP}>
        <ErrorLine
          kind={resolved.kind}
          message={grouped && resolved.raw ? undefined : resolved.message}
          retry={resolved.retry}
          label={label}
        />
      </div>
    )
  }
  if (resolved.tag === 'empty' && empty !== undefined && solo) {
    return (
      <div data-slot="stat-figure" className={T_FIGURE_WRAP}>
        <EmptyLine empty={empty} wrap />
      </div>
    )
  }
  const dash = figure === null || resolved.tag === 'empty'
  return (
    <div data-slot="stat-figure" aria-hidden={hidden} className={T_FIGURE}>
      <span
        className={cn(
          'truncate text-lg font-semibold tabular-nums @regular:text-display',
          dash && 'text-muted-foreground',
        )}
      >
        {dash ? '–' : figure}
        {!dash && unit !== undefined && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
        )}
      </span>
      {resolved.tag !== 'empty' && status !== undefined && <StatusMark status={status} />}
    </div>
  )
}

/** Calls the chart slot as a component, so a throw lands in the boundary and not in the cell. */
function ChartSlot({ slot, box }: { slot: BoxSlot; box: Box }): ReactNode {
  return slot(box)
}

function Row({ row }: { row: StatRow }): ReactElement {
  const value = typeof row.value === 'number' ? formatValue(row.value) : row.value
  return (
    <div className="flex h-full min-w-0 items-center gap-2 text-xs">
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{row.label}</span>
      {row.bar !== undefined && (
        <span aria-hidden="true" className="block h-1 w-10 shrink-0 rounded-full bg-selected">
          <span
            className="block h-full rounded-full bg-muted-foreground"
            style={{ width: `${barPercent(row.bar)}%` }}
          />
        </span>
      )}
      <span
        data-monospace={row.mono === true ? '' : undefined}
        className={cn(
          'shrink-0 font-medium text-foreground tabular-nums',
          row.mono === true && 'font-mono',
        )}
      >
        {value}
      </span>
      {row.delta !== undefined && (
        <DeltaBadge
          value={row.delta.value}
          polarity={row.delta.polarity}
          className="h-4 shrink-0 px-1"
        />
      )}
    </div>
  )
}

const barPercent = (bar: { value: number; max: number }): number =>
  Number.isFinite(bar.value) && bar.max > 0
    ? Math.min(100, Math.max(0, (bar.value / bar.max) * 100))
    : 0

function RowSkeleton(): ReactElement {
  return (
    <div aria-hidden="true" className="flex h-full items-center justify-between gap-6">
      <div className={cn(BAR, 'h-3 w-1/3')} />
      <div className={cn(BAR, 'h-3 w-10')} />
    </div>
  )
}

function MeterSkeleton(): ReactElement {
  return (
    <div aria-hidden="true" className="flex h-full flex-col gap-1">
      <div className={cn(BAR, 'h-2 w-full rounded-full')} />
      <div className={cn(BAR, 'h-3 w-1/2')} />
    </div>
  )
}

export function ErrorLine({
  kind,
  message,
  retry,
  label,
  compact = false,
}: {
  kind: ErrorKind | undefined
  message?: string | undefined
  label?: string | undefined
  retry: (() => void) | undefined
  compact?: boolean
}): ReactElement {
  const t = useMessages(cards)
  const showRetry = useRetryOwner(retry)
  const text =
    kind === 'forbidden'
      ? t('cards.errorForbidden')
      : kind === 'not-found'
        ? t('cards.errorNotFound')
        : message?.trim()
          ? message
          : label?.trim()
            ? `${couldNotLoad(label)}.`
            : t('cards.errorDefault')
  return (
    <div
      role="alert"
      data-slot="stat-error"
      className={cn('flex min-w-0 items-center gap-2', compact && 'h-full')}
    >
      <p
        className={cn('min-w-0 text-xs text-foreground', compact && 'truncate')}
        title={kind === undefined && message?.trim() ? message : undefined}
      >
        {text}
      </p>
      {retry !== undefined && showRetry && (
        <button type="button" className={ACTION} onClick={retry}>
          {t('cards.retry')}
        </button>
      )}
    </div>
  )
}

/** A cell's cause wraps in its own track; a group's shared cause stays one truncated line in its banner. */
export function EmptyLine({ empty, wrap = false }: { empty: Empty; wrap?: boolean }): ReactNode {
  const t = useMessages(cards)
  const { cause, action, filtered } = empty
  return (
    <>
      <p className={cn('min-w-0 text-xs text-muted-foreground', !wrap && 'truncate')} title={cause}>
        {cause}
      </p>
      {filtered !== undefined ? (
        <button type="button" className={ACTION} onClick={filtered.reset}>
          {t('cards.clearFilters')}
        </button>
      ) : (
        action !== undefined &&
        ('href' in action ? (
          <AppLink href={action.href} className={ACTION}>
            {action.label}
          </AppLink>
        ) : (
          <button type="button" className={ACTION} onClick={action.onClick}>
            {action.label}
          </button>
        ))
      )}
    </>
  )
}

type TargetProps = { label: string } & Exclude<CardTarget, { href?: never; onClick?: never }>

/**
 * The stretched target: one transparent link or button over the whole cell, under the info glyph,
 * the retry and the action. Its focus ring is drawn inside the cell, which clips its own overflow.
 */
function Target(props: TargetProps): ReactElement {
  const className =
    'absolute inset-0 z-0 cursor-pointer rounded-ctrl border-0 bg-transparent p-0 focus-ring focus-visible:-outline-offset-2'
  if ('href' in props) {
    return (
      <AppLink
        data-slot="stat-target"
        href={props.href}
        aria-label={props.label}
        className={className}
      />
    )
  }
  return (
    <button
      data-slot="stat-target"
      type="button"
      aria-label={props.label}
      onClick={props.onClick}
      className={className}
    />
  )
}
