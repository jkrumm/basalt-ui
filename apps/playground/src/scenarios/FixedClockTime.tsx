import { Tooltip, VisuallyHidden } from '@mantine/core'
import { agoLabel } from './ago-label'

/**
 * A relative time against a fixed reading date, behaving like the package's `relative-time` cell:
 * the full date opens below the cell (above it covers the header) on hover and on keyboard focus,
 * and is the `<time>`'s accessible text. `data-shot-tooltip` is what `basalt-ui shot` hovers.
 */
export function FixedClockTime({ date, now, full }: { date: Date; now: Date; full: string }) {
  return (
    <Tooltip label={full} position="bottom" events={{ hover: true, focus: true, touch: false }}>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the tooltip opens on focus */}
      <time dateTime={date.toISOString()} tabIndex={0} data-shot-tooltip>
        {agoLabel(date, now)}
        <VisuallyHidden>{`, ${full}`}</VisuallyHidden>
      </time>
    </Tooltip>
  )
}
