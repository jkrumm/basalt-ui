/**
 * Expression cycle 16 kit fixes, the Heatmap x ticks (`v3-expr-16-kit-fixes` 2): n77's grid (14 days,
 * every day named in `tickCols`) and n78's (30 days, weekly names) in a card-wide box. Entry of
 * `kit-expr16h-heatmap.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { Heatmap } from '../../../src/charts/parts/heatmap'
import { BASALT } from '../../../src/tokens'

type Cell = { row: string; col: string; v: number }

const grid = (rows: readonly string[], cols: readonly string[]): Cell[] =>
  rows.flatMap((row, r) => cols.map((col, c) => ({ row, col, v: (r * 3 + c) % 5 })))

const DAYS_14 = Array.from({ length: 14 }, (_, i) => String(i))
const DAYS_30 = Array.from({ length: 30 }, (_, i) => String(i))
const WEEKLY = [0, 7, 14, 21, 28].map(String)
const ROWS = ['web', 'api', 'billing']

const NOV = new Map(DAYS_14.map((d) => [d, `Nov ${Number(d) + 7}`]))
const OCT = new Map(DAYS_30.map((d) => [d, `Oct ${Number(d) + 1}`]))
const DATA_14 = grid(ROWS, DAYS_14)
const DATA_30 = grid(ROWS, DAYS_30)
const getRow = (c: Cell): string => c.row
const getCol = (c: Cell): string => c.col
const getValue = (c: Cell): number => c.v
const nov = (d: string): string => NOV.get(d) ?? d
const oct = (d: string): string => OCT.get(d) ?? d

function Fixture(): ReactElement {
  return (
    <main lang="en" className="p-4 text-foreground">
      <div data-testid="x16-days14" className="h-[200px] w-full max-w-[342px] min-w-0">
        <Heatmap
          label="Failures, 14 days"
          data={DATA_14}
          rows={ROWS}
          cols={DAYS_14}
          getRow={getRow}
          getCol={getCol}
          getValue={getValue}
          formatCol={nov}
          tickCols={DAYS_14}
          color={BASALT.bad}
          tooltip={false}
          matchHeight
        />
      </div>
      <div data-testid="x16-days30" className="mt-4 h-[200px] w-full max-w-[740px] min-w-0">
        <Heatmap
          label="Mail, 30 days"
          data={DATA_30}
          rows={ROWS}
          cols={DAYS_30}
          getRow={getRow}
          getCol={getCol}
          getValue={getValue}
          formatCol={oct}
          tickCols={WEEKLY}
          color={BASALT.bad}
          tooltip={false}
          matchHeight
        />
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
