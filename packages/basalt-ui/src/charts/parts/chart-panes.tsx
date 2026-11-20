import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { Box, BoxSlot } from '../../core/ports'
import type { ChartPane } from '../contract'
import { ServerFrameContext, useServerFrame } from '../sizing'

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
  const frame = useServerFrame()
  // Each pane's share of the box, the height its server picture is drawn at (4 px gaps between).
  const outer = box.height === 'fill' ? frame.height : box.height
  const total = panes.reduce((sum, pane) => sum + shareOf(pane.weight), 0)
  const paneFrame = (weight: number | undefined): typeof frame =>
    outer === undefined || total === 0
      ? { width: frame.width }
      : {
          width: frame.width,
          height: (Math.max(0, outer - 4 * (panes.length - 1)) * shareOf(weight)) / total,
        }
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
          <ServerFrameContext value={paneFrame(pane.weight)}>
            <PaneSlot chart={pane.chart} phase={box.phase} />
          </ServerFrameContext>
        </div>
      ))}
    </div>
  )
}
