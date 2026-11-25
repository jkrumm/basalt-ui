import type { CSSProperties, ReactElement } from 'react'
import { cn } from '../core/cn'
import { AppLink } from '../core/link'
import { resolvePhase } from '../core/phase'
import type { Box, NavTarget } from '../core/ports'
import { markStatCard } from '../core/stat-row'
import { DeltaBadge } from '../ui/badge'
import { Card, CardPhase, Inset } from '../ui/card'
import type { StatCardProps } from './contract'
import {
  StatFooter,
  StatHead,
  StatSkeleton,
  StatusMark,
  formatValue,
  useStaleText,
} from './stat-card-parts'

/** The chart box: plot 56 plus the 16 px label row. The slot draws inside it and cannot grow it. */
const CHART_HEIGHT = 72
/** The label row the card draws itself under the plot (`axisLabels`), px. */
const LABEL_ROW = 16
/** A figure longer than this steps down a size where the card is narrower than `regular`; so does any text figure. */
const LONG_FIGURE = 10

/** The label row: start, middle and end under the plot, in the box's 16 px. */
function AxisLabels({
  labels,
}: {
  labels: NonNullable<StatCardProps['axisLabels']>
}): ReactElement {
  return (
    <div
      data-slot="stat-x-labels"
      className="flex h-4 items-end justify-between text-xs tabular-nums text-muted-foreground"
    >
      {labels.map((label, i) => (
        <span key={i} className="truncate">
          {label}
        </span>
      ))}
    </div>
  )
}

/**
 * The inset is exactly as tall as its anatomy, so a loading, empty or error card is as tall as a
 * ready one and nothing leaves an empty band under the figure: figure row 36, sub row 20 (hidden
 * below `@narrow`, and its height with it), an 8 px gap and the chart box (`height`, 72 by default), plus the
 * inset's 24 px of padding. With no chart the phase arms are one row, so they fit a box one figure row tall.
 */
const BODY_HEIGHT = {
  plain: 'h-15',
  sub: 'h-20 @max-narrow:h-15',
  chart: 'h-[calc(var(--chart-h)+68px)]',
  both: 'h-[calc(var(--chart-h)+88px)] @max-narrow:h-[calc(var(--chart-h)+68px)]',
} as const

const bodyHeight = (hasSub: boolean, hasChart: boolean): string =>
  BODY_HEIGHT[hasChart ? (hasSub ? 'both' : 'chart') : hasSub ? 'sub' : 'plain']

/**
 * The signature stat card: one shell holding a header and a footer of at most two facts, and an
 * inset one surface step down inside a 4 px gutter with the figure, its delta pill and verdict, a
 * sub line and a chart box, all on one left edge (`--card-edge`). The inset is as tall as the rows
 * the card declares, the same at every phase, and its loading skeleton draws those rows; `chart`
 * is called only in `ready` and `stale`, in a fixed box. A stale card says so at the end of the
 * figure row.
 *
 * @useWhen a page shows one headline figure with its change, verdict and trend as a card
 * @neverWhen the content is a list of rows (use a row list) or a chart with a legend (use a chart card)
 *
 * @example
 * <StatCard
 *   icon={GitMerge}
 *   title="Shipped"
 *   subtitle="vs last week"
 *   info="Merged pull requests."
 *   value={388}
 *   delta={{ value: '+12%', polarity: 'up-good' }}
 *   phase={query}
 *   chart={(box) => <Sparkline points={perDay} height={box.height} label="Shipped per day" />}
 *   axisLabels={["Mon", "Thu", "Sun"]}
 *   footer={[{ label: 'Open', value: 12 }, { label: 'Merged', value: 4 }]}
 * />
 */
