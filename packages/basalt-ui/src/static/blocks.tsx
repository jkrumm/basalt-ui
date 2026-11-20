import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import type { SiteAction, Slot } from './types'

/** The width and gutter every page block shares with `SiteHeader` and `SiteFooter`. */
export const BLOCK_FRAME = 'mx-auto w-full max-w-[80rem] px-4 @regular:px-6'

/** A row of call-to-action links; the `primary` one is filled, the rest are outlined. */
export function ActionRow({ actions }: { actions: readonly SiteAction[] }): ReactElement | null {
  if (actions.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-3">
      {actions.map((action) => (
        <a
          key={action.href}
          href={action.href}
          className={cn(
            'focus-ring inline-flex h-10 items-center rounded-ctrl px-4 text-sm font-medium no-underline',
            action.primary === true
              ? 'bg-brand-fill text-on-brand hover:bg-brand-fill/90'
              : 'border border-border bg-card text-foreground hover:bg-accent',
          )}
        >
          {action.label}
        </a>
      ))}
    </div>
  )
}

/** A block's `h2` and its standfirst. */
export function BlockHead({
  title,
  description,
  className,
}: {
  title?: Slot
  description?: Slot
  className?: string
}): ReactElement | null {
  if (title === undefined && description === undefined) return null
  return (
    <div className={cn('flex max-w-[60ch] flex-col gap-2', className)}>
      {title !== undefined && (
        <h2 className="font-head text-lg font-semibold text-balance text-foreground @wide:text-display">
          {title}
        </h2>
      )}
      {description !== undefined && <p className="text-muted-foreground">{description}</p>}
    </div>
  )
}
