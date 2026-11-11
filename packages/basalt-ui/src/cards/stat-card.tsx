import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import type { Box } from '../core/ports'
import { DeltaBadge } from '../ui/badge'
import { Card, CardPhase, Inset } from '../ui/card'
import type { StatCardProps } from './contract'
import { StatFooter, StatHead, StatusMark, formatValue } from './stat-card-parts'

/** The chart box: plot 56 plus the 16 px label row. The slot draws inside it and cannot grow it. */
const CHART_HEIGHT = 72

/**
 * The inset is one fixed height per anatomy, so a loading, empty or error card is exactly as tall
 * as a ready one. Content is figure row 36, sub row 20, chart box 72 and an 8 px gap, never under
 * 96 (the phase arms' floor), plus the inset's 24 px of padding.
 */
const BODY_HEIGHT = {
  plain: 'h-30',
  chart: 'h-35',
  sub: 'h-30',
  both: 'h-40',
} as const

const bodyHeight = (hasSub: boolean, hasChart: boolean): string =>
  BODY_HEIGHT[hasChart ? (hasSub ? 'both' : 'chart') : hasSub ? 'sub' : 'plain']

/**
 * The signature stat card: a header band, an inset with the figure, its verdict, a sub line and a
 * chart box, and a footer of at most two facts, all on one left edge (`--card-edge`). It owns its
 * height at every phase; `chart` is called only in `ready` and `stale`, in a fixed box.
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
 *   chart={(box) => <Sparkline series={perDay} height={box.height} ariaLabel="Shipped per day" />}
 *   footer={[{ label: 'Open', value: 12 }, { label: 'Merged', value: 4 }]}
 * />
 */
export function StatCard(props: StatCardProps): ReactElement {
  const { title, value, unit, delta, status, sub, chart, footer, href, onSelect } = props
  const { phase, empty, subtitle, icon, info, controls, menu } = props
  const figure = formatValue(value)
  return (
    <div data-slot="stat-card" className="@container min-w-0">
      <Card flush className="relative">
        {href !== undefined && <Target label={title} href={href} />}
        {onSelect !== undefined && <Target label={title} onSelect={onSelect} />}
        <StatHead
          title={title}
          subtitle={subtitle}
          icon={icon}
          info={info}
          controls={controls}
          menu={menu}
        />
        <Inset className={cn('flex flex-col', bodyHeight(sub !== undefined, chart !== undefined))}>
          <CardPhase phase={phase} empty={empty} className="flex flex-1 flex-col">
            {(box: Box) => (
              <>
                <div data-slot="stat-figure" className="flex h-9 shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      'truncate text-display font-semibold tabular-nums',
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
                </div>
                {sub !== undefined && (
                  <p
                    data-slot="stat-sub"
                    className="h-5 shrink-0 truncate text-sm text-muted-foreground @max-narrow:hidden"
                  >
                    {sub}
                  </p>
                )}
                {chart !== undefined && (
                  <div data-slot="stat-chart" className="mt-2 h-18 shrink-0 overflow-clip">
                    {chart({ height: CHART_HEIGHT, phase: box.phase })}
                  </div>
                )}
              </>
            )}
          </CardPhase>
        </Inset>
        <StatFooter facts={footer} />
      </Card>
    </div>
  )
}

const labelOf = (delta: NonNullable<StatCardProps['delta']>): { label?: string } =>
  delta.label === undefined ? {} : { label: delta.label }

type TargetProps = { label: string } & ({ href: string } | { onSelect: () => void })

/**
 * The stretched target: one transparent link or button over the whole card, under the controls.
 * Its focus ring is drawn inside the card, because the card clips its own overflow.
 */
function Target(props: TargetProps): ReactElement {
  const className =
    'absolute inset-0 z-0 cursor-pointer rounded-card border-0 bg-transparent p-0 focus-ring focus-visible:-outline-offset-2'
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
