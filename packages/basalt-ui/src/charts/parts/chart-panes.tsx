import type { CSSProperties, ReactElement, ReactNode } from 'react'
import type { Box, BoxSlot } from '../../core/ports'
import type { ChartPane } from '../contract'
import { ServerFrameContext, useServerFrame } from '../sizing'

/** A pane's floor: the `short` chart box (`h-40`), the smallest chart the card draws alone. */
const PANE_FLOOR_PX = 160
/** The space between two panes (`gap-1`). */
const PANE_GAP_PX = 4

/** The height `count` panes need at their floors with the gaps between them, in px. */
export const panesFloorPx = (count: number): number =>
  count <= 0 ? 0 : count * PANE_FLOOR_PX + (count - 1) * PANE_GAP_PX

/**
 * The same floor as a CSS length for the card's chart box: `h-40` and `gap-1` are spacing steps, so the
 * floor is in rem and keeps the root size as the classes do.
 */
export const panesFloorCss = (count: number): string =>
  `${count <= 0 ? 0 : (count * 40 + (count - 1)) / 4}rem`

/** Calls a pane's slot as a component, so a throw lands in the card's boundary and hooks keep their order. */
function PaneSlot({ chart, phase }: { chart: BoxSlot; phase: Box['phase'] }): ReactNode {
  return chart({ height: 'fill', phase })
}

/** A weight below zero or not finite counts as none: the pane keeps no share. */
const shareOf = (weight: number | undefined): number =>
  weight === undefined ? 1 : Number.isFinite(weight) && weight > 0 ? weight : 0

/**
 * Each pane's height in a group `outer` px tall, as the column's flex lays it out: the space less the
 * gaps is split by weight, a pane whose share falls under the floor is held at it, and the others split
 * what is left by weight, until no share falls under. The group is never shorter than its floors.
 */
export function paneHeights(outer: number, weights: readonly number[]): number[] {
  const space = Math.max(outer, panesFloorPx(weights.length)) - PANE_GAP_PX * (weights.length - 1)
  const held = weights.map(() => false)
  for (;;) {
    const free = weights.reduce((sum, w, i) => (held[i] ? sum : sum + w), 0)
    const rest = space - PANE_FLOOR_PX * held.filter(Boolean).length
    const heights = weights.map((w, i) =>
      held[i] ? PANE_FLOOR_PX : free === 0 ? PANE_FLOOR_PX : (rest * w) / free,
    )
    const under = heights.findIndex((h, i) => !held[i] && h < PANE_FLOOR_PX)
    if (under === -1) return heights
    heights.forEach((h, i) => {
      if (h < PANE_FLOOR_PX) held[i] = true
    })
  }
}

/**
 * The panes of a `ChartCard` (`panes`): a column that fills the chart box, each pane taking its share
 * by `weight` above a 160 px floor (`h-40`, the `short` box) and its slot called with `height: 'fill'`,
 * 4 px apart. The card grows its box to hold every floor ({@link panesFloorCss}), so five panes at 390
 * stay readable without a floor in the page. Not exported: `ChartCard` is the one way in, so
 * `./charts` keeps its 13 value symbols (docs/v3/ARCHITECTURE.md section 3).
 */
export function ChartPanes({
  box,
  panes,
}: {
  box: Box
  panes: readonly ChartPane[]
}): ReactElement {
  const frame = useServerFrame()
  // Each pane's share of the box above its floor, the height its server picture is drawn at.
  const outer = box.height === 'fill' ? frame.height : box.height
  const heights =
    outer === undefined
      ? undefined
      : paneHeights(
          outer,
          panes.map((pane) => shareOf(pane.weight)),
        )
  const style: CSSProperties | undefined =
    box.height === 'fill'
      ? undefined
      : { height: `${Math.max(box.height, panesFloorPx(panes.length))}px` }
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
          className="min-h-40 min-w-0 basis-0 [&>[data-basalt-chart]]:h-full"
          style={{ flexGrow: shareOf(pane.weight) }}
        >
          <ServerFrameContext
            value={
              heights === undefined
                ? { width: frame.width }
                : { width: frame.width, height: heights[index]! }
            }
          >
            <PaneSlot chart={pane.chart} phase={box.phase} />
          </ServerFrameContext>
        </div>
      ))}
    </div>
  )
}
