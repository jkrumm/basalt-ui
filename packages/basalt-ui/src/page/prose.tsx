import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'

export type ProseDensity = 'article' | 'chat'

export type ProseProps = {
  /** Typography density: `'article'` (16px/1.7, default) or `'chat'` (15px/1.55). */
  density?: ProseDensity
  /** Cap the line length at 72ch. Default `true`. */
  measure?: boolean
  children: ReactNode
  /** Layout only (`mt-6`). */
  className?: string
}

/**
 * The one typography wrapper for long-form content. The `.vx-prose` sheet styles every element
 * below it; the density and the measure are set here. `article` (default) is 16px with 1.7 leading;
 * `chat` is 15px with 1.55. The measure is 72ch unless `measure={false}`.
 *
 * @useWhen long-form or chat text is rendered as HTML or Markdown and needs the article typography
 * @neverWhen the content is an app screen made of cards, tables and controls
 *
 * @example
 * <Prose>
 *   <h2 id="reading-dashboards">Reading dashboards</h2>
 *   <p>Article body…</p>
 * </Prose>
 */
export function Prose({
  density = 'article',
  measure = true,
  children,
  className,
}: ProseProps): ReactElement {
  return (
    <div
      data-slot="prose"
      className={cn(
        'vx-prose',
        density === 'chat' ? 'text-[15px] leading-[1.55]' : 'text-base leading-[1.7]',
        measure && 'max-w-[72ch]',
        className,
      )}
    >
      {children}
    </div>
  )
}
