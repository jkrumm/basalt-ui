import type { ReactElement } from 'react'
import { Bars, Sparkline } from '../../../src/charts'
import { DeltaBadge, Meter, StatGroup } from '../../../src/index'
import { VX } from '../../../src/tokens'

const POINTS = [12, 14, 9, 16, 18, 15, 21, 19, 24, 22, 27, 25]
const BARS = POINTS.map((n, bin) => ({ bin, n }))
const DAYS = POINTS.map((_, i) => `${i + 1} Oct`)

/** Wave 39: one row of mixed cells, and a cell whose rows carry Sparklines. */
export function W39StripFixture(): ReactElement {
  return (
    <>
      <div data-testid="w39-strip">
        <StatGroup
          variant="strip"
          label="Mixed strip"
          cols={4}
          cells={[
            {
              key: 'meter',
              caption: 'Budget',
              qualifier: 'October, against the monthly cap and the forecast',
              value: '€182',
              visual: <Meter label="Spent" max={500} value={182} startCaption="36% used" />,
            },
            {
              key: 'spark',
              caption: 'Spend',
              value: '€182',
              delta: <DeltaBadge value={13.3} polarity="up-bad" period="vs 1–16 Sep" />,
              visual: <Sparkline ariaLabel="Daily spend" data={POINTS} height={28} />,
              footer: 'Daily, 1–16 Oct',
            },
            {
              key: 'bars',
              caption: 'Runs',
              value: '24',
              visual: (
                <Bars
                  ariaLabel="Runs per day"
                  data={BARS}
                  x={(d) => d.bin}
                  height={28}
                  bars={[{ key: 'n', label: 'Runs', color: VX.accent, getValue: (d) => d.n }]}
                />
              ),
            },
            {
              key: 'under',
              caption: 'Dispatch',
              qualifier: 'today',
              value: '€5',
              visual: <Meter label="Cap" max={10} value={5} startCaption="Today" />,
            },
          ]}
          footer={[
            {
              key: 'cap',
              under: 'under',
              content: <Meter label="Daily" max={10} value={5} startCaption="Daily budget" />,
            },
          ]}
        />
      </div>
      <div data-testid="w39-rows">
        <StatGroup
          variant="strip"
          label="Row sparklines"
          cols={2}
          cells={[
            {
              key: 'fitness',
              caption: 'Fitness',
              rows: [
                {
                  key: 'rhr',
                  label: 'Resting HR',
                  value: '48 bpm',
                  visual: (
                    <Sparkline
                      ariaLabel="Resting heart rate"
                      data={POINTS}
                      labels={DAYS}
                      height={28}
                      format={(v) => `${v} bpm`}
                    />
                  ),
                },
                {
                  key: 'hrv',
                  label: 'HRV',
                  value: '62 ms',
                  visual: (
                    <Sparkline
                      ariaLabel="Heart rate variability"
                      data={POINTS}
                      labels={DAYS}
                      height={28}
                      format={(v) => `${v} ms`}
                    />
                  ),
                },
                { key: 'plain', label: 'Steps', value: '8,210' },
              ],
            },
            { key: 'other', caption: 'Other', value: '1' },
          ]}
        />
      </div>
    </>
  )
}
