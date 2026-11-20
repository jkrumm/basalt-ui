// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
/** Synthetic rows shaped like argo's momentum chart: a price series and a signed momentum series. */
export const seedBars = (): Bar[] =>
  Array.from({ length: 61 }, (_, i) => ({
    day: new Date(Date.UTC(2026, 8, 1 + i)),
    close: 41000 + Math.round(Math.sin(i / 6) * 4000) + i * 90,
    momentum: Math.round(Math.sin(i / 4) * 30) / 10,
  }))

// #region recipe:two-pane
import { ChartCard, Lines } from 'basalt-ui/charts'
import type { SeriesColor } from 'basalt-ui/charts'
export type Bar = { day: Date; close: number; momentum: number }
export const GROUP = 'momentum' // one cursor group for both panes
export const GUTTER = 56 // one y gutter in px for both panes
const blue = { light: 'var(--basalt-info)', dark: 'var(--basalt-info)' }
const amber = { light: 'var(--basalt-warn)', dark: 'var(--basalt-warn)' }
type Pane = { label: string; color: SeriesColor; y: (d: Bar) => number; ticks: Date[] }
const pane =
  (bars: Bar[], p: Pane) =>
  ({ height }: { height: number | 'fill' }) => (
    <Lines
      label={p.label}
      data={bars}
      x={{ value: (d: Bar) => d.day, ticks: p.ticks }}
      y={{ gutter: GUTTER }}
      cursor={GROUP}
      height={height}
      series={[{ mark: 'line', key: p.label, label: p.label, color: p.color, y: p.y }]}
    />
  )
export function TwoPane({ bars }: { bars: Bar[] }) {
  // The last tick is dropped: its label widens the reserve and moves this plot's right edge off the upper pane's.
  const ticks = bars.filter((_, i) => i % 15 === 0 && i < bars.length - 1).map((b) => b.day)
  const price = pane(bars, { label: 'Price', color: blue, y: (d) => d.close, ticks: [] })
  const momentum = pane(bars, { label: 'Momentum', color: amber, y: (d) => d.momentum, ticks })
  return (
    <ChartCard
      title="Price and momentum"
      height="tall"
      panes={[{ weight: 2, chart: price }, { chart: momentum }]}
    />
  )
}
// #endregion
