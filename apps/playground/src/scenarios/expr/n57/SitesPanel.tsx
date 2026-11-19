import { DataPanel } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import type { ChartFocus } from 'basalt-ui/charts'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { SITES } from './fixture'
import { topCell } from './summary'
import type { Cell } from './summary'

type Row = { id: string; name: string; sky: string; drive: number; best: number }
const c = col<Row>()

const COLUMNS = [
  c.entity('name', { header: 'Site', priority: 1, sortable: false, sub: (row) => row.sky }),
  c.meter('drive', { header: 'Drive, min', priority: 2, max: 155, card: 'value', sortable: false }),
  c.number('best', { header: 'Best, h', priority: 2, digits: 1, sortable: false }),
]

export function SitesPanel({
  cells,
  focus,
  phase,
  empty,
}: {
  cells: readonly Cell[]
  focus: ChartFocus<Cell>
  phase: Phase
  empty: string | null
}) {
  const rows: Row[] =
    empty === null
      ? SITES.map((site) => {
          const top = topCell(cells.filter((cell) => cell.site.id === site.id))
          return {
            id: site.id,
            name: site.name,
            drive: site.drive,
            sky: `${site.sky} mag/arcsec²`,
            best: top === null ? 0 : top.usable,
          }
        })
      : []
  const table = useDataTable({
    id: 'darksite-sites',
    label: 'Drive and sky',
    columns: COLUMNS,
    data: rows,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: SITES.length,
  })
  return (
    <DataPanel
      title="Sites"
      subtitle="A higher mag is a darker sky"
      phase={phase}
      empty={empty === null ? null : { cause: empty }}
      // cycle-expression-13: DataPanel sizes phone cards at 92 px and a meter card is 108 px, so the body is sized a row past the four the table needs, which leaves a blank band at 1800
      bodySize={{ rows: SITES.length + 2 }}
      body={() => (
        <DataTable
          table={table}
          focusItems={{ focus, holds: (row, cell) => cell.site.id === row.id }}
        />
      )}
    />
  )
}
