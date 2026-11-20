import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { Box, BoxSlot } from '../../core/ports'
import type { ChartPane } from '../contract'

/** Calls a pane's slot as a component, so a throw lands in the card's boundary and hooks keep their order. */
function PaneSlot({ chart, phase }: { chart: BoxSlot; phase: Box['phase'] }): ReactNode {
  return chart({ height: 'fill', phase })
}

/** A weight below zero or not finite counts as none: the pane keeps no share. */
const shareOf = (weight: number | undefined): number =>
  weight === undefined ? 1 : Number.isFinite(weight) && weight > 0 ? weight : 0

/**
 * The panes of a `ChartCard` (`panes`): a column that fills the chart box, each pane taking its share
 * by `weight` and its slot called with `height: 'fill'`, 4 px apart. Not exported: `ChartCard` is
 * the one way in, so `./charts` keeps its 13 value symbols (docs/v3/ARCHITECTURE.md section 3).
 */
export function ChartPanes({
  box,
  panes,
}: {
  box: Box
  panes: readonly ChartPane[]
}): ReactElement {
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
