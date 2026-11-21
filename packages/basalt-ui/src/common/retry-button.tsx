/**
 * The one Retry button of the shared error anatomy (status dot + word + message + Retry). Internal:
 * `ErrorState`, `ChartCard`'s placeholder and a strip cell's error all render it, so they cannot
 * drift. `./charts` uses it.
 */
import type { ReactElement } from 'react'
import classes from './retry-button.module.css'

export function RetryButton({
  onClick,
  retrying = false,
  label = 'Retry',
}: {
  onClick: () => void
  /** A refetch is in flight: inert and marked busy. */
  retrying?: boolean
  /** The button's word: a caller that reads the message table passes `home.retry`; this leaf imports none. */
  label?: string
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
      {label}
    </button>
  )
}
