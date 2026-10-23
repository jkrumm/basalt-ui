import type { ReactElement } from 'react'
import { BandStrip, ChartCard, Lines } from '../../../src/charts'
import { VX } from '../../../src/tokens'

type Point = { at: Date; v: number }

const DATA: Point[] = Array.from({ length: 14 }, (_, i) => ({
  at: new Date(Date.UTC(2026, 9, 1 + i)),
  v: 40 + 12 * Math.sin(i / 2),
}))

const HOURS = Array.from({ length: 24 * 7 }, (_, i) => ({
  start: new Date(Date.UTC(2026, 9, 9) + i * 3_600_000),
  state: i % 37 === 0 ? 'down' : 'up',
}))

const body = (id: string, height = 180): ReactElement => (
  <Lines
    ariaLabel={id}
    data={DATA}
    x={(d) => d.at}
    height={height}
    series={[{ key: 'v', label: 'Value', color: VX.line, getValue: (d) => d.v }]}
  />
)

/** Wave 52: header anatomy of a headline card beside its row neighbours, and the focus tooltip. */
export function W52ChartsFixture(): ReactElement {
  return (
    <>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a 1440 content width) */}
      <div data-testid="w52-row" style={{ width: 1100 }}>
        {/* theme-allow -- a two-column card row, the shape the trial built */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ChartCard title="Availability" value="99.98%" delta={0.4} deltaPeriod="vs last month">
            {body('w52-a')}
          </ChartCard>
          <ChartCard
            title="Goal hit rate, Apr-Sep"
            facts={{ value: '4 of 6', unit: 'months', period: 'reached 28 sessions' }}
          >
            {body('w52-b')}
          </ChartCard>
        </div>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload */}
      <div data-testid="w52-plain" style={{ width: 1100 }}>
        {/* theme-allow -- a two-column card row: a short card beside a tall one (top-aligned, so the short one stays short) */}
        <div
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}
        >
          <div>
            <ChartCard title="Short card">
              {/* theme-allow -- a short fixed body: the short fold's own payload */}
              <div style={{ height: 120 }} />
            </ChartCard>
          </div>
          <ChartCard title="Tall card">{body('w52-c', 360)}</ChartCard>
        </div>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a 340px phone card) */}
      <div data-testid="w52-phone" style={{ width: 340 }}>
        <ChartCard
          title="Sessions"
          facts={{ value: '1,284', unit: 'sessions', period: 'last 30 days' }}
        >
          {body('w52-d', 160)}
        </ChartCard>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a 340px phone card) */}
      <div data-testid="w52-phone-legacy" style={{ width: 340 }}>
        <ChartCard
          title="Availability"
          value="99.982%"
          delta={0.4}
          deltaPeriod="vs previous 30 days"
        >
          {body('w52-e', 160)}
        </ChartCard>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a roomy chart, two series) */}
      <div data-testid="w52-focus-roomy" style={{ width: 'min(640px, 100%)' }}>
        <ChartCard title="Orders against target">
          <Lines
            ariaLabel="w52-focus-roomy-chart"
            data={DATA}
            x={(d) => d.at}
            height={240}
            series={[
              { key: 'v', label: 'Orders', color: VX.line, getValue: (d) => d.v },
              { key: 'tg', label: 'Target', color: VX.line, getValue: () => 45 },
            ]}
          />
        </ChartCard>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload */}
      <div data-testid="w52-focus" style={{ width: 640 }}>
        <ChartCard title="Throughput">
          <Lines
            ariaLabel="w52-focus-chart"
            data={DATA}
            x={(d) => d.at}
            height={110}
            series={[
              { key: 'v', label: 'Orders', color: VX.line, getValue: (d) => d.v },
              { key: 'avg', label: '7-day average', color: VX.line, getValue: (d) => d.v * 0.9 },
              { key: 'fc', label: 'Forecast', color: VX.line, getValue: (d) => d.v * 1.1 },
              { key: 'tg', label: 'Target', color: VX.line, getValue: () => 45 },
            ]}
          />
        </ChartCard>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a 1440 content width) */}
      <div data-testid="w52-trial" style={{ width: 1100 }}>
        {/* theme-allow -- the trial's shape: a value hero card beside a sibling with no value */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ChartCard title="Orders" value="1,284" delta={4.2} deltaPeriod="vs previous 30 days">
            {body('w52-t1')}
          </ChartCard>
          <ChartCard title="Revenue against target">{body('w52-t2')}</ChartCard>
        </div>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload (a 340px phone column) */}
      <div data-testid="w52-trial-phone" style={{ width: 340 }}>
        <ChartCard title="Orders" value="1,284" delta={4.2} deltaPeriod="vs previous 30 days">
          {body('w52-t3', 160)}
        </ChartCard>
        {/* theme-allow -- stacked cards on a phone */}
        <div style={{ height: 16 }} />
        <ChartCard title="Revenue against target">{body('w52-t4', 160)}</ChartCard>
      </div>
      {/* theme-allow -- the wrapper width IS the fixture's payload */}
      <div data-testid="w52-band" style={{ width: 900 }}>
        <ChartCard title="Line state per hour">
          <BandStrip
            ariaLabel="w52-band-chart"
            data={HOURS}
            x={(d) => d.start}
            states={[
              { key: 'up', label: 'Up', color: VX.neutral },
              { key: 'down', label: 'Outage', color: VX.status.bad },
            ]}
            getBand={(d) => ({ state: d.state })}
            height={90}
          />
        </ChartCard>
      </div>
    </>
  )
}
