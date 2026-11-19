// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
/** Synthetic rows shaped like argo's momentum chart: a price series and a signed momentum series. */
export const seedBars = (): Bar[] =>
  Array.from({ length: 61 }, (_, i) => ({
    day: new Date(Date.UTC(2026, 8, 1 + i)),
    close: 41000 + Math.round(Math.sin(i / 6) * 4000) + i * 90,
    momentum: Math.round(Math.sin(i / 4) * 30) / 10,
  }))

// #region recipe:two-pane
import { Lines } from 'basalt-ui/charts'
export type Bar = { day: Date; close: number; momentum: number }
export const GROUP = 'momentum' // one cursor group for both panes
export const GUTTER = 56 // one y gutter in px for both panes
const blue = { light: 'var(--basalt-info)', dark: 'var(--basalt-info)' }
const amber = { light: 'var(--basalt-warn)', dark: 'var(--basalt-warn)' }
const x = { value: (d: Bar) => d.day }
export function TwoPane({ bars }: { bars: Bar[] }) {
  // The last tick is dropped: its label widens the reserve and moves this plot's right edge off the upper pane's.
  const ticks = bars.filter((_, i) => i % 15 === 0 && i < bars.length - 1).map((b) => b.day)
  return (
    <div className="flex flex-col gap-1">
      <Lines
        label="Price"
        data={bars}
        x={{ ...x, ticks: [] }}
        y={{ gutter: GUTTER }}
        cursor={GROUP}
        height={180}
        series={[{ mark: 'line', key: 'close', label: 'Close', color: blue, y: (d) => d.close }]}
      />
      <Lines
        label="Momentum"
        data={bars}
        x={{ ...x, ticks }}
        y={{ gutter: GUTTER }}
        cursor={GROUP}
        height={110}
        series={[{ mark: 'line', key: 'm', label: 'Momentum', color: amber, y: (d) => d.momentum }]}
      />
    </div>
  )
}
// #endregion
