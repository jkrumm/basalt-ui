import { Bars } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import { formatDay, readCount } from './read'
import type { DayRow } from './read'

export function ImportsPerDay({ rows }: { rows: DayRow[] }) {
  return (
    <Bars
      ariaLabel="Imports per day"
      chartId="imports-per-day"
      data={rows}
      height={220}
      getX={(row) => row.day}
      getValue={readCount}
      formatX={formatDay}
      xTicks={5}
      positiveBars={[
        {
          key: 'raw',
          label: 'RAW',
          color: VX.accent,
          formatValue: (v) => `${v} files`,
        },
        {
          key: 'jpeg',
          label: 'JPEG',
          color: VX.faint,
        },
      ]}
    />
  )
}
