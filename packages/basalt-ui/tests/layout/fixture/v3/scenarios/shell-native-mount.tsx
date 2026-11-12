/**
 * The shell-native scenario's browser half: `AppShell` with the spec's `chrome`, three header
 * actions, a `CommandPalette` and the page. `shell-native.ts` loads it on mount.
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
import { useState } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { Page } from '../../../../../src/page/page'
import { PageBar } from '../../../../../src/page/page-bar'
import { Section } from '../../../../../src/page/section'
import { AppShell } from '../../../../../src/shell/app-shell'
import { CommandPalette } from '../../../../../src/shell/commands/command-palette'
import { defineCommands } from '../../../../../src/shell/commands/define-commands'
import type { AppShellProps } from '../../../../../src/shell/contract'
import { Dialog, DialogContent } from '../../../../../src/ui/dialog'
import type { FixtureSpec } from '../../spec'
import type { ShellNativeSpec } from './shell-native'

const RESET = document.createElement('style')
RESET.textContent = '*,::before,::after{box-sizing:border-box}body{margin:0}'

function linkStylesheet(): Promise<void> {
  if (document.querySelector('link[data-shell-native]') !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/main.css'
    link.dataset['shellNative'] = ''
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
        { id: 'jobs', label: 'Jobs', link: { to: '/jobs' }, mobile: 'tab' },
      ],
    },
  ],
} satisfies AppShellProps['nav']

const Glyph = ({ className }: { className?: string }): ReactElement => (
  <svg viewBox="0 0 16 16" className={className} fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const noop = (): void => {}

const GLOBAL_ACTIONS: NonNullable<AppShellProps['globalActions']> = [
  { kind: 'button', id: 'sync', label: 'Sync', icon: Glyph, onClick: noop },
  { kind: 'button', id: 'alerts', label: 'Alerts', icon: Glyph, onClick: noop },
  {
    kind: 'popover',
    id: 'inbox',
    label: 'Inbox',
    icon: Glyph,
    badge: 3,
    content: () => <p className="p-2 text-sm">Nothing new</p>,
  },
]

const COMMANDS = defineCommands({
  'run.start': { label: 'Start run', group: 'Runs', chord: 'Mod+Enter', run: noop },
  'run.cancel': { label: 'Cancel run', group: 'Runs', keywords: ['stop', 'abort'], run: noop },
  'deploy.now': { label: 'Deploy now', group: 'Ops', chord: 'Mod+Shift+D', run: noop },
  'help.docs': { label: 'Open docs', group: 'Help', run: noop },
})

function Body({ dialogUnder }: { dialogUnder: boolean }): ReactElement {
  const [open, setOpen] = useState(dialogUnder)
  return (
    <Page area="runs">
      <PageBar
        title="Runs"
        actions={[{ id: 'new', label: 'New run', primary: true, onClick: noop }]}
      />
      <Section title="Latency">
        <p className="text-sm">Body</p>
        <button type="button" className="h-ctl rounded-ctrl bg-secondary px-3 text-sm">
          Focusable
        </button>
      </Section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Underneath">A dialog that stays.</DialogContent>
      </Dialog>
    </Page>
  )
}

let root: Root | null = null

export async function mount(spec: FixtureSpec, container: HTMLElement): Promise<void> {
  await linkStylesheet()
  root?.unmount()
  if (!RESET.isConnected) document.head.append(RESET)
  const options = (spec as ShellNativeSpec).shellNative ?? {}
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
        chrome={options.chrome ?? 'native-overlay'}
      >
        <Outlet />
        <CommandPalette commands={COMMANDS} />
      </AppShell>
    ),
  })
  const page = (path: string) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <Body dialogUnder={options.dialogUnder === true} />,
    })
  const router = createRouter({
    routeTree: rootRoute.addChildren([page('/'), page('/runs'), page('/jobs')]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  root = createRoot(container)
  root.render(<RouterProvider router={router} />)
}
