import type { ReactElement } from 'react'
import { Lines } from '../../../src/charts'
import type { RefLine, XRefLine } from '../../../src/charts'
import { VX } from '../../../src/tokens'

type Point = { at: Date; v: number }

const DAY = 86_400_000
const START = Date.UTC(2026, 10, 2)
const at = (day: number): Date => new Date(START + day * DAY)

/** Twelve days, one point per half day: a success rate that stays near its target. */
const RATE: Point[] = Array.from({ length: 25 }, (_, i) => ({
  at: new Date(START + (i * DAY) / 2),
  v: 98.6 + 0.9 * Math.sin(i / 3),
}))

/** Four deploys in four days: the captions of their rules cannot all sit on one row at 390. */
const DEPLOYS: XRefLine<Date>[] = [
  { x: at(3), color: VX.faint, dashed: true, label: 'v2.9.8' },
  { x: at(4), color: VX.faint, dashed: true, label: 'v2.9.9' },
  { x: at(5), color: VX.faint, dashed: true, label: 'v2.9.10' },
  { x: at(9), color: VX.status.bad, dashed: true, label: 'v2.10.0' },
]

const TARGET: RefLine = {
  value: 99.5,
  color: VX.muted,
  dashed: true,
  label: 'Target 99.5 %',
  labelPosition: 'start-below',
}

/** The first series runs through both left spots of the line at 235 and leaves the right end clear. */
const SPEED: (Point & { up: number })[] = Array.from({ length: 30 }, (_, i) => ({
  at: new Date(START + i * DAY),
  v: 240 - 0.8 * i,
  up: 205 + 3 * Math.cos(i / 3),
}))

/** n01's shape: a 30-day run from 15 Oct that rests on 0, so the lowest y tick meets the first x tick. */
const OUTAGE: Point[] = Array.from({ length: 30 }, (_, i) => ({
  at: new Date(Date.UTC(2026, 9, 15 + i)),
  v: i % 7 === 3 ? 40 : 0,
}))

/** n06's shape: a quota that reaches its cap soon after now, so the two rules and the cap caption crowd the top. */
const QUOTA: Point[] = Array.from({ length: 13 }, (_, i) => ({
  at: new Date(Date.UTC(2026, 10, 14, 6 + i)),
  v: 8 * i + 4,
}))

const series = [{ key: 'v', label: 'Rate', color: VX.line, getValue: (d: Point) => d.v }]

/** Expression cycle 2 kit fixes, charts (`k2-chart-*`). */
export function K2KitFixture(): ReactElement {
  return (
    <>
      <div data-testid="k2-chart-rules">
        <Lines
          ariaLabel="Success rate per half day across four deploys"
          data={RATE}
          x={(d) => d.at}
          series={series}
          y={{ domain: [97, 100] }}
          xRefLines={DEPLOYS}
          refLines={[TARGET]}
        />
      </div>
      <div data-testid="k2-chart-pinned">
        <Lines
          ariaLabel="Download and upload speed against the contracted rate"
          data={SPEED}
          x={(d) => d.at}
          series={[
            { key: 'down', label: 'Download', color: VX.line, getValue: (d) => d.v },
            { key: 'up', label: 'Upload', color: VX.faint, getValue: (d) => d.up },
          ]}
          y={{ domain: [200, 260] }}
          refLines={[
            {
              value: 235,
              color: VX.muted,
              dashed: true,
              label: 'Contracted rate',
              labelPosition: 'start-above',
            },
          ]}
        />
      </div>
      <div data-testid="k2-chart-zero">
        <Lines
          ariaLabel="Minutes down per day"
          data={OUTAGE}
          x={(d) => d.at}
          series={[{ key: 'v', label: 'Down', color: VX.line, getValue: (d) => d.v }]}
          y={{ domain: [0, 60] }}
        />
      </div>
      <div data-testid="k2-chart-cap">
        <Lines
          ariaLabel="Quota used against its cap"
          data={QUOTA}
          x={(d) => d.at}
          series={[{ key: 'v', label: 'Used', color: VX.line, getValue: (d) => d.v }]}
          y={{ domain: [0, 110], ticks: [0, 50, 100], format: (v) => `${v}%` }}
          xRefLines={[
            {
              x: new Date(Date.UTC(2026, 10, 14, 15)),
              color: VX.faint,
              dashed: true,
              label: 'Now',
            },
            {
              x: new Date(Date.UTC(2026, 10, 14, 16)),
              color: VX.status.bad,
              dashed: true,
              label: 'Out',
            },
          ]}
          refLines={[{ value: 100, color: VX.faint, dashed: true, label: 'Cap' }]}
        />
      </div>
      <div data-testid="k2-chart-ticks">
        <Lines ariaLabel="Success rate per half day" data={RATE} x={(d) => d.at} series={series} />
      </div>
    </>
  )
}
