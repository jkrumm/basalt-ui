/**
 * `StatusDot` — the one status mark: a 6px round dot that carries a colour and nothing else. It is
 * decoration (`aria-hidden`); the meaning always travels as a word beside it (`StatusVerdict`), so a
 * verdict is never colour alone. Exported from the root.
 *
 * @example
 * <StatusDot color={VX.status.ok} />
 */
import type { CSSProperties } from 'react'
import classes from './status-dot.module.css'

export type StatusDotProps = {
  /** Any CSS colour; callers pass a `VX.status.*` token so it re-resolves per scheme. */
  color: string
}

type DotStyle = CSSProperties & { '--basalt-status-dot': string }

export function StatusDot({ color }: StatusDotProps) {
  const style: DotStyle = { '--basalt-status-dot': color }
  return <span className={classes.dot} data-basalt-status-dot="" aria-hidden="true" style={style} />
}
