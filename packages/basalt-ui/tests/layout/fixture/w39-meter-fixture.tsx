import type { ReactElement } from 'react'
import { Meter, StatGroup } from '../../../src/index'
import { VX } from '../../../src/tokens'

const H = 3_600_000
const D = 24 * H

/** argo's ACWR zones (Home, Garmin): only Caution carries a `short`. */
const ACWR_ZONES = [
  { from: 0, to: 0.8, label: 'Low', color: VX.warn },
  { from: 0.8, to: 1.3, label: 'Optimal', color: VX.good },
  { from: 1.3, to: 1.5, label: 'Caution', short: 'Caut.', color: VX.warn },
  { from: 1.5, to: 2, label: 'Danger', color: VX.bad },
]

const MIN = 60_000
/** `2 d 23 h`, `5 h`, `10 min`: argo's wait duration, the unit pair kept short. */
const formatDuration = (ms: number): string => {
  if (ms >= D) {
    const h = Math.round((ms % D) / H)
    return h === 0 ? `${Math.floor(ms / D)} d` : `${Math.floor(ms / D)} d ${h} h`
  }
  if (ms >= H) return `${Math.round(ms / H)} h`
  return `${Math.round(ms / MIN)} min`
}

/** The readings the oldest-wait sweep probes: 10 min, 3 h, 5 h, 1 d, 3 d, 6.5 d, 7 d. */
export const WAITS = [
  ['10min', 10 * MIN],
  ['3h', 3 * H],
  ['5h', 5 * H],
  ['1d', D],
  ['3d', 3 * D],
  ['6.5d', 6.5 * D],
  ['7d', 7 * D],
] as const

const HOME_ACWR = (
  <Meter
    label="Acute to chronic workload ratio"
    value={1.1}
    min={0}
    max={2}
    format={(v) => v.toFixed(2)}
    zones={ACWR_ZONES}
    startCaption={null}
    endCaption={null}
  />
)

const ACWR = (
  <Meter
    label="Acute to chronic workload ratio"
    value={1.1}
    min={0}
    max={2}
    format={(v) => v.toFixed(2)}
    zones={ACWR_ZONES}
    startCaption="0"
    endCaption="2.0"
  />
)

/** argo's Oldest-wait Meter (`fleet-strip.tsx`): two labelled ticks, the reading's colour, no end figures. */
const oldestWait = (ms: number) => (
  <Meter
    label="Oldest agent wait against the warn and abandoned marks"
    value={ms}
    max={7 * D}
    ticks={[
      { at: 24 * H, label: 'warn at\u00a024\u00a0h' },
      { at: 7 * D, label: 'abandoned at\u00a07\u00a0d' },
    ]}
    format={formatDuration}
    startCaption={null}
    endCaption={null}
    {...(ms >= 7 * D ? { color: VX.status.bad } : ms >= 24 * H ? { color: VX.status.warn } : {})}
  />
)

/** Wave 39: argo's Garmin and Home ACWR cells (5-col strips), the Agents strip at seven readings, a wide ACWR row. */
export function W39MeterFixture(): ReactElement {
  const others = [2, 3, 4, 5].map((n) => ({
    key: `c${n}`,
    caption: `Metric ${n}`,
    value: String(n),
  }))
  return (
    <>
      <div data-testid="w39-garmin">
        <StatGroup
          variant="strip"
          label="Training load"
          cols={5}
          cells={[
            { key: 'load', caption: 'Training load', value: '1.10', unit: 'ACWR', visual: ACWR },
            ...others,
          ]}
        />
      </div>
      <div data-testid="w39-homeacwr">
        <StatGroup
          variant="strip"
          label="Home"
          cols={5}
          cells={[
            {
              key: 'acwr',
              caption: 'Training load · 7 d / 28 d',
              value: '1.10',
              unit: 'Optimal',
              visual: HOME_ACWR,
              footer: 'range 0.8–1.3',
            },
            ...others,
          ]}
        />
      </div>
      {WAITS.map(([key, ms]) => (
        <div key={key} data-testid={`w39-agents-${key}`}>
          <StatGroup
            variant="strip"
            label="Agent fleet"
            cols={3}
            cells={[
              { key: 'needs-you', caption: 'Needs you · now', value: '6', unit: 'items waiting' },
              {
                key: 'oldest-wait',
                caption: 'Oldest wait',
                value: formatDuration(ms),
                footer: 'Drop the session table',
                visual: oldestWait(ms),
              },
              { key: 'fleet', caption: 'Fleet', value: '19', unit: 'items' },
            ]}
          />
        </div>
      ))}
      {[348, 640].map((w) => (
        // theme-allow hidden-inline-style -- the wrapper width IS the fixture's payload
        <div key={w} data-testid={`w39-goal-${w}`} style={{ width: w }}>
          <Meter
            label="17 of 28 sessions this month against the goal"
            value={17}
            max={28}
            target={28}
            ticks={[{ at: 14.5, label: 'Pace 14 sessions by 16 Oct' }]}
            format={(v) => `${v} sessions`}
          />
        </div>
      ))}
      {/* theme-allow hidden-inline-style -- the wrapper width IS the fixture's payload */}
      {(
        [
          ['start', 40],
          ['end', 60],
        ] as const
      ).map(([key, at]) => (
        // theme-allow hidden-inline-style -- the wrapper width IS the fixture's payload
        <div key={key} data-testid={`w39-wide-${key}`} style={{ width: 300 }}>
          <Meter
            label="Wide tick label"
            value={50}
            max={100}
            ticks={[{ at, label: 'a tick label wider than the room beside its mark' }]}
            startCaption={null}
            endCaption={null}
          />
        </div>
      ))}
      <div dir="rtl" data-testid="w39-wide-rtl" style={{ width: 300 }}>
        <Meter
          label="Wide tick label"
          value={50}
          max={100}
          ticks={[{ at: 40, label: 'a tick label wider than the room beside its mark' }]}
          startCaption={null}
          endCaption={null}
        />
      </div>
      <div data-testid="w39-home" style={{ width: 360 }}>
        {ACWR}
      </div>
    </>
  )
}
