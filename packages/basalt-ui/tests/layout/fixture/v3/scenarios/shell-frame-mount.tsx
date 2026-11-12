/**
 * The shell-frame scenario's browser half: `AppShell` under a memory router, a `Page` with a
 * `PageBar`, a table of `rows` rows and an optional `PageAside`. `shell-frame.ts` loads it on mount.
 */
import '../../tailwind-layers.css'
import '../../tailwind.generated.css'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { Page } from '../../../../../src/page/page'
import { PageAside } from '../../../../../src/page/page-aside'
import { PageBar } from '../../../../../src/page/page-bar'
import { Section } from '../../../../../src/page/section'
import type { ControlsSlot } from '../../../../../src/core/ports'
import { AppShell } from '../../../../../src/shell/app-shell'
import type { AppShellProps } from '../../../../../src/shell/contract'
import type { FixtureSpec } from '../../spec'
import type { ShellFrameSpec } from './shell-frame'

const RESET = document.createElement('style')
RESET.textContent =
  '*,::before,::after{box-sizing:border-box}body{margin:0}table{border-collapse:collapse}'

function linkStylesheet(): Promise<void> {
  if (document.querySelector('link[data-shell-frame]') !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/main.css'
    link.dataset['shellFrame'] = ''
    link.addEventListener('load', () => resolve())
    link.addEventListener('error', () =>
      reject(new Error('LAYOUT: the fixture bundle emitted no main.css')),
    )
    document.head.append(link)
  })
}

const NAV = {
  sections: [
    {
      id: 'main',
      label: 'Main',
      items: [
        { id: 'home', label: 'Overview', link: { to: '/' }, mobile: 'tab' },
        { id: 'runs', label: 'Runs', link: { to: '/runs' }, mobile: 'tab' },
      ],
    },
  ],
} satisfies AppShellProps['nav']

const controls: ControlsSlot = {
  kind: 'controls-slot',
  count: 1,
  render: () => (
    <button type="button" className="h-ctl rounded-ctrl bg-secondary px-3 text-sm">
      Last 7 days
    </button>
  ),
}

const GLOBAL_ACTIONS: NonNullable<AppShellProps['globalActions']> = [
  {
    kind: 'custom',
    id: 'timer',
    label: 'Timer',
    render: () => <span className="text-sm">00:42</span>,
  },
]

function Body({ options }: { options: NonNullable<ShellFrameSpec['shellFrame']> }): ReactElement {
  const { rows = 12, aside = false, bar = true } = options
  const asideProps = typeof aside === 'object' ? aside : {}
  return (
    <Page area="runs">
      {bar && (
        <PageBar
          title="Runs"
          controls={controls}
          actions={[{ id: 'new', label: 'New run', primary: true, onClick: () => {} }]}
        />
      )}
      {!bar && <h1 className="sr-only">Runs</h1>}
      <Section title="Latency">
        <table data-testid="table" className="w-full text-sm">
          <tbody>
            {Array.from({ length: rows }, (_, i) => (
              <tr key={i} data-testid="row" className="border-b border-border">
                <td className="h-8 px-2">run-{i}</td>
                <td className="h-8 px-2">{i} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      {aside !== false && (
        <PageAside title="Run details" {...asideProps}>
          <p data-testid="aside-body">Facts</p>
        </PageAside>
      )}
    </Page>
  )
}

let root: Root | null = null

export async function mount(spec: FixtureSpec, container: HTMLElement): Promise<void> {
  await linkStylesheet()
  root?.unmount()
  if (!RESET.isConnected) document.head.append(RESET)
  const options = (spec as ShellFrameSpec).shellFrame ?? {}
  localStorage.clear()
  if (options.rail !== undefined) {
    localStorage.setItem(
      'basalt:basalt-sidebar-collapsed',
      JSON.stringify({ v: 1, value: options.rail === 'collapsed' }),
    )
  }
  const rootRoute = createRootRoute({
    component: () => (
      <AppShell
        nav={NAV}
        brand={{ name: 'Basalt' }}
        globalActions={GLOBAL_ACTIONS}
        {...(options.compactHeader !== undefined && { compactHeader: options.compactHeader })}
      >
        <Outlet />
      </AppShell>
    ),
  })
  const index = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <Body options={options} />,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([index]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  root = createRoot(container)
  root.render(<RouterProvider router={router} />)
}
