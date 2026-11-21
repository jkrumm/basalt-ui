/**
 * Expression cycle 18, axis focus (`v3-expr-18-kit-fixes` 7, n89 .19, n88): a four-bar band chart with the n89
 * names, in a card, focused through `useChartFocus`. `data-testid` `k18-focus`. Entry of
 * `kit-expr18-focus.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { Bars } from '../../../src/charts/parts/bars'
import { ChartCard } from '../../../src/charts/parts/chart-card'
import { useChartFocus } from '../../../src/charts'

type Source = { name: string; needed: number; other: number }
const SOURCES: readonly Source[] = [
  { name: 'File overlap', needed: 33, other: 13 },
  { name: 'Plan edge', needed: 17, other: 17 },
  { name: 'Memory guard', needed: 18, other: 4 },
  { name: 'Slot spacing', needed: 15, other: 3 },
]
const INK = { light: 'var(--basalt-chart-1)', dark: 'var(--basalt-chart-1)' }
const DIM = { light: 'var(--basalt-chart-2)', dark: 'var(--basalt-chart-2)' }

function Fixture(): ReactElement {
  const focus = useChartFocus(SOURCES, { announce: (s) => `${s.name}: ${s.needed + s.other}` })
  return (
    <main className="@container grid gap-4 p-4 text-foreground">
      <div data-testid="k18-focus">
        <ChartCard
          title="Waits the factory adds"
          subtitle="Counted by verdict"
          height="tall"
          legend={[
            { key: 'needed', label: 'Needed', color: INK },
            { key: 'other', label: 'Other', color: DIM },
          ]}
          chart={(box) => (
            <Bars<Source>
              label="Stacked verdicts per source"
              data={SOURCES}
              height={box.height}
              focus={focus}
              tooltip={false}
              cursor="k18-focus"
              x={{ value: (s) => s.name }}
              y={{ title: 'Waits' }}
              series={[
                { mark: 'bar', key: 'needed', label: 'Needed', color: INK, y: (s) => s.needed },
                { mark: 'bar', key: 'other', label: 'Other', color: DIM, y: (s) => s.other },
              ]}
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
