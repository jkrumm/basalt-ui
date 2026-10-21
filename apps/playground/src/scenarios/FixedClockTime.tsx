import { Tooltip } from '@mantine/core'
import { agoLabel } from './ago-label'

/**
 * A relative time against a fixed reading date: the full date is the tooltip and the accessible
 * name, and the `<time>` takes focus so a keyboard user reaches the tooltip. `data-shot-tooltip` is
 * what `basalt-ui shot` hovers.
 */
export function FixedClockTime({ date, now, full }: { date: Date; now: Date; full: string }) {
  return (
    <Tooltip label={full}>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the tooltip must be keyboard-reachable */}
      <time dateTime={date.toISOString()} aria-label={full} tabIndex={0} data-shot-tooltip>
        {agoLabel(date, now)}
      </time>
    </Tooltip>
  )
}
