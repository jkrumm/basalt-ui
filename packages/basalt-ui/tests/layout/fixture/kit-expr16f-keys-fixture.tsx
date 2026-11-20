/**
 * Expression cycle 16, the keys of a chart at 390 inside the shell's scroll region (`v3-expr-16-kit-fixes`
 * 7, n73, n78, n80): the n42 shape of `kit-expr14-focus-phone-fixture.tsx` in a box that scrolls itself
 * (`k16f-page`, as the shell's main does), with room between the chart and the phone list so the
 * list is below the fold. Entry of `kit-expr16f-keys.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
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
const EVENTS: readonly Event[] = [0, 1, 2, 3, 4, 5, 6]
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
    id: 'k16f-n42',
    label: 'Line events',
    columns: COLUMNS,
    data: EVENTS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: 'ready',
    phone: 'cards',
  })
  return (
    <main
      data-testid="k16f-page"
      data-focus-index={focus.index ?? ''}
      className="flex h-screen flex-col gap-4 overflow-y-auto p-4 text-foreground"
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
      <div data-testid="k16f-room" style={{ minHeight: 500 }} />
      <div data-testid="k16f-table" className="min-w-0">
        <DataTable table={table} focusItems={{ focus, holds: (row, item) => item.at === row.at }} />
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
