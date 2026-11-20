import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { ActionRow, BLOCK_FRAME } from './blocks'
import type { SiteAction, Slot } from './types'

export type SiteCallToActionProps = {
  /** The band's `h2`. */
  title: Slot
  description?: Slot
  /** The calls to action, as links; at most one `primary`. */
  actions: readonly SiteAction[]
  className?: string
}

/**
 * A full-width band that closes a page with one ask: a heading, a line and the actions. From the
 * `wide` size the actions sit at the end of the row, below it under the text.
 *
 * @useWhen a landing page or a guide ends by asking the reader to start
 * @neverWhen the ask belongs inside the text (use a link in the prose)
 *
 * @example
 * <SiteCallToAction title="Start in one command" actions={[{ href: '/docs', label: 'Read the docs', primary: true }]} />
 */
export function SiteCallToAction({
  title,
  description,
  actions,
  className,
}: SiteCallToActionProps): ReactElement {
  return (
    <section
      data-slot="site-call-to-action"
      className={cn('@container border-y border-border bg-card', className)}
    >
      <div
        className={cn(
          BLOCK_FRAME,
          'flex flex-col gap-6 py-12 @wide:flex-row @wide:items-center @wide:justify-between',
        )}
      >
        <div className="flex max-w-[60ch] flex-col gap-2">
          <h2 className="font-head text-lg font-semibold text-balance text-foreground @wide:text-display">
            {title}
          </h2>
          {description !== undefined && <p className="text-muted-foreground">{description}</p>}
        </div>
        <ActionRow actions={actions} />
      </div>
    </section>
  )
}
