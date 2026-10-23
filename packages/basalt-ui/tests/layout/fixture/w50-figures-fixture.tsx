import type { ReactElement } from 'react'
import { Sparkline } from '../../../src/charts'
import { Meter, StatCard, StatGroup } from '../../../src/index'
import { VX } from '../../../src/tokens'

const kg = (v: number): string => `${v.toFixed(1)} kg`
const FLAT = [
  { at: 72.3, color: VX.line },
  { at: 78.9, color: VX.line },
]

const INK = [
  { at: 72.3, color: VX.ink },
  { at: 78.9, color: VX.ink },
]

const LIGHT = [
  { at: 72.3, color: VX.surface.subtle },
  { at: 78.9, color: VX.surface.subtle },
]

const weight = (tone: 'muted' | 'ink' | 'light', value: number) => (
  <Meter
    label="Current weight within the window's lowest and highest weigh-in"
    value={value}
    min={72.3}
    max={78.9}
    format={kg}
    readingAt="start"
    stops={tone === 'muted' ? FLAT : tone === 'light' ? LIGHT : INK}
    startCaption={`low ${kg(72.3)}`}
    endCaption={`high ${kg(78.9)}`}
    tone={tone === 'muted' ? 'muted' : 'ink'}
  />
)

const DAY_MS = 86_400_000
const LAST = Date.UTC(2026, 9, 19)
/** Twelve weekly points, oldest first (S5's `{ at, value }` shape). */
const weekly = (values: readonly number[]) =>
  values.map((value, i) => ({ at: LAST - (values.length - 1 - i) * 7 * DAY_MS, value }))
const WEEKS = [
  [2, 3, 1, 4, 3, 2, 5, 3, 4, 2, 3, 4],
  [3.2, 3.5, 3.1, 3.8, 4, 3.6, 4.1, 4.3, 3.9, 4.4, 4.2, 4.5],
  [60, 95, 20, 120, 80, 45, 150, 90, 110, 40, 75, 100],
  [1, 0, 2, 3, 1, 2, 4, 2, 3, 1, 2, 3],
] as const
const SQUAT = [142.5, 140, 136, 138, 134, 131, 133, 129, 127, 130]
const PRESS = [58, 60, 59, 62, 64, 63, 66, 67, 69, 71]

const cell = (visual: ReactElement) => ({
  key: 'weight',
  caption: 'Weight',
  value: '75.0',
  unit: 'kg',
  visual,
})

/** Wave 50: the S7 body nesting (a one-cell strip stating `cols={2}`) and the Meter reading tick. */
export function W50FiguresFixture(): ReactElement {
  return (
    <>
      <div data-testid="w50-one-cell">
        <StatGroup variant="strip" label="Body" cols={2} cells={[cell(weight('muted', 72.3))]} />
      </div>
      <div data-testid="w50-mean">
        <StatGroup
          variant="strip"
          label="Learning"
          cols={4}
          cells={WEEKS.map((data, i) => ({
            key: `k${i}`,
            caption: ['Sessions', 'Rating', 'Minutes', 'Reviews'][i] ?? 'x',
            qualifier: 'last 12 weeks',
            value: String(data.at(-1)),
            visual: (
              <Sparkline
                ariaLabel="Per week"
                data={weekly(data)}
                height={28}
                reference="mean"
                referenceLabel="12 wk mean"
              />
            ),
          }))}
        />
      </div>
      <div data-testid="w50-pr">
        <StatGroup
          variant="strip"
          label="Lifts"
          cols={2}
          cells={[SQUAT, PRESS].map((data, i) => ({
            key: `l${i}`,
            caption: i === 0 ? 'Squat' : 'Overhead press',
            qualifier: 'last 10 sessions',
            value: String(data.at(-1)),
            unit: 'kg e1RM',
            visual: (
              <Sparkline
                ariaLabel="e1RM"
                data={data}
                height={28}
                reference={Math.max(...data)}
                referenceLabel="PR"
              />
            ),
          }))}
        />
      </div>
      <div data-testid="w50-kickers">
        <StatGroup
          variant="strip"
          label="Kickers"
          cols={4}
          cells={[
            ['Sessions', 'logged', '212'],
            ['Rating', 'mean, last 12 weeks', '4.4'],
            ['Minutes', 'per week', '1,310'],
            ['Reviews', 'due soon', '3'],
          ].map(([caption, qualifier, value], i) => ({
            key: `q${i}`,
            caption: caption as string,
            qualifier: qualifier as string,
            value: value as string,
          }))}
        />
      </div>
      <div data-testid="w50-under">
        <StatGroup
          variant="strip"
          label="Body"
          cols={3}
          cells={[
            { key: 'weight', caption: 'Weight', value: '75.0', unit: 'kg' },
            { key: 'fat', caption: 'Body fat', value: '18', unit: '%' },
            { key: 'lean', caption: 'Lean', value: '59', unit: 'kg' },
          ]}
          footer={[{ key: 'goal', under: 'weight', content: 'Set a goal weight' }]}
        />
      </div>
      <div data-testid="w50-bleed" style={{ width: 300 }}>
        <StatCard
          title="Sessions"
          value="12"
          subtitle="Since 3 Aug"
          sparkline={(size) => <Sparkline ariaLabel="Per week" data={weekly(WEEKS[0])} {...size} />}
        />
      </div>
      <div data-testid="w50-light">
        <StatGroup variant="strip" label="Body" cols={2} cells={[cell(weight('light', 75.5))]} />
      </div>
      <div data-testid="w50-ink">
        <StatGroup variant="strip" label="Body" cols={2} cells={[cell(weight('ink', 75.5))]} />
      </div>
    </>
  )
}
