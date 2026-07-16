/**
 * Prose — the ONE typography wrapper for long-form content (docs/CONTENT-SPEC.md §2/§5).
 *
 * `density='article'` (default) is the long-form reading density — 16px body, 1.7 leading, a 72ch
 * measure, and the wider `h1`/`h2` ladder steps. `density='chat'` is byte-equivalent to
 * `basalt-ui/agent`'s `StreamingMarkdown` typography (15px/1.55) — reach for it when composing
 * Prose around chat-density content instead of the agent module's own container.
 *
 * @example
 * import { Prose } from 'basalt-ui/content'
 *
 * <Prose>
 *   <h1 id="reading-dashboards">Reading dashboards</h1>
 *   <p>Article body…</p>
 * </Prose>
 */
import type { CSSProperties, ReactNode } from 'react'
import classes from './prose.module.css'

export type ProseDensity = 'article' | 'chat'

export type ProseProps = {
  /** Typography density — `'article'` (16px/1.7, default) or `'chat'` (15px/1.55). */
  readonly density?: ProseDensity
  /** Cap the line length at `--vx-prose-measure` (72ch). Default `true`. */
  readonly measure?: boolean
  readonly children: ReactNode
  readonly className?: string
  readonly style?: CSSProperties
}

export function Prose({
  density = 'article',
  measure = true,
  children,
  className,
  style,
}: ProseProps) {
  const rootClass = [classes.root, classes[density], measure && classes.measure, className]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rootClass}
      data-basalt-prose-density={density}
      data-basalt-prose-measure={measure}
      {...(style !== undefined && { style })}
    >
      {children}
    </div>
  )
}