export function StatCard(props: StatCardProps): ReactElement {
  const {
    title,
    value,
    unit,
    delta,
    status,
    sub,
    subMono,
    chart,
    axisLabels,
    footer,
    href,
    onClick,
  } = props
  const chartHeight = props.height ?? CHART_HEIGHT
  const { phase, empty, subtitle, icon, info, controls, menu } = props
  const figure = formatValue(value)
  const resolved = resolvePhase({ phase, empty })
  const stale = resolved.tag === 'stale' ? resolved : null
  const staleText = useStaleText(stale?.refreshFailed === true)
  return (
    <div data-slot="stat-card" className="@container h-full min-w-0">
      {/* `isolate`: the raised parts (`z-10`, `z-20`) stack inside the card, never over a sticky page bar. */}
      <Card flush className="relative isolate h-full">
        {href !== undefined && <Target label={title} href={href} />}
        {onClick !== undefined && <Target label={title} onClick={onClick} />}
        <StatHead
          title={title}
          subtitle={subtitle}
          icon={icon}
          info={info}
          controls={controls}
          menu={menu}
        />
        <Inset
          className={cn('flex flex-col', bodyHeight(sub !== undefined, chart !== undefined))}
          style={
            chart === undefined ? undefined : ({ '--chart-h': `${chartHeight}px` } as CSSProperties)
          }
        >
          <CardPhase
            phase={phase}
            empty={empty}
            skeleton={<StatSkeleton sub={sub !== undefined} chart={chart !== undefined} />}
            arms={chart === undefined ? 'line' : 'stack'}
            staleLine="body"
            className="flex flex-1 flex-col"
          >
            {(box: Box) => (
              <>
                <div data-slot="stat-figure" className="flex h-9 shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      'truncate text-display font-semibold tabular-nums',
                      (typeof value === 'string' ||
                        (figure?.length ?? 0) + (unit?.length ?? 0) > LONG_FIGURE) &&
                        '@max-regular:text-lg',
                      figure === null && 'text-muted-foreground',
                    )}
                  >
                    {figure ?? '–'}
                    {figure !== null && unit !== undefined && (
                      <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
                    )}
                  </span>
                  {delta !== undefined && (
                    <DeltaBadge value={delta.value} polarity={delta.polarity} {...labelOf(delta)} />
                  )}
                  {status !== undefined && <StatusMark status={status} />}
                  {stale !== null && (
                    <output
                      data-slot="stat-stale"
                      title={staleText}
                      className="relative z-20 ml-auto min-w-0 shrink-[4] truncate text-xs text-muted-foreground"
                    >
                      {staleText}
                    </output>
                  )}
                </div>
                {sub !== undefined && (
                  <p
                    data-slot="stat-sub"
                    data-monospace={subMono === true ? '' : undefined}
                    className={cn(
                      'm-0 h-5 shrink-0 truncate text-sm text-muted-foreground @max-narrow:hidden',
                      subMono === true && 'font-mono tabular-nums',
                    )}
                  >
                    {sub}
                  </p>
                )}
                {chart !== undefined && (
                  <div
                    data-slot="stat-chart"
                    className="relative z-20 mt-2 h-(--chart-h) shrink-0 overflow-clip"
                  >
                    {chart({
                      height:
                        axisLabels === undefined
                          ? chartHeight
                          : Math.max(0, chartHeight - LABEL_ROW),
                      phase: box.phase,
                    })}
                    {axisLabels !== undefined && <AxisLabels labels={axisLabels} />}
                  </div>
                )}
              </>
            )}
          </CardPhase>
        </Inset>
        <StatFooter
          facts={footer}
          phase={
            resolved.tag === 'loading' || resolved.tag === 'error' || resolved.tag === 'empty'
              ? resolved.tag
              : 'other'
          }
        />
      </Card>
    </div>
  )
}

markStatCard(StatCard)

const labelOf = (delta: NonNullable<StatCardProps['delta']>): { label?: string } =>
  delta.label === undefined ? {} : { label: delta.label }

type TargetProps = { label: string } & ({ href: string | NavTarget } | { onClick: () => void })

/**
 * The stretched target: one transparent link or button over the whole card, the header band and the
 * inset included, so a click on the figure, the sub line or the blank inset takes it. The info
 * glyph, the controls, the menu and the chart box (it owns focus and a tooltip) sit above it (`z-20`) and keep their own hit areas. Its focus
 * ring is drawn inside the card, because the card clips its own overflow.
 */
function Target(props: TargetProps): ReactElement {
  const className =
    'absolute inset-0 z-10 rounded-card border-0 bg-transparent p-0 focus-ring focus-visible:-outline-offset-2'
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
