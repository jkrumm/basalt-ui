// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
export type Bar = { day: Date; close: number; momentum: number }

/** Synthetic rows shaped like argo's momentum chart: a price series and a signed momentum series. */
export const seedBars = (): Bar[] =>
  Array.from({ length: 60 }, (_, i) => ({
    day: new Date(Date.UTC(2026, 8, 1 + i)),
    close: 41000 + Math.round(Math.sin(i / 6) * 4000) + i * 90,
    momentum: Math.round(Math.sin(i / 4) * 30) / 10,
  }))

// #region recipe:two-pane
import { Lines, chartCursor } from 'basalt-ui/charts'
import { useSyncExternalStore } from 'react'
const GROUP = 'momentum' // one cursor group: a hover on either pane moves the other
const GUTTER = 56 // one y gutter in px, so both panes put one day on one pixel column
const blue = { light: '#0b6bcb', dark: '#5aa9f0' }
const amber = { light: '#9a5b00', dark: '#e0a84a' }
export function TwoPane({ bars }: { bars: Bar[] }) {
  const cursor = chartCursor(GROUP)
  const at = useSyncExternalStore(cursor.subscribe, cursor.getState, () => null)
  const x = { value: (d: Bar) => d.day }
  return (
    <div className="flex flex-col gap-1" data-cursor={at ? 'on' : 'off'}>
      <Lines
        ariaLabel="Price"
        data={bars}
        x={x}
        y={{ gutter: GUTTER }}
        cursor={GROUP}
        height={180}
        series={[{ mark: 'line', key: 'close', label: 'Close', color: blue, y: (d) => d.close }]}
      />
      <Lines
        ariaLabel="Momentum"
        data={bars}
        x={x}
        y={{ gutter: GUTTER }}
        cursor={GROUP}
        height={110}
        series={[{ mark: 'line', key: 'm', label: 'Momentum', color: amber, y: (d) => d.momentum }]}
      />
    </div>
  )
}
// #endregion
