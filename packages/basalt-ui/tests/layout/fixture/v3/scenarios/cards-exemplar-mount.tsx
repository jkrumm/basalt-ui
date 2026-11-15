/**
 * The StatCard exemplar scenario's browser half: the `cx-*` probes of `cards-exemplar-fixture.tsx`
 * on the compiled Tailwind sheet the suite precompiles, in the scheme the spec names.
 */
import '../../tailwind-layers.css'
import '../../tailwind.generated.css'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { CardsExemplarFixture } from '../../cards-exemplar-fixture'
import type { FixtureSpec } from '../../spec'

const RESET = document.createElement('style')
RESET.textContent = '*,::before,::after{box-sizing:border-box}body{margin:0}'

function linkStylesheet(): Promise<void> {
  if (document.querySelector('link[data-cards-exemplar]') !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/main.css'
    link.dataset['cardsExemplar'] = ''
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
  document.documentElement.dataset['theme'] = spec.colorScheme ?? 'dark'
  root = createRoot(container)
  root.render(<CardsExemplarFixture />)
}
