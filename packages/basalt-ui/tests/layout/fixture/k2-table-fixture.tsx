import type { ReactElement } from 'react'
import { StatCell } from '../../../src/cards/stat-cell'
import { StatGroup } from '../../../src/cards/stat-group'

const CELLS = [
  { title: 'Downstream', value: 412, unit: 'Mbit/s' },
  { title: 'Upstream', value: 44, unit: 'Mbit/s' },
  { title: 'Latency', value: 18, unit: 'ms' },
  { title: 'Jitter', value: 3, unit: 'ms' },
  { title: 'Loss', value: 0.2, unit: '%' },
  { title: 'Uptime', value: 99.9, unit: '%' },
]

/** Expression cycle 2 kit fixes, StatGroup (`k2-table-*`): six `cards` cells (the table probes are the `k2-table` document fixture). */
export function K2TableFixture(): ReactElement {
  return (
    <div data-testid="k2-table-stat">
      <StatGroup variant="cards" label="Link health">
        {CELLS.map((cell) => (
          <StatCell key={cell.title} {...cell} />
        ))}
      </StatGroup>
    </div>
  )
}
