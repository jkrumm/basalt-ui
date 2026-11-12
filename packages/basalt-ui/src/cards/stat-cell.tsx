import { useContext } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { resolvePhase } from '../core/phase'
import type { Empty, ErrorKind, ResolvedPhase } from '../core/phase'
import { PhaseBoundary } from '../core/phase-boundary'
import { useMessages } from '../core/messages/use-messages'
import { cards } from '../core/messages/cards'
import type { Box, BoxSlot } from '../core/ports'
import { DeltaBadge } from '../ui/badge'
import { CardInfo, cardVariants } from '../ui/card'
import { Meter } from '../ui/meter'
import type { CardTarget, StatCellProps as ContractProps, StatRow } from './contract'
import { StatusMark, formatValue, useStaleText } from './stat-card-parts'
import { MAX_ROWS, StatGroupContext, useAboutLabel, warnOnce } from './stat-group-shared'

/**
 * The contract's `StatCellProps` with `rows` also held to a tuple of at most four, so a fifth row is a
 * type error and not only a dev warning. A dynamic array is sliced by the caller. (An intersection,
 * not an `Omit`: `Omit` would flatten the link-or-button union of `CardTarget`.)
 */
export type StatCellProps = ContractProps & {
  rows?: readonly [StatRow?, StatRow?, StatRow?, StatRow?]
}

/** The chart box: the one track a cell gives a trend. */
const CHART_HEIGHT = 28

// One class string per track, written out so the scanner sees each. A track holds one fixed height
// whatever the phase, so a loading, empty or error cell is exactly as tall as a ready one.
const T_CAPTION = 'row-start-1 flex h-4 min-w-0 items-center gap-1'
const T_FIGURE = 'row-start-2 flex h-8 min-w-0 items-center gap-2'
const T_METER = 'row-start-3 h-8.5 min-w-0 overflow-clip'
const T_CHART = 'row-start-4 h-7 min-w-0 overflow-clip'
const T_ROWS = [
  'row-start-5 h-5 min-w-0',
  'row-start-6 h-5 min-w-0',
  'row-start-7 h-5 min-w-0',
  'row-start-8 h-5 min-w-0',
] as const
const T_FOOT = 'row-start-9 flex h-4 min-w-0 items-center'

/** Spans the meter, chart and row tracks (3 to 8): where `empty.cause` is read. */
const SPAN_BODY = 'col-start-1 row-start-3 row-end-9 flex min-w-0 items-center gap-2'

const BAR = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'

