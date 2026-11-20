import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { ActionRow, BLOCK_FRAME } from './blocks'
import type { SiteAction, Slot } from './types'

export type SiteHeroProps = {
  /** The page's one `h1`. */
  title: Slot
  /** A short line above the title: a product name, a version. */
  eyebrow?: Slot
  /** The standfirst under the title. */
  description?: Slot
  /** The calls to action, as links; at most one `primary`. */
  actions?: readonly SiteAction[]
  /** Under the actions: an install command, a line of fine print. */
  children?: Slot
  /** Beside the text on a wide layout, under it on a narrow one: an image, a static part, or an island. */
  media?: Slot
  className?: string
}

/**
 * The top of a landing page: eyebrow, title, standfirst, actions and an optional media column.
 * The block is its own container: from 64rem the media sits beside the text, below that under it.
 * No gradient and no ornament; the media slot carries the picture, and it may hold an island.
 *
 * @useWhen a landing or product page opens with what the product is and what to do next
 * @neverWhen the page is an article or a docs entry (use `SiteArticle`)
 *
 * @example
 * <SiteHero
 *   title="Plan a sprint in one call"
 *   description="Estimate together, without an account."
 *   actions={[{ href: '/room', label: 'Start a room', primary: true }]}
 *   media={<img src="/room.png" alt="A planning room" />}
 * />
 */
export function SiteHero({
  title,
  eyebrow,
  description,
  actions = [],
  children,
  media,
  className,
}: SiteHeroProps): ReactElement {
  return (
    <section data-slot="site-hero" className={cn('@container', className)}>
      <div
        className={cn(
          BLOCK_FRAME,
          'grid grid-cols-[minmax(0,1fr)] items-center gap-10 py-12 @[64rem]:py-20',
          media !== undefined && '@[64rem]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @[64rem]:gap-16',
        )}
      >
        <div className="flex min-w-0 flex-col gap-6">
          {eyebrow !== undefined && (
            <p className="font-mono text-xs tracking-wider text-brand uppercase">{eyebrow}</p>
          )}
          <h1 className="max-w-[22ch] font-head text-display font-semibold text-balance text-foreground @[64rem]:text-[3.25rem] @[64rem]:leading-[1.05]">
            {title}
          </h1>
          {description !== undefined && (
            <p className="max-w-[60ch] text-lg text-muted-foreground">{description}</p>
          )}
          <ActionRow actions={actions} />
          {children !== undefined && <div className="max-w-[40rem]">{children}</div>}
        </div>
        {media !== undefined && <div className="min-w-0">{media}</div>}
      </div>
    </section>
  )
}
