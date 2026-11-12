/**
 * The page-core scenario's browser half: a shell-less `Page` with a `PageBar`, three tall `Section`s
 * (the second holds a table whose head sticks under the band) and an optional `PageAside`.
 * `page-core.ts` loads it on mount, so the registry the test process imports stays free of DOM, CSS
 * and `src` imports. Styling is the compiled Tailwind sheet the suite precompiles.
 */
import '../../tailwind-layers.css'
import '../../tailwind.generated.css'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { Page } from '../../../../../src/page/page'
import { PageAside } from '../../../../../src/page/page-aside'
import { PageBar } from '../../../../../src/page/page-bar'
import { Section } from '../../../../../src/page/section'
import type { ControlsSlot } from '../../../../../src/core/ports'
import type { FixtureSpec } from '../../spec'
import type { PageCoreSpec } from './page-core'

const RESET = document.createElement('style')
RESET.textContent =
  '*,::before,::after{box-sizing:border-box}body{margin:0}table{border-collapse:collapse}'

function linkStylesheet(): Promise<void> {
  if (document.querySelector('link[data-page-core]') !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/main.css'
    link.dataset['pageCore'] = ''
    link.addEventListener('load', () => resolve())
    link.addEventListener('error', () =>
      reject(new Error('LAYOUT: the fixture bundle emitted no main.css')),
    )
    document.head.append(link)
  })
}

const controls: ControlsSlot = {
  kind: 'controls-slot',
  count: 1,
  render: () => (
    <button type="button" className="h-ctl rounded-ctrl bg-secondary px-3 text-sm">
      Last 7 days
    </button>
  ),
}

function Block({ label, height }: { label: string; height: number }): ReactElement {
  return (
    <div
      data-testid={label}
      style={{ height }}
      className="rounded-card bg-card p-4 text-sm text-muted-foreground"
    >
      {label}
    </div>
  )
}

function Table(): ReactElement {
  return (
    <table data-testid="table" className="w-full text-sm">
      <thead
        data-testid="thead"
        className="sticky top-(--page-sticky-top) bg-background text-left text-muted-foreground"
      >
        <tr>
          <th className="h-8 px-2">Run</th>
          <th className="h-8 px-2">Duration</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 40 }, (_, i) => (
          <tr key={i} className="border-b border-border">
            <td className="h-8 px-2">run-{i}</td>
            <td className="h-8 px-2">{i} s</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

let root: Root | null = null

export async function mount(spec: FixtureSpec, container: HTMLElement): Promise<void> {
  await linkStylesheet()
  root?.unmount()
  if (!RESET.isConnected) document.head.append(RESET)
  root = createRoot(container)
  const { aside = false, bar = true } = (spec as PageCoreSpec).pageCore ?? {}
  root.render(
    <Page area="runs">
      {bar && (
        <PageBar
          title="Runs"
          parent={{ label: 'Projects', href: '/projects' }}
          controls={controls}
          actions={[{ id: 'new', label: 'New run', primary: true, onClick: () => {} }]}
        />
      )}
      <Section title="Overview">
        <Block label="overview-body" height={900} />
      </Section>
      <Section title="Latency">
        <Table />
      </Section>
      <Section title="Errors">
        <Block label="errors-body" height={1400} />
      </Section>
      {aside && (
        <PageAside title="Run details" width={360}>
          <p data-testid="aside-body">Facts</p>
        </PageAside>
      )}
    </Page>,
  )
}
