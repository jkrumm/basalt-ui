import type { ReactElement } from 'react'
import { StatCard } from '../../../src/index'

/**
 * A `StatCard` with an `info` glyph AND a `tone` verdict (`data-testid="info-ring-stat"`): the
 * caption row where the glyph's focus ring sits between the title and the status dot.
 */
export function InfoRingFixture(): ReactElement {
  return (
    // theme-allow -- the wrapper width IS the fixture's payload (a container-class probe)
    <div data-testid="info-ring-stat" style={{ width: 700 }}>
      <StatCard title="Forecast (€)" info="How it is measured." value="12,847" tone="warn" />
    </div>
  )
}
