import type { ReactElement } from 'react'
import { Sparkline } from '../../../src/charts'
import { DeltaBadge, Meter, StatCard, StatGroup } from '../../../src/index'
import type { StatStripCell } from '../../../src/index'

const POINTS = [12, 14, 9, 16, 18, 15, 21, 19, 24, 22, 27, 25]
const LOAD_ZONES = [
  { from: 0, to: 0.8, label: 'Low' },
  { from: 0.8, to: 1.3, label: 'Optimal' },
  { from: 1.3, to: 1.5, label: 'High' },
  { from: 1.5, to: 2, label: 'Overreaching' },
]
const fmtEur = (v: number) => `€${v}`
const fmtSessions = (v: number) => `${v} sessions`

/** S4's strip cells: a sparkline + footer cell, a forecast Meter + footer cell, a plain Meter cell. */
function stripCells(loading: boolean): StatStripCell[] {
  return [
    {
      key: 'mtd',
      caption: 'Spend',
      qualifier: 'month to date',
      value: '€182',
      delta: <DeltaBadge value={13.3} polarity="up-bad" period="vs 1–16 Sep" />,
      footer: 'Daily, 1–16 Oct',
      visual: <Sparkline ariaLabel="Daily spend" data={POINTS} height={28} reference="mean" />,
      loading,
    },
    {
      key: 'forecast',
      caption: 'Forecast',
      qualifier: 'end of October',
      value: '€590',
      tone: 'bad',
      footer: '€90 over budget',
      visual: (
        <Meter
          label="Forecast against the budget"
          max={700}
          ticks={[{ at: 500, label: 'Budget €500' }]}
          format={fmtEur}
          segments={[
            { value: 182, label: 'Spent' },
            { value: 408, label: 'Forecast', forecast: true },
          ]}
          startCaption="Spent"
          forecastCaption="Forecast"
        />
      ),
      loading,
    },
    {
      key: 'budget',
      caption: 'Budget',
      qualifier: 'October',
      value: '€500',
      visual: (
        <Meter
          label="Spent against the budget"
          max={500}
          value={182}
          format={fmtEur}
          startCaption="36% used"
          endCaption="€318 left"
        />
      ),
      loading,
    },
  ]
}

const METERS = {
  goal: (loading: boolean) => (
    <Meter
      label="Sessions against the goal"
      max={28}
      value={loading ? null : 17}
      target={28}
      ticks={[{ at: 14, label: 'Pace 14 sessions by 16 Oct' }]}
      format={fmtSessions}
      loading={loading}
    />
  ),
  load: (loading: boolean) => (
    <Meter
      label="Training load"
      max={2}
      value={loading ? null : 1.19}
      zones={LOAD_ZONES}
      startCaption={null}
      ticks={[
        { at: 0, label: '0' },
        { at: 2, label: '2.0' },
      ]}
      endCaption="1,522 AU this week · norm 1,283 AU"
      loading={loading}
    />
  ),
  forecast: (loading: boolean) => (
    <Meter
      label="Forecast against the budget"
      max={700}
      ticks={[{ at: 500, label: 'Budget €500' }]}
      format={fmtEur}
      segments={[
        { value: 182, label: 'Spent' },
        { value: 408, label: 'Forecast', forecast: true },
      ]}
      startCaption="Spent"
      forecastCaption="Forecast"
      loading={loading}
    />
  ),
  mix: (loading: boolean) => (
    <Meter
      label="Sessions by type"
      max={17}
      segments={[
        { value: 5, label: 'Strength' },
        { value: 8, label: 'Walking pad' },
        { value: 4, label: 'Mobility' },
      ]}
      format={fmtSessions}
      loading={loading}
    />
  ),
}

/** Wave 38: strip cells and Meters loading in the loaded shape, a forecast caption, StatGroup hero sizes. */
export function W38StripMeterFixture(): ReactElement {
  return (
    <>
      {[900, 358].flatMap((w) =>
        [false, true].map((loading) => (
          <div
            key={`${w}-${loading}`}
            data-testid={`w38l-strip-${w}-${loading ? 'loading' : 'rest'}`}
            style={{ width: w }}
          >
            <StatGroup variant="strip" label="Spend" cols={3} cells={stripCells(loading)} />
          </div>
        )),
      )}
      {(Object.keys(METERS) as (keyof typeof METERS)[]).flatMap((kind) =>
        [640, 328].flatMap((w) =>
          [false, true].map((loading) => (
            <div
              key={`${kind}-${w}-${loading}`}
              data-testid={`w38l-meter-${kind}-${w}-${loading ? 'loading' : 'rest'}`}
              style={{ width: w }}
            >
              {METERS[kind](loading)}
            </div>
          )),
        ),
      )}
      <div data-testid="w38l-group" style={{ width: 358 }}>
        <StatGroup cols={3}>
          <StatCard title="Sessions" qualifier="month to date" value="17" unit="sessions" />
          <StatCard title="Training volume" qualifier="month to date" value="50,543" unit="kg" />
          <StatCard title="Walking distance" qualifier="month to date" value="23.5" unit="km" />
        </StatGroup>
      </div>
    </>
  )
}
