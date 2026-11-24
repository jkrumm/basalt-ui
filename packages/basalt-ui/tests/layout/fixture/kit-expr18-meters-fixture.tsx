/**
 * Expression cycle 18, the contract row (`v3-expr-18-contract`): the round-0 shapes of n87, n90, n91
 * and n92 on the new fields. n92's four zoned pair meters draw their healthy range as `ticks` and their
 * reason as `cause`, and join one `useChartFocus` through the seam (the list spreads `focus.target`,
 * each `Meter` `focus.item(i)`), read by the card's `sub` (`k18-pairs`, `k18-balance`). n87's and
 * n91's meters print a `caption` (`k18-cells`); n90's held step id is a mono `StatRow` value and
 * n87's last reindex a mono summary fact (`k18-summary`). Entry of `kit-expr18-meters.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { StatCard } from '../../../src/cards/stat-card'
import { StatCell } from '../../../src/cards/stat-cell'
import { useChartFocus } from '../../../src/charts'
import type { MeterZone } from '../../../src/core/ports'
import { PageSummary } from '../../../src/page/page-summary'
import { Meter } from '../../../src/ui/meter'

type Pair = { name: string; ratio: number; range: readonly [number, number]; cause: string }
const PAIRS: readonly Pair[] = [
  { name: 'Pull-up to bodyweight', ratio: 0.12, range: [0.4, 0.7], cause: '70 % under 0.40' },
  { name: 'Deadlift to squat', ratio: 1.5, range: [1, 1.25], cause: '20 % over 1.25' },
  { name: 'Squat to bench', ratio: 1.12, range: [1.2, 1.5], cause: '7 % under 1.20' },
  { name: 'Deadlift to bench', ratio: 1.68, range: [1.5, 2], cause: 'Inside its range' },
]

const two = (v: number): string => v.toFixed(2)

/** n92's seven zones around a healthy range: critical, imbalanced and borderline on either side. */
function zonesOf([lo, hi]: readonly [number, number]): {
  min: number
  max: number
  zones: [MeterZone, MeterZone, ...MeterZone[]]
} {
  return {
    min: lo * 0.5,
    max: hi * 1.5,
    zones: [
      { to: lo * 0.7, tone: 'bad', label: 'Critical, below' },
      { to: lo * 0.85, tone: 'bad', label: 'Imbalanced, below' },
      { to: lo, tone: 'warn', label: 'Borderline, below' },
      { to: hi, tone: 'neutral', label: 'Balanced' },
      { to: hi * 1.15, tone: 'warn', label: 'Borderline, above' },
      { to: hi * 1.3, tone: 'bad', label: 'Imbalanced, above' },
      { to: Infinity, tone: 'bad', label: 'Critical, above' },
    ],
  }
}

function Pairs(): ReactElement {
  const focus = useChartFocus(PAIRS, { announce: (p) => `${p.name}: ${two(p.ratio)}` })
  return (
    <section className="grid gap-3 @container">
      <div data-testid="k18-balance">
        <StatCard
          title="Balanced pairs"
          value={1}
          unit="of 4"
          sub={focus.readout(
            'Furthest out: Pull-up to bodyweight',
            (p) => `${p.name}, ${two(p.ratio)}`,
          )}
          phase="ready"
        />
      </div>
      <ul
        data-testid="k18-pairs"
        aria-label="Pair ratios"
        {...focus.target}
        className="m-0 grid list-none gap-3 p-0"
      >
        {PAIRS.map((pair, i) => (
          <li key={pair.name} className="flex flex-col gap-1">
            <span className="text-sm font-medium">{pair.name}</span>
            <Meter
              {...focus.item(i)}
              label={pair.name}
              value={pair.ratio}
              {...zonesOf(pair.range)}
              ticks={pair.range}
              cause={pair.cause}
              format={two}
            />
          </li>
        ))}
      </ul>
      {focus.live}
    </section>
  )
}

function Cells(): ReactElement {
  return (
    <section data-testid="k18-cells" className="grid gap-3 @regular:grid-cols-3">
      <StatCell
        title="Sidecar errors"
        value={150}
        meter={{ label: 'Listed', value: 100, max: 150, caption: 'of 150 listed' }}
        phase="ready"
      />
      <StatCell
        title="Still to bill"
        value="US$7.01"
        meter={{
          label: 'Pass progress by cost',
          value: 13.89,
          max: 20.9,
          format: (v) => `US$${v.toFixed(2)}`,
          caption: 'spent',
        }}
        phase="ready"
      />
      <StatCell
        title="Time on hold"
        value={47}
        unit="min"
        rows={[
          { label: 'Step', value: 'integration-api', mono: true },
          { label: 'Disagreements', value: 2 },
        ]}
        phase="ready"
      />
    </section>
  )
}

function Fixture(): ReactElement {
  return (
    <main className="grid content-start gap-4 p-4 text-foreground">
      <div data-testid="k18-summary">
        <PageSummary
          sentence="12 finals not backed up"
          facts={[
            '37 orphaned raws',
            { label: 'Last reindex', value: '21 Nov 2026, 6:10', mono: true },
          ]}
        />
      </div>
      <span data-testid="k18-mono-ref" className="font-mono">
        ref
      </span>
      <Cells />
      <Pairs />
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
