/**
 * The page the SSR layout test server-renders and then hydrates: the same tree on both sides, so
 * any box that moves is moved by hydration itself. Two tables in one column — a loaded one and the
 * `isLoading` fallback a streamed `<Suspense>` would show — sized for the same row count.
 */
import { MantineProvider } from '@mantine/core'
import { createBasaltTheme, cssVariablesResolver } from '../../../src/theme'
import { BasaltDataTable } from '../../../src/table/data-table'
import { createColumnHelper } from '../../../src/table/table-features'

type Row = { project: string; owner: string; region: string; updated: string; cost: number }
const col = createColumnHelper<Row>()

export const ROW_COUNT = 8
const MIN_WIDTH = 720
const ROWS: Row[] = Array.from({ length: ROW_COUNT }, (_, i) => ({
  project: `project-${i}`,
  owner: `owner-${i % 3}`,
  region: `eu-central-${i % 2}`,
  updated: `2026-10-${String(i + 1).padStart(2, '0')} 12:00 UTC`,
  cost: i * 37,
}))
const COLUMNS = [
  col.accessor('project', { header: 'Project' }),
  col.accessor('owner', { header: 'Owner' }),
  col.accessor('region', { header: 'Region' }),
  col.accessor('updated', { header: 'Updated' }),
  col.accessor('cost', { header: 'Cost', meta: { align: 'right' } }),
]

const theme = createBasaltTheme()

export function App() {
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme="dark"
    >
      <main style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div data-probe="loaded">
          <BasaltDataTable data={ROWS} columns={COLUMNS} minWidth={MIN_WIDTH} />
        </div>
        <div data-probe="fallback">
          <BasaltDataTable
            data={ROWS}
            columns={COLUMNS}
            isLoading
            skeletonRows={ROW_COUNT}
            minWidth={MIN_WIDTH}
          />
        </div>
      </main>
    </MantineProvider>
  )
}
