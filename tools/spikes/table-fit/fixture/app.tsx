/**
 * One table per page load, chosen by the query string:
 *   site=<id>  width=<px|full>  layout=fixed|auto  cards=shipped|spike  order=argo|reordered
 * The page exposes `window.tableFit` once the DOM is settled: the plan of the table (the same
 * `planTable` the table runs), the warnings it raised, and the query that produced it.
 */
import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'
import type { ReactElement } from 'react'
import { planTable } from '../../../../packages/basalt-ui/src/table/core/plan'
import { specOf } from '../../../../packages/basalt-ui/src/table/core/kinds'
import { DataTable } from '../../../../packages/basalt-ui/src/table/parts/data-table'
import { useDataTable } from '../../../../packages/basalt-ui/src/table/use-data-table'
import type { UseDataTable } from '../../../../packages/basalt-ui/src/table/contract'
import { SITES } from './sites'

const params = new URLSearchParams(location.search)
const siteId = params.get('site') ?? 'ledger'
const width = params.get('width') ?? 'full'
const layout = params.get('layout') ?? 'fixed'
const cards = params.get('cards') ?? 'shipped'
const order = params.get('order') ?? 'argo'
const sub = params.get('sub') ?? 'inline'
const theme = params.get('theme') ?? 'light'

document.documentElement.dataset.theme = theme

const site = SITES[siteId]
if (site === undefined) throw new Error(`unknown site ${siteId}`)

function orderedColumns() {
  const columns = site!.columns()
  if (order !== 'reordered' || site!.reorder === undefined) return columns
  const rank = new Map(site!.reorder.map((id: string, i: number) => [id, i]))
  return columns.toSorted(
    (a, b) => (rank.get(a.id) ?? columns.length) - (rank.get(b.id) ?? columns.length),
  )
}

/** Puts the card place and header label on every cell and builds the clamped meta run (spike cards). */
function decorate(
  root: HTMLElement,
  places: Record<string, string>,
  headers: Record<string, string>,
) {
  root.dataset.spikeLayout = layout
  root.dataset.spikeSub = sub
  if (cards !== 'spike') return
  root.dataset.spikeCards = ''
  const visibleIds = Object.keys(places)
  for (const row of root.querySelectorAll<HTMLElement>('tbody tr')) {
    if (row.querySelector('[data-spike-run]') !== null) continue
    const cells = [...row.querySelectorAll<HTMLElement>(':scope > td')]
    const offset = cells.length - visibleIds.length
    const run: string[] = []
    cells.forEach((cell, i) => {
      const id = visibleIds[i - offset]
      if (id === undefined) return
      const place = places[id] ?? 'detail'
      cell.dataset.place = place
      if (place === 'meta' && cell.textContent && cell.textContent.trim() !== '–')
        run.push(`${headers[id] ?? id} ${cell.textContent.trim()}`)
    })
    const last = cells.at(-1)
    if (last === undefined || run.length === 0) continue
    const td = document.createElement('td')
    td.dataset.spikeRun = ''
    td.dataset.slot = 'spike-run'
    td.textContent = run.join(' · ')
    last.after(td)
  }
}

function Probe(): ReactElement {
  const columns = orderedColumns()
  const warnings: string[] = []
  const plan = planTable(columns, { warn: (m) => warnings.push(m) })
  const t = useDataTable({
    id: siteId,
    label: siteId,
    columns,
    data: site!.rows,
    getRowId: site!.getRowId,
    mode: { kind: 'client' },
    pager: 'none',
    ...site!.props,
  } as UseDataTable<never>)

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-slot="table-root"]')
    if (root === null) return
    const places: Record<string, string> = {}
    const headers: Record<string, string> = {}
    for (const planned of plan.columns) {
      if (!planned.visible) continue
      places[planned.id] = planned.place
    }
    for (const column of columns) headers[column.id] = specOf(column).header
    decorate(root, places, headers)
    ;(window as unknown as { tableFit: unknown }).tableFit = {
      site: siteId,
      argo: site!.argo,
      plan,
      warnings,
      needs: site!.needs,
      reorder: site!.reorder ?? null,
      rows: site!.rows.length,
      params: Object.fromEntries(params),
    }
  })
  return <DataTable table={t} />
}

const container = document.getElementById('root')
if (container === null) throw new Error('missing #root')
container.style.width = width === 'full' ? '100%' : `${width}px`
document.body.classList.add('bg-background', 'text-foreground')
createRoot(container).render(<Probe />)
