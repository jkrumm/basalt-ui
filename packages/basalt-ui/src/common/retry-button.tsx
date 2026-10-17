/**
 * The one Retry button of the shared error anatomy (status dot + word + message + Retry). Internal:
 * `ErrorState`, `ChartCard`'s placeholder and a strip cell's error all render it, so they cannot
 * drift. Mantine-free — `./charts` uses it with no `@mantine/*` installed.
 */
import type { ReactElement } from 'react'
import classes from './retry-button.module.css'

export function RetryButton({
  onClick,
  retrying = false,
}: {
  onClick: () => void
  /** A refetch is in flight: inert and marked busy. */
  retrying?: boolean
}): ReactElement {
  return (
    <button
      type="button"
      className={classes.retry}
      data-basalt-retry=""
      disabled={retrying}
      {...(retrying && { 'aria-busy': true })}
      onClick={onClick}
    >
      Retry
    </button>
  )
}
