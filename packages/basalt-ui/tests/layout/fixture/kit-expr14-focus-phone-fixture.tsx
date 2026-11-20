/**
 * Expression cycle 14, the chart focus over a phone list (n42 shape, `v3-expr-14-kit-fixes` 7a): one
 * `ChartCard` with a `Lines` chart and a `DataPanel` whose `DataTable` (`phone: 'cards'`, four body rows)
 * holds one event per item, as phone cards. `data-testid="k14-root"` carries `focus.index`. Entry of
 * `kit-expr14-focus-phone.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataPanel } from '../../../src/cards/data-panel'
import { ChartCard, Lines, useChartFocus } from '../../../src/charts'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Sample = { at: number; mem: number; cpu: number }
type Event = { id: string; at: number; time: string; label: string; memory: number; cpu: number }

const SAMPLES: readonly Sample[] = Array.from({ length: 24 }, (_, at) => ({
  at,
  mem: 40 + ((at * 7) % 30),
  cpu: 10 + ((at * 11) % 60),
}))
const EVENTS: readonly Event[] = [2, 5, 9, 13, 16, 19, 22]
  .map((at, i) => ({
    id: `e${at}`,
    at,
    time: `${String(at).padStart(2, '0')}:00`,
    label: i % 2 === 0 ? 'Line drop' : 'Resync',
    memory: 40 + ((at * 7) % 30),
    cpu: 10 + ((at * 11) % 60),
  }))
  .toReversed()

const c = col<Event>()
const COLUMNS = [
  c.entity('time', {
    header: 'Event',
    mono: true,
    sub: (r) => r.label,
    sortable: false,
    priority: 1,
  }),
  c.number('memory', { header: 'Memory', unit: '%', sortable: false, priority: 2 }),
  c.number('cpu', { header: 'CPU', unit: '%', sortable: false, priority: 2 }),
]

const GOOD = { light: 'var(--basalt-good)', dark: 'var(--basalt-good)' }
const BAD = { light: 'var(--basalt-bad)', dark: 'var(--basalt-bad)' }

function Fixture(): ReactElement {
  const focus = useChartFocus(SAMPLES, {
    announce: (d) => `minute ${d.at}: memory ${d.mem} %, CPU ${d.cpu} %`,
  })
  const table = useDataTable<Event>({
    id: 'k14-n42',
    label: 'Line events',
    columns: COLUMNS,
    data: EVENTS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: 'ready',
    bodyRows: 4,
    phone: 'cards',
  })
  return (
    <main
      data-testid="k14-root"
      data-focus-index={focus.index ?? ''}
      className="flex flex-col gap-4 p-4 text-foreground"
    >
      <ChartCard
        title="Router readings"
        subtitle="CPU and memory, one reading a minute"
        phase="ready"
        figure={{
          value: focus.readout<string>('ok', (d) => `${d.mem} %`),
          period: 'last 24 hours',
        }}
        chart={(box) => (
          <Lines
            height={box.height}
            label="Memory and CPU for each minute"
            data={SAMPLES}
            focus={focus}
            tooltip={false}
            x={{ value: (d) => d.at }}
            y={{ title: 'Used, %', domain: { floor: 0, ceil: 100, pad: 0.06 } }}
            series={[
              {
                mark: 'line',
                key: 'memory',
                label: 'Memory',
                color: GOOD,
                weight: 'strong',
                y: (d) => d.mem,
              },
              {
                mark: 'line',
                key: 'cpu',
                label: 'CPU',
                color: BAD,
                y: (d) => d.cpu,
              },
            ]}
          />
        )}
      />
      <div data-testid="k14-table" className="min-w-0">
        <DataPanel
          title="Line events"
          phase="ready"
          bodySize={{ rows: 6 }}
          body={() => (
            <DataTable
              table={table}
              focusItems={{ focus, holds: (row, item) => item.at === row.at }}
            />
          )}
        />
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
