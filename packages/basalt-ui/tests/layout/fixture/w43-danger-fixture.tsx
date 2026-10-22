import type { ReactElement } from 'react'
import { BasaltDataTable, createColumnHelper } from '../../../src/table'

type Row = { site: string; mm: number }
const col = createColumnHelper<Row>()

const ROWS: Row[] = [
  { site: 'Chest', mm: 8 },
  { site: 'Abdomen', mm: 14 },
  { site: 'Thigh', mm: 11 },
]

const COLUMNS = [
  col.accessor('site', { header: 'Site', meta: { kind: 'entity' } }),
  col.accessor('mm', { header: 'mm', meta: { kind: 'number' } }),
]

const Dot = (): ReactElement => <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden />

/** Wave 43: argo's skinfold history shape — one lone icon action, danger or plain (`w43-danger`). */
export function W43DangerFixture(): ReactElement {
  const act = { icon: <Dot />, onClick: () => undefined }
  return (
    <div data-testid="w43-danger" style={{ width: 600 }}>
      <div data-testid="w43-danger-table">
        <BasaltDataTable
          data={ROWS}
          columns={COLUMNS}
          rowLabel={(r) => r.site}
          rowActions={[{ ...act, key: 'delete', label: 'Delete', danger: true }]}
        />
      </div>
      <div data-testid="w43-plain-table">
        <BasaltDataTable
          data={ROWS}
          columns={COLUMNS}
          rowLabel={(r) => r.site}
          rowActions={[{ ...act, key: 'edit', label: 'Edit' }]}
        />
      </div>
    </div>
  )
}
