import type { ReactElement } from 'react'
import { cn } from '../../core/cn'
import { resolvePhase } from '../../core/phase'
import type { ResolvedPhase } from '../../core/phase'
import type { Status } from '../../core/ports'
import { DeltaBadge } from '../../ui/badge'
import { ChartCardContext } from '../card-context'
import type { ChartCardProps, ChartFigure } from '../contract'
import { Footer, formatValue, Head, PhaseBox, SURFACE } from './chart-card-frame'
import { Legend } from './legend'

const BAR = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'

/**
 * The chart box height, a CSS class by the card's own width, so the server HTML, the first paint
 * and the hydrated page agree. `auto` is half the width between 160 and 420 px, `short` is 160, and
 * `fill` takes the card's remainder inside a card that fills its parent. Every phase draws inside
 * the same box, so a loading, empty or error card is exactly as tall as a ready one.
 */
const BOX = {
  auto: 'h-[clamp(10rem,50cqw,26.25rem)] shrink-0',
  short: 'h-40 shrink-0',
  fill: 'min-h-40 flex-1',
} as const

const DOT: Record<Status['tone'], string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  accent: 'bg-brand',
  neutral: 'bg-muted-foreground',
}

function FigureRow({ figure, loading }: { figure: ChartFigure; loading: boolean }): ReactElement {
  const { value, unit, delta, period, status } = figure
  const text = formatValue(value)
  return (
    <div data-slot="chart-figure" className="flex h-9 shrink-0 items-center gap-2">
      {loading ? (
        <>
          <div aria-hidden="true" className={cn(BAR, 'h-7 w-24')} />
          <div aria-hidden="true" className={cn(BAR, 'h-6 w-14 rounded-full')} />
        </>
      ) : (
        <>
          <span
            className={cn(
              'truncate text-display font-semibold tabular-nums',
              text === null && 'text-muted-foreground',
            )}
          >
            {text ?? '–'}
            {text !== null && unit !== undefined && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
            )}
          </span>
          {delta !== undefined && (
            <DeltaBadge
              value={delta.value}
              polarity={delta.polarity}
              {...(delta.label !== undefined && { label: delta.label })}
            />
          )}
          {period !== undefined && (
            <span className="truncate text-xs text-muted-foreground">{period}</span>
          )}
          {status !== undefined && (
            <span
              data-slot="chart-status"
              data-tone={status.tone}
              className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOT[status.tone])} />
              {status.label}
            </span>
          )}
        </>
      )}
    </div>
  )
}

/**
 * The frame every chart sits in: a header (icon, title, definition glyph, subtitle, controls, menu),
 * an inset holding the headline figure with its delta, period and verdict over the chart box, and an
 * optional footer of at most two facts. It owns the box and the phase: `chart` is a box slot called
 * only in `ready` and `stale`, in a fixed clipping box, so a taller chart cannot move the card and a
 * loading, empty or error card is as tall as a ready one. With `phase="loading"` and no `chart` it is
 * a Suspense fallback that draws the same rows. A kind draws its own legend, in the server HTML; marks
 * a page draws through the seam take theirs from `legend`, a row between the figure and the box that
 * is drawn in every phase, so loading does not move the box.
 *
 * @useWhen a metric needs a chart with a title, a headline figure, controls or a footer around it
 * @neverWhen the content is a table, a list or a board (use a data panel) or a lone figure (use a stat card)
 *
 * @example
 * <ChartCard
 *   title="Requests"
 *   subtitle="last 30 days"
 *   figure={{ value: 12840, delta: { value: '+8%', polarity: 'up-good' }, period: 'vs prior' }}
 *   phase={query}
 *   chart={(box) => <Lines height={box.height} ariaLabel="Requests per day" data={rows} x={x} series={series} />}
 * />
 */
export function ChartCard(props: ChartCardProps): ReactElement {
  const { figure, legend, footer, controls, menu, height = 'auto', chart } = props
  const resolved = resolvePhase({ phase: props.phase, empty: props.empty })
  // A Suspense fallback has no chart to call, so it can only be loading.
  const effective: ResolvedPhase = chart === undefined ? { tag: 'loading', body: false } : resolved
  const box = effective.tag === 'stale' ? 'stale' : 'ready'
  return (
    <ChartCardContext value={true}>
      <div
        data-slot="chart-card"
        data-height={height}
        className={cn('@container min-w-0', height === 'fill' && 'h-full')}
      >
        <div
          data-slot="card"
          data-surface="card"
          data-phase={effective.tag}
          className={cn(SURFACE, 'relative', height === 'fill' && 'h-full')}
        >
          <Head
            title={props.title}
            subtitle={props.subtitle}
            icon={props.icon}
            info={props.info}
            controls={controls}
            menu={menu === undefined ? undefined : menu({ height: 'fill', phase: box })}
          />
          <div
            data-slot="inset"
            data-surface="inset"
            className={cn(
              'mx-(--card-gutter) flex min-h-0 flex-col rounded-inset bg-inset px-[calc(var(--card-edge)_-_var(--card-gutter))] py-3 first:mt-(--card-gutter) last:mb-(--card-gutter)',
              height === 'fill' && 'flex-1',
            )}
          >
            {figure !== undefined && (
              <FigureRow figure={figure} loading={effective.tag === 'loading'} />
            )}
            {legend !== undefined && legend.length > 0 && (
              <div
                data-slot="chart-legend"
                className={cn('shrink-0', figure !== undefined && 'mt-2')}
              >
                <Legend entries={legend} />
              </div>
            )}
            <PhaseBox
              resolved={effective}
              chart={chart}
              className={cn(
                (figure !== undefined || (legend !== undefined && legend.length > 0)) && 'mt-2',
                BOX[height],
              )}
            />
          </div>
          <Footer facts={footer} />
        </div>
      </div>
    </ChartCardContext>
  )
}
