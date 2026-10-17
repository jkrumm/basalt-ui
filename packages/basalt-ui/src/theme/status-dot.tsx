/**
 * `StatusDot` — the one status mark: a 6px round dot that carries a colour and nothing else. It is
 * decoration (`aria-hidden`); the meaning always travels as a word beside it, so a verdict is never
 * colour alone. INTERNAL: not on any barrel; `StatCard` and the notification centre compose it.
 */
import type { CSSProperties } from 'react'
import classes from './status-dot.module.css'

export type StatusDotProps = {
  /** Any CSS colour; callers pass a `VX.status.*` token so it re-resolves per scheme. */
  color: string
}

export function StatusDot({ color }: StatusDotProps) {
  return (
    // theme-allow hidden-inline-style — the colour is the one dynamic value; geometry is the CSS module's
    <span
      className={classes.dot}
      data-basalt-status-dot=""
      aria-hidden="true"
      style={{ '--basalt-status-dot': color } as CSSProperties}
    />
  )
}
