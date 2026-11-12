import { Bars } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import { formatDay, readCount } from './read'
import type { DayRow } from './read'

export function ImportsPerDay({ rows }: { rows: DayRow[] }) {
  return (
    <Bars
      ariaLabel="Imports per day"
      cursor="imports-per-day"
      data={rows}
      height={220}
      x={{ value: (row) => row.day, format: formatDay }}
      series={[
        {
          key: 'raw',
          label: 'RAW',
          color: VX.accent,
          format: (v) => `${v} files`,
          mark: 'bar',
          y: (d) => readCount(d, 'raw'),
        },
        {
          key: 'jpeg',
          label: 'JPEG',
          color: VX.faint,
          mark: 'bar',
          y: (d) => readCount(d, 'jpeg'),
        },
      ]}
    />
  )
}
