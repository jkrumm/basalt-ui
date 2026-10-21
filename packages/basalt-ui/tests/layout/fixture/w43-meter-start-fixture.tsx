import type { ReactElement } from 'react'
import { Meter, StatGroup } from '../../../src/index'
import { VX } from '../../../src/tokens'

const kg = (v: number): string => `${v.toFixed(1)} kg`
const FLAT = [
  { at: 72.3, color: VX.line },
  { at: 78.9, color: VX.line },
]

/** argo's body Weight cell with no goal: a low–high Meter whose reading sits at the track start. */
const weight = (value: number, readingAt: 'start' | 'fill') => (
  <Meter
    label="Current weight within the window's lowest and highest weigh-in"
    value={value}
    min={72.3}
    max={78.9}
    format={kg}
    readingAt={readingAt}
    stops={FLAT}
    startCaption={`low ${kg(72.3)}`}
    endCaption={`high ${kg(78.9)}`}
    tone="muted"
  />
)

const strip = (visual: ReactElement, cols: 2 | 3) => (
  <StatGroup
    variant="strip"
    label="Body"
    cols={cols}
    cells={[
      { key: 'weight', caption: 'Weight', value: '72.3', unit: 'kg', visual },
      { key: 'fat', caption: 'Body fat', value: '18', unit: '%' },
      ...(cols === 3 ? [{ key: 'lean', caption: 'Lean', value: '59', unit: 'kg' }] : []),
    ]}
  />
)

/** Wave 43: the Weight cell with the reading at the window low (`start`) and a too-short `fill`. */
export function W43MeterStartFixture(): ReactElement {
  return (
    <>
      <div data-testid="w43-start">{strip(weight(72.3, 'start'), 3)}</div>
      <div data-testid="w43-fill-short">{strip(weight(72.5, 'fill'), 3)}</div>
      <div data-testid="w43-start-two">{strip(weight(72.3, 'start'), 2)}</div>
    </>
  )
}
