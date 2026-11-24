import { createFileRoute } from '@tanstack/react-router'
import { StatCell, StatGroup } from 'basalt-ui/cards'
import { ChartCard, Lines } from 'basalt-ui/charts'
import { shotState } from 'basalt-ui/data'
import { Page, PageBar } from 'basalt-ui/page'
import { Gauge, Timer } from 'lucide-react'
import type { ReactElement } from 'react'
import { validateShotSearch } from '../../scenarios/shot-state'

export const Route = createFileRoute('/kit/stat-states')({
  staticData: { title: 'Stat states' },
  validateSearch: validateShotSearch,
  component: StatStatesRoute,
})

type Reading = { at: Date; down: number; up: number }
const READINGS: readonly Reading[] = Array.from({ length: 12 }, (_, i) => ({
  at: new Date(Date.UTC(2026, 10, 1 + i, 12)),
  down: 92.52912 - (i % 4),
  up: 41.2 + (i % 3),
}))
const noop = (): void => undefined
const NONE = { cause: 'No readings yet' }
const SERIES = {
  down: { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' },
}

/**
 * One query feeds a stat group and a chart card, and both are given `empty` unconditionally: it takes
 * effect only when the settled data is empty, so the rest frame shows the figures, the empty frame the
 * cause once and the error frame one message and one Retry for the group, never the raw error text. A
 * meter without its own `format` prints with the cell's unit and digits.
 */
function StatStatesRoute(): ReactElement {
  const readings = shotState({
    isPending: false,
    isError: false,
    error: new Error('TypeError: Failed to fetch'),
    refetch: noop,
    data: READINGS,
  })
  const [first] = readings.data
  return (
    <Page area="kit-stat-states">
      <PageBar title="Stat states" />
      <StatGroup variant="cards" label="Link health">
        <StatCell
          icon={Gauge}
          title="Downstream"
          value={first === undefined ? null : Math.round(first.down * 10) / 10}
          unit="Mbit/s"
          meter={{ label: 'Downstream', value: first?.down ?? null, max: 100 }}
          phase={readings}
          empty={NONE}
        />
        <StatCell
          icon={Timer}
          title="Upstream"
          value={first === undefined ? null : Math.round(first.up * 10) / 10}
          unit="Mbit/s"
          delta={{ value: '+1.2', polarity: 'up-good', label: 'vs last week' }}
          phase={readings}
          empty={NONE}
        />
      </StatGroup>
      <ChartCard
        title="Downstream per day"
        height="short"
        figure={{
          value: first === undefined ? null : Math.round(first.down),
          unit: 'Mbit/s',
          period: 'latest day',
        }}
        phase={readings}
        empty={NONE}
        chart={(box) => (
          <Lines
            label="Downstream per day"
            height={box.height}
            data={readings.data}
            x={{ value: (d) => d.at }}
            series={[
              {
                mark: 'line',
                key: 'down',
                label: 'Downstream',
                color: SERIES.down,
                y: (d) => d.down,
              },
            ]}
          />
        )}
      />
    </Page>
  )
}
