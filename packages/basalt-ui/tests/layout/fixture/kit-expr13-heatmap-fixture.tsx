/**
 * Expression cycle 13 kit fixes, the Heatmap annotations (`v3-expr-13-kit-fixes` 8): n57's grid in a
 * 390 px card with a keyboard- or pointer-focused cell, a "best" annotation on the top cell and one
 * moon state. The annotations are not held back for the focused cell, as the scenario does.
 * Entry of `kit-expr13-heatmap.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { useChartFocus } from '../../../src/charts/focus'
import { Heatmap } from '../../../src/charts/parts/heatmap'
import { BASALT, alpha } from '../../../src/tokens'

type Cell = { row: string; col: string; v: number | null; moon?: boolean; best?: boolean }

const ROWS = ['Sat 28', 'Sun 29', 'Mon 30', 'Tue 1', 'Wed 2']
const COLS = ['Kamm', 'Salzsee', 'Ost', 'Hoch']
const VALUES: readonly (readonly (number | null)[])[] = [
  [3, 7, 5, 2],
  [6, 14, 4, 8],
  [2, 5, 12, null],
  [8, 4, 6, 5],
  [4, 6, 7, 3],
]
const CELLS: readonly Cell[] = ROWS.flatMap((row, r) =>
  COLS.map((col, c) => {
    const v = VALUES[r]?.[c] ?? null
    return { row, col, v, moon: r === 2 && c === 3, best: r === 1 && c === 1 }
  }),
)

const STATES = [
  { key: 'moon', label: 'Clear, moon up', color: alpha(BASALT.inkMuted, 0.7) },
] as const

function Fixture(): ReactElement {
  const focus = useChartFocus(CELLS, { announce: (d) => `${d.row} ${d.col}` })
  return (
    <main lang="en" className="p-4 text-foreground">
      <div data-testid="x13-heatmap" className="h-[420px] min-w-0">
        <Heatmap
          label="Hours of clear darkness, by night and place"
          data={CELLS}
          rows={ROWS}
          cols={COLS}
          getRow={(c) => c.row}
          getCol={(c) => c.col}
          getValue={(c) => c.v}
          getState={(c) => (c.moon ? 'moon' : undefined)}
          states={STATES}
          tickCols={COLS}
          color={BASALT.brand}
          domain={[0, 15]}
          formatValue={(v) => `${v} h`}
          formatLegend={(v) => `${v} h`}
          annotate={(c) => (c.best ? '6 best' : c.v === null ? null : String(c.v))}
          focus={focus}
          tooltip={false}
          matchHeight
        />
      </div>
      {focus.live}
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
