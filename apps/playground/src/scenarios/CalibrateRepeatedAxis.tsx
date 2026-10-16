/**
 * Calibration seed — expected failing item: Expression 5 (no axis repeats a label). Defect: a 48 h
 * hourly chart whose `formatX` prints only DD.MM, so every tick on the x-axis reads the same date; the ticks are pinned to one calendar day so that holds whatever density the engine would pick.
 * Series, unit, title and period are clean.
 *
 * Route id: `probe-1` (neutral on purpose; the id → seed map lives in docs only).
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

/** Six ticks, every 4 h across the one calendar day in the middle of the span: all print `15.10`. */
const SAME_DAY_TICKS = Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(2026, 9, 15, i * 4)))

const ddmm = (d: Date): string =>
  `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`

export function CalibrateRepeatedAxis() {
  return (
    <Box data-shot="probe-1">
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
            xTicks={SAME_DAY_TICKS}
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
