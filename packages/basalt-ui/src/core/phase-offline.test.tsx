/**
 * The offline phase: a query with no data whose fetch is paused waits for the connection, so every
 * v3 frame draws the shared Offline line and prints `data-phase="offline"`, never a skeleton.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { StatCell } from '../cards/stat-cell'
import { ChartCard } from '../charts/parts/chart-card'
import { DataTable } from '../table/parts/data-table'
import { col } from '../table/core/kinds'
import { useDataTable } from '../table/use-data-table'
import { CardPhase } from '../ui/card'
import { home } from './messages/home'
import { resolvePhase } from './phase'
import type { QueryStateLike } from './ports'

afterEach(cleanup)

type Paused = QueryStateLike & { fetchStatus: 'fetching' | 'paused' | 'idle' }

const query = (over: Partial<Paused> = {}): Paused => ({
  isPending: true,
  isError: false,
  error: null,
  fetchStatus: 'paused',
  ...over,
})

const OFFLINE = home['home.offline']

describe('resolvePhase', () => {
  test('a pending query with a paused fetch is offline, ahead of loading', () => {
    expect(resolvePhase({ phase: query() })).toEqual({ tag: 'offline', body: false })
  })

  test('a fetching or idle pending query stays loading', () => {
    expect(resolvePhase({ phase: query({ fetchStatus: 'fetching' }) }).tag).toBe('loading')
    expect(resolvePhase({ phase: query({ fetchStatus: 'idle' }) }).tag).toBe('loading')
  })

  test('a paused fetch over data keeps the data: the query is not pending', () => {
    expect(resolvePhase({ phase: query({ isPending: false }) }).tag).toBe('ready')
  })

  test('offline beats empty, as loading does', () => {
    expect(resolvePhase({ phase: query(), empty: { cause: 'None' } }).tag).toBe('offline')
  })
})

type Row = { id: string; name: string }

function Table({ phase }: { phase: QueryStateLike }): ReactElement {
  const c = col<Row>()
  const t = useDataTable<Row>({
    id: 'offline-table',
    label: 'Rows',
    columns: [c.text('name', { header: 'Name' })],
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
  })
  return <DataTable table={t} />
}

describe('the v3 frames over a paused query with no data', () => {
  test('DataTable draws the Offline line in its body, no skeleton rows', () => {
    const { container } = render(<Table phase={query()} />)
    expect(container.querySelector('[data-slot="table-root"]')?.getAttribute('data-phase')).toBe(
      'offline',
    )
    expect(container.querySelector('[data-slot="table-offline"]')?.textContent).toBe(OFFLINE)
    expect(container.querySelector('[data-skeleton]')).toBeNull()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  test('DataTable still loads for a fetching query', () => {
    const { container } = render(<Table phase={query({ fetchStatus: 'fetching' })} />)
    expect(container.querySelector('[data-skeleton]')).not.toBeNull()
  })

  test('ChartCard draws the Offline line, not the plot skeleton', () => {
    let called = false
    const { container } = render(
      <ChartCard
        title="Requests"
        phase={query()}
        chart={() => {
          called = true
          return null
        }}
      />,
    )
    expect(container.querySelector('[data-slot="card"]')?.getAttribute('data-phase')).toBe(
      'offline',
    )
    expect(container.querySelector('[data-slot="chart-box"]')?.getAttribute('data-phase')).toBe(
      'offline',
    )
    expect(container.querySelector('[data-slot="chart-offline"]')?.textContent).toBe(OFFLINE)
    expect(container.querySelector('[data-slot="chart-skeleton"]')).toBeNull()
    expect(called).toBe(false)
  })

  test('StatCell draws the Offline line in its figure, not skeleton bars', () => {
    const { container } = render(<StatCell title="Recovery" value={82} phase={query()} />)
    const cell = container.querySelector('[data-slot="stat-cell"]')
    expect(cell?.getAttribute('data-phase')).toBe('offline')
    expect(cell?.getAttribute('aria-busy')).toBeNull()
    expect(container.querySelector('[data-slot="stat-figure"]')?.textContent).toBe(OFFLINE)
  })

  test('CardPhase draws the Offline line and never calls its body', () => {
    let called = false
    const { container } = render(
      <CardPhase phase={query()} height={72}>
        {() => {
          called = true
          return null
        }}
      </CardPhase>,
    )
    expect(container.querySelector('[data-slot="card-phase"]')?.getAttribute('data-phase')).toBe(
      'offline',
    )
    expect(container.querySelector('[data-slot="card-offline"]')?.textContent).toBe(OFFLINE)
    expect(called).toBe(false)
  })
})
