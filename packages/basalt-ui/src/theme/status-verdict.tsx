/**
 * `StatusVerdict` — a `StatusDot` plus its word in muted ink. With `phrase`, the visible word is
 * hidden from assistive tech and the full phrase is read instead, so a screen reader never hears a
 * bare "Over". INTERNAL: not on any barrel; `StatCard` and the notification centre compose it.
 */
import { StatusDot } from './status-dot'
import classes from './status-verdict.module.css'

export type StatusVerdictProps = {
  color: string
  /** The short visible word ("Over", "Error"). */
  word: string
  /** A longer phrase for assistive tech, read in place of the word. */
  phrase?: string
}

export function StatusVerdict({ color, word, phrase }: StatusVerdictProps) {
  return (
    <span className={classes.verdict}>
      <StatusDot color={color} />
      <span data-verdict-word="" {...(phrase !== undefined && { 'aria-hidden': true })}>
        {word}
      </span>
      {phrase !== undefined && <span className={classes.hidden}>{phrase}</span>}
    </span>
  )
}
