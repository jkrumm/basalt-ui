import { Heatmap } from 'basalt-ui/charts'
import { BASALT } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'
import { CHART_WIDTH, RUNS } from '../../demo/data'

type Cell = { route: string; day: string; km: number | null }

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ROUTES = [...new Set(RUNS.map((r) => r.name.replace(/ \d+$/, '')))]
const CELLS: readonly Cell[] = ROUTES.flatMap((route, r) =>
  DAYS.map((day, d) => ({ route, day, km: (r + d) % 5 === 0 ? null : ((r * 7 + d * 3) % 11) + 2 })),
)
const getRow = (c: Cell): string => c.route
const getCol = (c: Cell): string => c.day
const getValue = (c: Cell): number | null => c.km

export function Demo(): ReactElement {
  return (
    <div style={{ width: CHART_WIDTH, maxWidth: '100%' }}>
      <Heatmap
        label="Kilometres per route and weekday"
        data={CELLS}
        getRow={getRow}
        getCol={getCol}
        getValue={getValue}
        rows={ROUTES}
        cols={DAYS}
        color={BASALT.brand}
        domain={[0, 12]}
        height={220}
      />
    </div>
  )
}
