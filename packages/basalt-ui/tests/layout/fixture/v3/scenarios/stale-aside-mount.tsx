/**
 * The stale-aside scenario's browser half: the shape that left the aside on a record its URL no
 * longer names. A shell-less `Page` holds a `SplitPage` whose list picks a service (`?service=`),
 * whose detail pane holds a table of that service's deploys, and a `PageAside` bound to the open
 * deploy (`?deploy=`). The links stand for the crumb parent, the rail link and a list pick: each is
 * one history push over the address bar.
 */
import '../../tailwind-layers.css'
import '../../tailwind.generated.css'
import { useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import type { ControlHandle } from '../../../../../src/core/ports'
import { Page } from '../../../../../src/page/page'
import { PageAside } from '../../../../../src/page/page-aside'
import { SplitPage } from '../../../../../src/page/parts/split-page'
import { col } from '../../../../../src/table/core/kinds'
import { DataTable } from '../../../../../src/table/parts/data-table'
import { useDataTable } from '../../../../../src/table/use-data-table'
import type { FixtureSpec } from '../../spec'

const RESET = document.createElement('style')
RESET.textContent = '*,::before,::after{box-sizing:border-box}body{margin:0}'

function linkStylesheet(): Promise<void> {
  if (document.querySelector('link[data-stale-aside]') !== null) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/main.css'
    link.dataset['staleAside'] = ''
    link.addEventListener('load', () => resolve())
    link.addEventListener('error', () =>
      reject(new Error('LAYOUT: the fixture bundle emitted no main.css')),
    )
    document.head.append(link)
  })
}

const listeners = new Set<() => void>()
const notify = (): void => listeners.forEach((listener) => listener())
function subscribe(listener: () => void): () => void {
  window.addEventListener('popstate', notify)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', notify)
  }
}

/** A string field over one address-bar key; `clear` replaces, as a router field's does. */
function urlField(key: string): ControlHandle<string> {
  const read = (): string => new URLSearchParams(window.location.search).get(key) ?? ''
  const write = (next: string, replace: boolean): void => {
    const params = new URLSearchParams(window.location.search)
    if (next === '') params.delete(key)
    else params.set(key, next)
    const query = params.toString()
    const url = query === '' ? window.location.pathname : `?${query}`
    if (replace) window.history.replaceState(null, '', url)
    else window.history.pushState(null, '', url)
    notify()
  }
  return {
    key,
    kind: 'string',
    use: () => [useSyncExternalStore(subscribe, read, () => ''), (next) => write(next, false)],
    useSource: () => ({ source: 'own', inherited: undefined }),
    clear: (options) => write('', options?.replace === true),
    get isDefault() {
      return read() === ''
    },
  }
}

const service = urlField('service')
const deploy = urlField('deploy')

type Deploy = { id: string; version: string }
const DEPLOYS: Readonly<Record<string, readonly Deploy[]>> = {
  checkout: [
    { id: 'checkout-093', version: 'v3.13.0' },
    { id: 'checkout-092', version: 'v3.12.4' },
  ],
  billing: [{ id: 'billing-017', version: 'v1.4.0' }],
}

/** A link that is one history push: the crumb parent, the rail link and a list pick. */
function Go({ id, search, children }: { id: string; search: string; children: string }) {
  return (
    <a
      data-testid={id}
      href={search === '' ? window.location.pathname : `?${search}`}
      onClick={(event) => {
        event.preventDefault()
        window.history.pushState(null, '', search === '' ? window.location.pathname : `?${search}`)
        notify()
      }}
    >
      {children}
    </a>
  )
}

function DeployTable({ name }: { name: string }): ReactElement {
  const c = col<Deploy>()
  const table = useDataTable<Deploy>({
    id: 'deploys',
    label: 'Deploys',
    columns: [c.text('version', { header: 'Version' })],
    data: [...(DEPLOYS[name] ?? [])],
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    detail: (row) => <span data-testid="deploy-body">Deploy {row.version}</span>,
    detailTitle: (row) => `Deploy ${row.version}`,
    detailState: deploy,
    resetOn: [name],
  })
  return <DataTable table={table} />
}

function Screen(): ReactElement {
  const [name] = service.use()
  const [open] = deploy.use()
  return (
    <Page area="deploys">
      <nav className="flex gap-4 py-2">
        <Go id="crumb-parent" search={`service=${name}`}>
          Checkout
        </Go>
        <Go id="rail-services" search="">
          Services
        </Go>
      </nav>
      <SplitPage
        selected={name !== ''}
        onBack={service.clear}
        list={() => (
          <ul>
            {Object.keys(DEPLOYS).map((id) => (
              <li key={id}>
                <Go
                  id={`pick-${id}`}
                  search={`service=${id}${open === '' ? '' : `&deploy=${open}`}`}
                >
                  {id}
                </Go>
              </li>
            ))}
          </ul>
        )}
        detail={() => (name === '' ? null : <DeployTable name={name} />)}
      />
      <PageAside title="Inspector" state={deploy}>
        Pick a deploy
      </PageAside>
    </Page>
  )
}

let root: Root | null = null

export async function mount(_spec: FixtureSpec, container: HTMLElement): Promise<void> {
  await linkStylesheet()
  root?.unmount()
  if (!RESET.isConnected) document.head.append(RESET)
  window.history.replaceState(null, '', '/?service=checkout')
  window.scrollTo(0, 0)
  root = createRoot(container)
  root.render(<Screen />)
}
