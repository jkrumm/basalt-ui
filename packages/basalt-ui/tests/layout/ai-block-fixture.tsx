/**
 * P7 (docs/v3/concepts/ai-mdx.md section 7): every sample of a two-block catalog rendered through
 * `catalog.Block`, once `loading` and once `ready`, side by side in one column per case so both
 * arms get the same width. `window.aiBlock.cases()` reports each case's height and whether it
 * overflows its box.
 */
import { createRoot } from 'react-dom/client'
import { z } from 'zod'
import { defineBlock, defineCatalog } from '../../src/ai/catalog/define'
import { DataPanel } from '../../src/cards/data-panel'
import { StatCard } from '../../src/cards/stat-card'

const stat = defineBlock({
  name: 'stat',
  description: 'One headline number with a delta. Never for lists.',
  props: z.object({ label: z.string().max(40), value: z.number(), delta: z.number().optional() }),
  sample: [
    { label: 'Shipped', value: 388, delta: 12 },
    { label: 'Open', value: 4 },
  ],
  render: (p) => (
    <StatCard
      title={p.label}
      value={p.value}
      {...(p.delta !== undefined && { delta: { value: p.delta, polarity: 'up-good' } })}
    />
  ),
})

const list = defineBlock({
  name: 'list',
  description: 'A short titled list of facts. Never for a single number.',
  props: z.object({ title: z.string().max(60), items: z.array(z.string().max(80)).max(8) }),
  sample: [
    { title: 'Release notes', items: ['Faster sync', 'New export', 'Fixed the login loop'] },
    { title: 'Blockers', items: ['Waiting on review'] },
  ],
  render: (p) => (
    <DataPanel
      title={p.title}
      skeleton={{ rows: p.items.length }}
      body={() => (
        <div className="flex flex-col">
          {p.items.map((item) => (
            <div key={item} className="h-9 truncate px-3 py-2 text-sm">
              {item}
            </div>
          ))}
        </div>
      )}
    />
  ),
})

const catalog = defineCatalog([stat, list])
const { Block } = catalog

const cases = catalog.blocks.flatMap((block) =>
  block.sample.map((sample, i) => ({
    id: `${block.name}-${i}`,
    spec: { block: block.name, ...(sample as Record<string, unknown>) },
  })),
)

function Fixture(): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 p-4">
      {cases.map(({ id, spec }) => (
        <div key={id} className="grid grid-cols-2 gap-4">
          <div data-case={`${id}:loading`} className="min-w-0">
            <Block spec={spec} phase="loading" />
          </div>
          <div data-case={`${id}:ready`} className="min-w-0">
            <Block spec={spec} phase="ready" />
          </div>
        </div>
      ))}
    </div>
  )
}

export type CaseReport = { id: string; height: number; overflows: boolean }

const host = document.getElementById('root')
if (!host) throw new Error('fixture host is missing #root')
document.body.classList.add('bg-background')
createRoot(host).render(<Fixture />)

// The harness waits for this hook before it measures; the page mounts itself above.
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
;(window as unknown as { aiBlock: { cases: () => CaseReport[] } }).aiBlock = {
  cases: () =>
    [...document.querySelectorAll<HTMLElement>('[data-case]')].map((el) => ({
      id: el.dataset['case'] ?? '',
      height: el.getBoundingClientRect().height,
      overflows: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
    })),
}
