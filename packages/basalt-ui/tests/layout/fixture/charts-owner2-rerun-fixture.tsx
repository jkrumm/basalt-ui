/**
 * The `charts-owner2-rerun` fixture (`v3-owner-2-rerun-kit-fixes`): the chart shapes the owner review 2
 * rerun found wrong. Entry of `charts-owner2-rerun.layout.test.ts`, which bundles it in memory.
 *
 * Probes, each in a `data-testid` box: `or-stack` (three panels on one hour axis, the upper two with no
 * x tick labels: n04), `or-zero` (stacked bars with a day of zeros: the fleet overview) and `or-title`
 * (a chart with a y title, for the keyboard focus ring).
 */
import { createRoot } from 'react-dom/client'
import { Bars } from '../../../src/charts/parts/bars'
import { CartesianChart } from '../../../src/charts/parts/cartesian'

const HOUR_MS = 3_600_000
type Hour = { at: Date; rain: number; wind: number; temp: number }
const HOURS: readonly Hour[] = Array.from({ length: 48 }, (_, i) => ({
  at: new Date(Date.UTC(2026, 10, 6) + i * HOUR_MS),
  rain: (i * 17) % 90,
  wind: 8 + ((i * 7) % 30),
  temp: 4 + ((i * 3) % 9),
}))
const DOMAIN: readonly [Date, Date] = [HOURS[0]!.at, HOURS[47]!.at]
const SIX_HOURLY = HOURS.filter((h) => h.at.getUTCHours() % 6 === 0).map((h) => h.at)

type Day = { day: Date; ok: number; failed: number }
const DAYS: readonly Day[] = [4, 3, 0, 5, 2, 1].map((n, i) => ({
  day: new Date(Date.UTC(2026, 10, 6 + i)),
  ok: n === 0 ? 0 : n - 1,
  failed: n === 0 ? 0 : 1,
}))

const blue = { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' }
const red = { light: 'var(--basalt-chart-2)', dark: 'var(--basalt-chart-2)' }

const x = (ticks: readonly Date[]) => ({
  value: (d: Hour): Date => d.at,
  ticks,
  domain: DOMAIN,
})
const PANEL = 'min-h-0 [&>[data-basalt-chart]]:h-full'

function Fixture() {
  return (
    <main className="flex max-w-3xl min-w-0 flex-col gap-6 p-4 text-foreground">
      <section data-testid="or-stack" className="grid h-96 grid-rows-3">
        <div className={PANEL}>
          <CartesianChart
            label="Rain chance, %"
            height="fill"
            data={HOURS}
            x={x([])}
            y={{ title: 'Rain chance, %', domain: [0, 100], gutter: 40 }}
            series={[
              { mark: 'bar', key: 'rain', label: 'Rain', color: blue, y: (d: Hour) => d.rain },
            ]}
          />
        </div>
        <div className={PANEL}>
          <CartesianChart
            label="Wind, km/h"
            height="fill"
            data={HOURS}
            x={x([])}
            y={{ title: 'Wind, km/h', gutter: 40 }}
            series={[
              { mark: 'line', key: 'wind', label: 'Wind', color: blue, y: (d: Hour) => d.wind },
            ]}
          />
        </div>
        <div className={PANEL}>
          <CartesianChart
            label="Temperature, °C"
            height="fill"
            data={HOURS}
            x={x(SIX_HOURLY)}
            y={{ title: 'Temperature, °C', gutter: 40 }}
            series={[
              { mark: 'line', key: 'temp', label: 'Temp', color: blue, y: (d: Hour) => d.temp },
            ]}
          />
        </div>
      </section>
      <section data-testid="or-zero" className="h-72">
        <Bars<Day>
          label="Deploys per day"
          height="fill"
          data={DAYS}
          x={{ value: (d) => d.day }}
          layout="stacked"
          series={[
            { mark: 'bar', key: 'ok', label: 'Succeeded', color: blue, y: (d) => d.ok },
            { mark: 'bar', key: 'failed', label: 'Failed', color: red, y: (d) => d.failed },
          ]}
        />
      </section>
      <section data-testid="or-title" className="h-56">
        <CartesianChart
          label="Rain chance, %"
          height="fill"
          data={HOURS}
          x={x(SIX_HOURLY)}
          y={{ title: 'Rain chance, %', domain: [0, 100], gutter: 40 }}
          series={[
            { mark: 'bar', key: 'rain', label: 'Rain', color: blue, y: (d: Hour) => d.rain },
          ]}
        />
      </section>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
