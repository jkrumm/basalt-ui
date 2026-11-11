/**
 * The page-kit scenario's browser half: a `PageSummary` whose facts wrap at 390, and a `CardGrid`
 * of plain cards. `page-kit.ts` loads it on mount, so the registry the test process imports stays
 * free of DOM, CSS and `src` imports.
 *
 * The v3 fixture has no stylesheet of its own: this imports the layer order and the compiled
 * Tailwind sheet the suite precompiles (`tailwind-precompile.ts`, which scans `src/page`). That
 * sheet is built without preflight (the 2.x fixture needs it that way), so the two resets a
 * composite relies on are written here.
 */
import '../../tailwind-layers.css'
import '../../tailwind.generated.css'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { CardGrid } from '../../../../../src/page/card-grid'
import { PageSummary } from '../../../../../src/page/page-summary'
import type { FixtureSpec } from '../../spec'
import type { PageKitSpec } from './page-kit'

const FACTS = [
  '3 need you',
  'oldest 2 d',
  '41 runs today',
  'median 4 m 12 s',
  '2 stalled',
  '18 resolved this week',
  '7 waiting on review',
]

const RESET = document.createElement('style')
RESET.textContent = '*,::before,::after{box-sizing:border-box}body{margin:0}'

/** The v3 host page links no stylesheet, so the bundle's `main.css` is linked here, once, and awaited. */
function linkStylesheet(): Promise<void> {
  if (document.querySelector('link[data-page-kit]') !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/main.css'
    link.dataset['pageKit'] = ''
    link.addEventListener('load', () => resolve())
    link.addEventListener('error', () =>
      reject(new Error('LAYOUT: the fixture bundle emitted no main.css')),
    )
    document.head.append(link)
  })
}

let root: Root | null = null

export async function mount(spec: FixtureSpec, container: HTMLElement): Promise<void> {
  await linkStylesheet()
  root?.unmount()
  if (!RESET.isConnected) document.head.append(RESET)
  root = createRoot(container)
  const grid = (spec as PageKitSpec).pageKit
  root.render(
    grid === undefined ? (
      <div data-testid="w37-summary" className="p-4">
        <PageSummary sentence="12 open, 3 need you" facts={FACTS} aside="Today" />
      </div>
    ) : (
      <div data-testid="grid-host" className="p-4">
        <CardGrid min={grid.grid}>
          {Array.from({ length: grid.cards ?? 12 }, (_, i) => (
            <div key={i} data-testid="grid-card" className="h-20 min-w-0 rounded-card bg-card" />
          ))}
        </CardGrid>
      </div>
    ),
  )
}
