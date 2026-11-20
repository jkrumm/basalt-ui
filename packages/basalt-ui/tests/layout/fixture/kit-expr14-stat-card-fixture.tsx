/**
 * Expression cycle 14, the StatCard string figure (`v3-expr-14-kit-fixes` 5, n65): a short name as the value of a
 * 358 px card, beside a delta pill and a status. `data-testid="k14-stat"` is the card's frame. Entry of
 * `kit-expr14-stat-card.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { StatCard } from '../../../src/cards/stat-card'

function Fixture(): ReactElement {
  return (
    <main className="flex flex-col gap-4 p-4 text-foreground">
      <div data-testid="k14-stat" className="w-[358px]">
        <StatCard
          title="Surge"
          subtitle="vs last hour"
          value="Gate flake"
          delta={{ value: '+131', polarity: 'up-bad', label: 'vs last week' }}
          status={{ tone: 'bad', label: 'Failing' }}
          phase="ready"
          footer={[{ label: 'Open', value: 12 }]}
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
