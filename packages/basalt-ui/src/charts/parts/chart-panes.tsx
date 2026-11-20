import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { Box, BoxSlot } from '../../core/ports'
import type { ChartPanesProps } from '../contract'

/** Calls a pane's slot as a component, so a throw lands in the card's boundary and hooks keep their order. */
function PaneSlot({ chart, phase }: { chart: BoxSlot; phase: Box['phase'] }): ReactNode {
  return chart({ height: 'fill', phase })
}

/** A weight below zero or not finite counts as none: the pane keeps no share and draws nothing. */
const shareOf = (weight: number | undefined): number =>
  weight === undefined ? 1 : Number.isFinite(weight) && weight > 0 ? weight : 0

/**
 * Charts stacked on one x inside one box: each pane takes its share of the box by `weight`, so a
 * `ChartCard` with two or three panes needs no pixel height per pane or per size class. Each pane's
 * slot is called with `height: 'fill'`. The panes sit 4 px apart; a shared cursor group, one
 * `y.gutter` and `x.ticks: []` on every pane but the bottom stay the page's (the two-pane recipe).
 *
 * @useWhen two or three charts share one x inside one `ChartCard` (a price over a momentum line, a score over its drivers)
 * @neverWhen the charts answer different questions: give each its own `ChartCard` in a `CardGrid`
 *
 * @example
 * <ChartCard title="Recovery" height="tall" chart={(box) => (
 *   <ChartPanes box={box} panes={[
 *     { weight: 2, chart: (pane) => <Lines height={pane.height} label="Score" ... /> },
 *     { chart: (pane) => <Lines height={pane.height} label="HRV" ... /> },
 *   ]} />
 * )} />
 */
export function ChartPanes({ box, panes }: ChartPanesProps): ReactElement {
  const style: CSSProperties | undefined =
    box.height === 'fill' ? undefined : { height: `${Math.max(0, box.height)}px` }
  return (
    <div
      data-slot="chart-panes"
      className={
        box.height === 'fill' ? 'flex h-full min-h-0 flex-col gap-1' : 'flex min-h-0 flex-col gap-1'
      }
      style={style}
    >
      {panes.map((pane, index) => (
        <div
          // oxlint-disable-next-line react/no-array-index-key -- a pane is its position in the stack; panes are never reordered
          key={index}
          data-slot="chart-pane"
          className="min-h-0 min-w-0 basis-0 [&>[data-basalt-chart]]:h-full"
          style={{ flexGrow: shareOf(pane.weight) }}
        >
          <PaneSlot chart={pane.chart} phase={box.phase} />
        </div>
      ))}
    </div>
  )
}
