/**
 * Calibration seed — expected failing item: Expression 5 (no axis repeats a label). Defect: a 48 h
 * hourly chart whose `formatX` prints only DD.MM, so every tick on the x-axis reads the same date.
 * Series, unit, title and period are clean.
 */
import { Box } from '@mantine/core'
import { ChartCard, Lines } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'

type HourRow = { at: Date; requests: number }

const START = Date.UTC(2026, 9, 14, 17)

/** A daily wave plus a lunch dip — literal arithmetic, so the rows never change between renders. */
const HOURLY: HourRow[] = Array.from({ length: 48 }, (_, h) => ({
  at: new Date(START + h * 3_600_000),
  requests: Math.round(
    900 + 600 * Math.sin(((h - 6) / 24) * 2 * Math.PI) - (h % 24 === 12 ? 150 : 0),
  ),
}))

const ddmm = (d: Date): string =>
  `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`

export function CalibrateRepeatedAxis() {
  return (
    <Box data-shot="calibrate-repeated-axis">
      <ChartCard
        title="Requests per hour, last 48 h"
        info="API requests per hour across all projects, in UTC."
      >
        <Box data-shot-hover data-shot-tooltip>
          <Lines
            data={HOURLY}
            ariaLabel="Requests per hour, last 48 hours"
            x={(d) => d.at}
            formatX={ddmm}
            series={[
              {
                key: 'requests',
                label: 'Requests',
                color: VX.neutral,
                getValue: (d) => d.requests,
              },
            ]}
          />
        </Box>
      </ChartCard>
    </Box>
  )
}
