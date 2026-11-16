/**
 * The `table-deep-link` fixture (docs/v3/issues/cycles/v3-dogfood-2-deep-link.json): a table whose
 * `detailState` field names a row on load, inside a `Page` whose `PageAside` hosts the detail.
 * The document sets `window.asideState` to `'bound'` (the aside's `state` is the same field) or
 * `'unbound'`. The field is kept outside React the way the URL keeps it, and `field-value` shows it.
 */
import { createRoot } from 'react-dom/client'
import { useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import type { ControlHandle } from '../../src/core/ports'
import { Page } from '../../src/page/page'
import { PageAside } from '../../src/page/page-aside'
import { col } from '../../src/table/core/kinds'
import { DataTable } from '../../src/table/parts/data-table'
import { useDataTable } from '../../src/table/use-data-table'

type Row = { id: string; title: string }

const ROWS: Row[] = [
  { id: 'login-crash', title: 'Login crash' },
  { id: 'slow-export', title: 'Slow export' },
  { id: 'dark-icons', title: 'Dark icons' },
]

let value = 'slow-export'
const listeners = new Set<() => void>()
const set = (next: string): void => {
  value = next
  for (const listener of listeners) listener()
}
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const field: ControlHandle<string> = {
  key: 'issue',
  kind: 'string',
  isDefault: true,
  use: () => [useSyncExternalStore(subscribe, () => value), set],
  useSource: () => ({ source: 'own', inherited: undefined }),
  clear: () => set(''),
} as unknown as ControlHandle<string>

const c = col<Row>()

function Issues(): ReactElement {
  const bound = (window as unknown as { asideState?: string }).asideState === 'bound'
  const t = useDataTable<Row>({
    id: 'issues',
    label: 'Issues',
    columns: [c.text('title', { header: 'Title' })],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    detail: (row) => <span data-testid="detail-body">{row.title} detail</span>,
    detailState: field,
  })
  const current = useSyncExternalStore(subscribe, () => value)
  return (
    <Page>
      <output data-testid="field-value">{current}</output>
      <DataTable table={t} />
      <PageAside title="Inspector" {...(bound && { state: field })}>
        own
      </PageAside>
    </Page>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(
  // theme-allow -- the wrapper is the probe's payload
  <main lang="en" className="text-foreground">
    <Issues />
  </main>,
)