const ACTION =
  'relative z-10 inline-flex h-6 shrink-0 cursor-pointer items-center rounded-ctrl border-0 bg-secondary px-2 text-xs font-medium text-foreground shadow-raised hover:bg-accent focus-ring pointer-coarse:min-h-11'

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
 * One cell of a `StatGroup`, or a lone cell on its own tracks: a caption (label, qualifier,
 * definition glyph), the figure with its delta and verdict, then the meter, chart, rows and foot
 * line it declares. Inside a group its tracks are shared with its neighbours; a track a cell does
 * not declare is left empty, and one nobody declares collapses. It owns its height at every phase
 * and its loading skeleton draws the declared shape; `chart` is called only in `ready` and `stale`,
 * in a 28 px box.
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
  const { label, qualifier, info, value, unit, delta, status, sub, srText, meter, chart } = props
  const { href, onSelect, phase, empty } = props
  const variant = useContext(StatGroupContext)
  const about = useAboutLabel()
  const resolved = resolvePhase({ phase, empty })
  const staleText = useStaleText(resolved.tag === 'stale' && resolved.refreshFailed)
  const rows = rowsOf(props.rows)
  const figure = formatValue(value ?? null)
  const hidden = srText === undefined ? undefined : true
  const spans = meter !== undefined || chart !== undefined || rows.length > 0
  const body = resolved.body
  const root = cn(
    'relative grid min-w-0 grid-cols-1',
    variant === null ? 'grid-rows-[repeat(9,auto)]' : 'row-span-9 mb-3 grid-rows-subgrid',
  )
  const inner = (
    <>
      {href !== undefined && <Target label={label} href={href} />}
      {onSelect !== undefined && <Target label={label} onSelect={onSelect} />}
      <div data-slot="stat-caption" className={T_CAPTION}>
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        {qualifier !== undefined && (
          <p className="shrink-[2] truncate text-xs text-muted-foreground/70">{qualifier}</p>
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
        delta={delta}
        status={status}
        hidden={hidden}
        solo={!spans}
        empty={resolved.tag === 'empty' ? resolved.empty : undefined}
      />
      {meter !== undefined && (
        <div data-slot="stat-meter" aria-hidden={hidden} className={T_METER}>
          {resolved.tag === 'loading' ? <MeterSkeleton /> : body && <Meter {...meter} />}
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
      {resolved.tag === 'empty' && spans && (
        <div data-slot="stat-empty" className={SPAN_BODY}>
          <EmptyLine empty={resolved.empty} />
        </div>
      )}
      {sub !== undefined && (
        <div data-slot="stat-foot" className={T_FOOT}>
          {resolved.tag === 'loading' ? (
            <div className={cn(BAR, 'h-3 w-3/4')} />
          ) : (
            <p className="truncate text-xs text-muted-foreground">{sub}</p>
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
        className={cn(cardVariants({ flush: true }), root, 'snap-start px-(--card-edge) py-3')}
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
  delta: StatCellProps['delta']
  status: StatCellProps['status']
  hidden: true | undefined
  /** No other track is declared, so a cause or an error is read in the figure's own track. */
  solo: boolean
  empty: Empty | undefined
}

function Figure({
  resolved,
  figure,
  unit,
  delta,
  status,
  hidden,
  solo,
  empty,
}: FigureProps): ReactElement {
  if (resolved.tag === 'loading') {
    return (
      <div data-slot="stat-figure" aria-hidden="true" className={T_FIGURE}>
        <div className={cn(BAR, 'h-6 w-20')} />
        {delta !== undefined && <div className={cn(BAR, 'h-5 w-12 rounded-full')} />}
      </div>
    )
  }
  if (resolved.tag === 'error') {
    return (
      <div data-slot="stat-figure" className={T_FIGURE}>
        <ErrorLine kind={resolved.kind} message={resolved.message} retry={resolved.retry} />
      </div>
    )
  }
  if (resolved.tag === 'empty' && empty !== undefined && solo) {
    return (
      <div data-slot="stat-figure" className={T_FIGURE}>
        <EmptyLine empty={empty} />
      </div>
    )
  }
  const dash = figure === null || resolved.tag === 'empty'
  return (
    <div data-slot="stat-figure" aria-hidden={hidden} className={T_FIGURE}>
      <span
        className={cn(
          'truncate text-lg font-semibold tabular-nums',
          dash && 'text-muted-foreground',
        )}
      >
        {dash ? '–' : figure}
        {!dash && unit !== undefined && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
        )}
      </span>
      {resolved.tag !== 'empty' && delta !== undefined && (
        <DeltaBadge
          value={delta.value}
          polarity={delta.polarity}
          {...(delta.label !== undefined && { label: delta.label })}
        />
      )}
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
          {/* theme-allow hidden-inline-style — the width is the row's data (a share of its max), not styling */}
          <span
            className="block h-full rounded-full bg-muted-foreground"
            style={{ width: `${barPercent(row.bar)}%` }}
          />
        </span>
      )}
      <span className="shrink-0 font-medium text-foreground tabular-nums">{value}</span>
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

function ErrorLine({
  kind,
  message,
  retry,
  compact = false,
}: {
  kind: ErrorKind | undefined
  message?: string | undefined
  retry: (() => void) | undefined
  compact?: boolean
}): ReactElement {
  const t = useMessages(cards)
  const text =
    kind === 'forbidden'
      ? t('cards.errorForbidden')
      : kind === 'not-found'
        ? t('cards.errorNotFound')
        : t('cards.errorDefault')
  return (
    <div
      role="alert"
      data-slot="stat-error"
      className={cn('flex min-w-0 items-center gap-2', compact && 'h-full')}
    >
      <p
        className="min-w-0 truncate text-xs text-foreground"
        title={kind === undefined && message !== undefined ? message : undefined}
      >
        {text}
      </p>
      {retry !== undefined && (
        <button type="button" className={ACTION} onClick={retry}>
          {t('cards.retry')}
        </button>
      )}
    </div>
  )
}

function EmptyLine({ empty }: { empty: Empty }): ReactNode {
  const t = useMessages(cards)
  const { cause, action, filtered } = empty
  return (
    <>
      <p className="min-w-0 truncate text-xs text-muted-foreground" title={cause}>
        {cause}
      </p>
      {filtered !== undefined ? (
        <button type="button" className={ACTION} onClick={filtered.reset}>
          {t('cards.clearFilters')}
        </button>
      ) : (
        action !== undefined &&
        ('href' in action ? (
          <a href={action.href} className={ACTION}>
            {action.label}
          </a>
        ) : (
          <button type="button" className={ACTION} onClick={action.onSelect}>
            {action.label}
          </button>
        ))
      )}
    </>
  )
}

type TargetProps = { label: string } & Exclude<CardTarget, { href?: never; onSelect?: never }>

/**
 * The stretched target: one transparent link or button over the whole cell, under the info glyph,
 * the retry and the action. Its focus ring is drawn inside the cell, which clips its own overflow.
 */
function Target(props: TargetProps): ReactElement {
  const className =
    'absolute inset-0 z-0 cursor-pointer rounded-ctrl border-0 bg-transparent p-0 focus-ring focus-visible:-outline-offset-2'
  if ('href' in props) {
    return (
      <a data-slot="stat-target" href={props.href} aria-label={props.label} className={className} />
    )
  }
  return (
    <button
      data-slot="stat-target"
      type="button"
      aria-label={props.label}
      onClick={props.onSelect}
      className={className}
    />
  )
}
