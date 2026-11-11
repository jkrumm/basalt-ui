import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { home } from '../core/messages/home'
import { useMessages } from '../core/messages/use-messages'
import type { CardAction } from '../core/phase'
import type { IconComponent } from '../core/ports'
import { buttonVariants } from '../ui/button'

type EmptyStateBase = {
  /** One line: the cause, and the next step when there is one. Required: never a bare "No data". */
  why: string
  icon?: IconComponent
  /** `page` for a whole route body (generous space), `section` for a region inside a card or panel. Default `page`. */
  tier?: 'page' | 'section'
}

/** One action, or the filtered variant: the two never meet, because filtered renders Clear filters. */
export type EmptyStateProps = EmptyStateBase &
  ({ action?: CardAction; filtered?: never } | { filtered: { reset: () => void }; action?: never })

const ACTION = buttonVariants({ variant: 'secondary', size: 'sm' })

/**
 * The state of a region that has nothing to show: one line of why and at most one action. With
 * active filters it is the filtered variant, whose action is Clear filters; the line says what the
 * filters hid. It never says "No data": the line names the cause, so a failed load cannot pass for
 * an empty list (a failed query is `QueryState`'s error arm, not this).
 *
 * @useWhen a settled query or a filter left a page or region with nothing to list
 * @neverWhen the data failed to load or is still loading (use `QueryState`, or a frame `phase`)
 *
 * @example
 * <EmptyState
 *   why="The queue is filtered to Blocked; clear it to see all 12."
 *   filtered={{ reset: clearFilters }}
 *   tier="section"
 * />
 *
 * @example
 * <EmptyState why="No runs yet. Start one from the CLI." action={{ label: 'Open docs', href: '/docs' }} />
 */
export function EmptyState(props: EmptyStateProps): ReactElement {
  const { why, icon: Icon, tier = 'page', action, filtered } = props
  const t = useMessages(home)
  return (
    <div
      data-slot="empty-state"
      data-tier={tier}
      className={cn(
        'flex min-w-0 flex-col items-center gap-2 text-center',
        tier === 'page'
          ? 'px-6 py-16'
          : 'rounded-inset px-5 py-8 shadow-[inset_0_0_0_1px_var(--vx-hairline)]',
      )}
    >
      {Icon !== undefined && (
        <span
          data-slot="empty-state-icon"
          className="inline-flex size-8 items-center justify-center text-faint"
        >
          <Icon aria-hidden="true" size={24} />
        </span>
      )}
      <p
        data-slot="empty-state-why"
        className={cn(
          'm-0 max-w-90 text-muted-foreground',
          tier === 'page' ? 'text-md' : 'text-sm',
        )}
      >
        {why}
      </p>
      {filtered !== undefined ? (
        <button
          type="button"
          data-slot="empty-state-action"
          className={ACTION}
          onClick={filtered.reset}
        >
          {t('home.filtersClear')}
        </button>
      ) : (
        action !== undefined &&
        ('href' in action ? (
          <a href={action.href} data-slot="empty-state-action" className={ACTION}>
            {action.label}
          </a>
        ) : (
          <button
            type="button"
            data-slot="empty-state-action"
            className={ACTION}
            onClick={action.onSelect}
          >
            {action.label}
          </button>
        ))
      )}
    </div>
  )
}
