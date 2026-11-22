/**
 * The `charts-expr19-stack-values` fixture (expression cycle 19, n93 and n97): two stacked minutes charts
 * capped by a `y.domain` function, over 90 days with one 269-minute day and over the 14 days after it,
 * and a monthly stack whose unrated count is labelled on its own segment in the run that fell behind.
 * Entry of `charts-expr19-stack-values.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import { Bars } from '../../../src/charts/parts/bars'

type Day = { day: string; vigorous: number; moderate: number }
type Month = { month: string; kept: number; rejected: number; unrated: number }

/** The peak (index 47) is 238 vigorous and 31 moderate minutes: the one day past the 120-minute cap. */
const DAYS: Day[] = Array.from({ length: 90 }, (_, i) => ({
  day: 'd' + String(i).padStart(2, '0'),
  vigorous: i === 47 ? 238 : 10 + ((i * 7) % 21),
  moderate: i === 47 ? 31 : 25 + ((i * 11) % 36),
}))
const FORTNIGHT = DAYS.slice(-14)

const RUN = new Set(['Jun', 'Jul', 'Aug'])
const MONTHS: Month[] = [
  ['Dec', 120, 145, 12],
  ['Jan', 118, 148, 20],
  ['Feb', 112, 162, 31],
  ['Mar', 120, 190, 18],
  ['Apr', 125, 125, 10],
  ['May', 131, 168, 24],
  ['Jun', 6, 6, 148],
  ['Jul', 4, 4, 122],
  ['Aug', 0, 0, 110],
  ['Sep', 117, 175, 28],
  ['Oct', 140, 188, 16],
  ['Nov', 34, 60, 22],
].map(([month, kept, rejected, unrated]) => ({
  month: String(month),
  kept: Number(kept),
  rejected: Number(rejected),
  unrated: Number(unrated),
}))

const ink = { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' }
const pale = { light: 'var(--basalt-chart-3)', dark: 'var(--basalt-chart-3)' }
const mid = { light: 'var(--basalt-chart-2)', dark: 'var(--basalt-chart-2)' }

const cap = ([lo, hi]: readonly [number, number]): [number, number] => [lo, Math.min(hi, 120)]

function Minutes({ id, data }: { id: string; data: Day[] }) {
  return (
    <section data-testid={id}>
      <Bars
        label="Vigorous and moderate minutes by day"
        data={data}
        x={{ value: (d) => d.day }}
        y={{ domain: cap }}
        height={320}
        series={[
          {
            mark: 'bar',
            key: 'vigorous',
            label: 'Vigorous',
            color: ink,
            y: (d) => d.vigorous,
            values: true,
            valuesAt: 'segment',
          },
          { mark: 'bar', key: 'moderate', label: 'Moderate', color: pale, y: (d) => d.moderate },
        ]}
      />
    </section>
  )
}

function Fixture() {
  return (
    <main className="flex w-full min-w-0 flex-col gap-4 p-4 text-foreground">
      <Minutes id="n93-90" data={DAYS} />
      <Minutes id="n93-14" data={FORTNIGHT} />
      <section data-testid="n97">
        <Bars
          label="Shots per month, split into kept, rejected and unrated"
          data={MONTHS}
          x={{ value: (m) => m.month }}
          height={320}
          series={[
            { mark: 'bar', key: 'kept', label: 'Kept', color: ink, y: (m) => m.kept },
            { mark: 'bar', key: 'rejected', label: 'Rejected', color: mid, y: (m) => m.rejected },
            {
              mark: 'bar',
              key: 'unrated',
              label: 'Unrated',
              color: pale,
              y: (m) => m.unrated,
              highlight: (m) => RUN.has(m.month),
              values: (v, m) => (RUN.has(m.month) ? String(v) : ''),
              valuesAt: 'segment',
            },
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
