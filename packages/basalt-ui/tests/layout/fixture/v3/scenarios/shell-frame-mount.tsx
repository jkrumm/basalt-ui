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
import { useState, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { Dock } from '../../../../../src/page/dock'
import { Page } from '../../../../../src/page/page'
import { PageAside } from '../../../../../src/page/page-aside'
import { Peek } from '../../../../../src/page/peek'
import { PageBar } from '../../../../../src/page/page-bar'
import { Section } from '../../../../../src/page/section'
import type { ControlHandle, ControlsSlot } from '../../../../../src/core/ports'
import { col } from '../../../../../src/table/core/kinds'
import { DataTable } from '../../../../../src/table/parts/data-table'
import { useDataTable } from '../../../../../src/table/use-data-table'
import { AppShell } from '../../../../../src/shell/app-shell'
import { Button } from '../../../../../src/ui/button'
import { Input } from '../../../../../src/ui/input'
import { Sheet, SheetContent } from '../../../../../src/ui/sheet'
import { Card } from '../../../../../src/ui/card'
import type { AppShellProps } from '../../../../../src/shell/contract'
import type { FixtureSpec } from '../../spec'
import type { ShellFrameSpec } from './shell-frame'
import { defineNav } from '../../../../../tests/support/router-nav'

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

const NAV = defineNav({
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
})

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

/** A boolean handle over a module cell; the document attribute is what the test reads back. */
function boundAsideState(initial: boolean): ControlHandle<boolean> {
  let value = initial
  const listeners = new Set<() => void>()
  const publish = (): void => {
    document.documentElement.dataset['asideState'] = String(value)
    for (const listener of listeners) listener()
  }
  publish()
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  return {
    key: 'aside',
    kind: 'boolean',
    use: () => [
      useSyncExternalStore(
        subscribe,
        () => value,
        () => value,
      ),
      (next) => {
        value = next
        publish()
      },
    ],
    useSource: () => ({ source: 'own', inherited: undefined }),
    clear: () => {},
    isDefault: false,
  }
}

/** A string handle over a module cell: the open record's id, `''` when none. */
function boundRecordState(initial: string): ControlHandle<string> {
  let value = initial
  const listeners = new Set<() => void>()
  const publish = (): void => {
    document.documentElement.dataset['asideRecord'] = value
    for (const listener of listeners) listener()
  }
  publish()
  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  return {
    key: 'record',
    kind: 'string',
    use: () => [
      useSyncExternalStore(
        subscribe,
        () => value,
        () => value,
      ),
      (next) => {
        value = next
        publish()
      },
    ],
    useSource: () => ({ source: 'own', inherited: undefined }),
    clear: () => {
      value = ''
      publish()
    },
    isDefault: false,
  }
}

type Run = { id: string; name: string; seconds: number }

const RUNS: readonly Run[] = Array.from({ length: 6 }, (_, i) => ({
  id: `run-${i}`,
  name: `Run ${i}`,
  seconds: i,
}))

/** A table whose `detail` and `detailTitle` are all the wiring: no host, no URL field. */
function DetailTable(): ReactElement {
  const c = col<Run>()
  const table = useDataTable<Run>({
    id: 'shell-frame-runs',
    label: 'Runs',
    columns: [c.text('name', { header: 'Name' }), c.number('seconds', { header: 'Seconds' })],
    data: RUNS,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    detail: (row) => <p data-testid="detail-body">{row.name} facts</p>,
    detailTitle: (row) => `${row.name} details`,
  })
  return <DataTable table={table} />
}

/** An open `Dock`, or one a button opens and closes (`dock: 'toggle'`). */
function DockHarness({ mode }: { mode: true | 'toggle' }): ReactElement {
  const [open, setOpen] = useState(mode === true)
  return (
    <>
      {mode === 'toggle' && (
        <button type="button" data-testid="dock-toggle" onClick={() => setOpen((v) => !v)}>
          toggle dock
        </button>
      )}
      {open && (
        <Dock
          title="Issue 12"
          tag="#12"
          fullPage="/runs"
          onClose={() => {
            setOpen(false)
            document.documentElement.dataset['dockClosed'] = ''
          }}
        >
          {Array.from({ length: 60 }, (_, i) => (
            <p key={i} data-testid="dock-line">
              Line {i}
            </p>
          ))}
        </Dock>
      )}
    </>
  )
}

/** An open `Sheet`; with `form` it holds a field, a body longer than the sheet and a footer button. */
function SheetHarness({
  options,
}: {
  options: { form?: boolean; snapPoints?: readonly ('half' | 'full')[] }
}): ReactElement {
  const { form = false, snapPoints } = options
  return (
    <Sheet defaultOpen {...(snapPoints !== undefined && { snapPoints })}>
      <SheetContent
        title="Edit run"
        tag="#12"
        {...(form && {
          footer: (
            <Button variant="primary" data-testid="sheet-save">
              Save
            </Button>
          ),
        })}
      >
        <p data-testid="sheet-body">Form</p>
        {form && (
          <>
            <Input aria-label="Run name" data-testid="field-sheet" placeholder="Run name" />
            {Array.from({ length: 24 }, (_, i) => (
              <p key={i}>Note {i}</p>
            ))}
            <Input aria-label="Owner" data-testid="field-sheet-end" placeholder="Owner" />
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Body({ options }: { options: NonNullable<ShellFrameSpec['shellFrame']> }): ReactElement {
  const { rows = 12, aside = false, bar = true, detailTable = false } = options
  const { state, record, ...asideProps } = typeof aside === 'object' ? aside : {}
  const [handle] = useState<ControlHandle<boolean> | ControlHandle<string> | undefined>(() => {
    if (record !== undefined) return boundRecordState(record)
    return state === undefined ? undefined : boundAsideState(state)
  })
  if (options.fill === true) {
    return (
      <Page area="runs" fill>
        <PageBar title="Runs" controls={controls} />
        <DetailTable />
      </Page>
    )
  }
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
      {options.card === true && (
        <Card>
          <p className="text-sm">Card body</p>
        </Card>
      )}
      <Section title="Latency">
        {detailTable ? (
          <DetailTable />
        ) : (
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
        )}
      </Section>
      {options.peek === true && (
        <Peek
          title="Issue 12"
          tag="#12"
          fullPage="/runs"
          onClose={() => {
            document.documentElement.dataset['peekClosed'] = ''
          }}
        >
          {Array.from({ length: 60 }, (_, i) => (
            <p key={i} data-testid="peek-line">
              Line {i}
            </p>
          ))}
        </Peek>
      )}
      {options.dock !== undefined && options.dock !== false && <DockHarness mode={options.dock} />}
      {options.pageField === true && (
        <Input aria-label="Search runs" data-testid="field-page" placeholder="Search runs" />
      )}
      {options.sheet !== undefined && options.sheet !== false && (
        <SheetHarness options={options.sheet === true ? {} : options.sheet} />
      )}
      {aside !== false && (
        <PageAside
          title="Run details"
          {...asideProps}
          {...(handle !== undefined && { state: handle })}
        >
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
  // These frames pin the tab bar's own geometry (the opt-out); the section bar is `shell-phone-nav.layout.test.ts`.
  document.documentElement.setAttribute('data-phone-nav', 'tabs')
  if (options.present !== undefined) {
    localStorage.setItem(
      'basalt:panel:record:present',
      JSON.stringify({ v: 1, value: options.present }),
    )
  }
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
        {...(options.frame !== undefined && { frame: options.frame })}
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
