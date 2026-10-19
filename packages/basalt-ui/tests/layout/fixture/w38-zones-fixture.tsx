import type { ReactElement } from 'react'
import { Meter, StatGroup } from '../../../src/index'
import { VX } from '../../../src/tokens'

/** argo's four ACWR zones (floor 0.8, optimal to 1.3, caution to 1.5, max 2): only Caution has a `short`. */
const ACWR_ZONES = [
  { from: 0, to: 0.8, label: 'Low', color: VX.warn },
  { from: 0.8, to: 1.3, label: 'Optimal', color: VX.good },
  { from: 1.3, to: 1.5, label: 'Caution', short: 'Caut.', color: VX.warn },
  { from: 1.5, to: 2, label: 'Danger', color: VX.bad },
]

const METER = (
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

/** The ACWR load Meter in a strip cell, at the strip's own column count (5 desktop, 2 phone). */
export function W38ZonesFixture(): ReactElement {
  return (
    <div data-testid="w38-acwr-strip">
      <StatGroup
        variant="strip"
        label="Load"
        cols={5}
        cells={[
          { key: 'load', caption: 'Load', value: '1.10', unit: 'ACWR', visual: METER },
          ...[2, 3, 4, 5].map((n) => ({ key: `c${n}`, caption: `Metric ${n}`, value: String(n) })),
        ]}
      />
    </div>
  )
}
