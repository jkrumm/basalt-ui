import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { AppLink } from '../core/link'
import { home } from '../core/messages/home'
import { useMessages } from '../core/messages/use-messages'
import type { CardAction } from '../core/phase'
import type { IconComponent } from '../core/ports'
import { buttonVariants } from '../ui/button'

type EmptyStateBase = {
  /** One line: the cause, and the next step when there is one. Required: never a bare "No data". */
  cause: string
  /** What is empty, in a few words (`No runs yet`), on the line above `cause`. Drawn on the `page` tier only. */
  title?: string
  icon?: IconComponent
  /**
   * `page` for a whole route body (generous space), `section` for a region inside a card or panel.
   *
   * @default 'page'
   */
  tier?: 'page' | 'section'
}

/** One action, or the filtered variant: the two never meet, because filtered renders Clear filters. */
export type EmptyStateProps = EmptyStateBase &
  ({ action?: CardAction; filtered?: never } | { filtered: { reset: () => void }; action?: never })

const ACTION = buttonVariants({ variant: 'secondary', size: 'sm' })

/**
 * The state of a region that has nothing to show: one line of cause and at most one action. With
 * active filters it is the filtered variant, whose action is Clear filters; the line says what the
 * filters hid. It never says "No data": the line names the cause, so a failed load cannot pass for
 * an empty list (a failed query is `QueryState`'s error arm, not this).
 *
 * @useWhen a settled query or a filter left a page or region with nothing to list
 * @neverWhen the data failed to load or is still loading (use `QueryState`, or a frame `phase`)
 *
 * @example
 * <EmptyState
 *   cause="The queue is filtered to Blocked; clear it to see all 12."
 *   filtered={{ reset: clearFilters }}
 *   tier="section"
 * />
 *
 * @example
 * <EmptyState title="No runs yet" cause="Start one from the CLI." action={{ label: 'Open docs', href: '/docs' }} />
 */
export function EmptyState(props: EmptyStateProps): ReactElement {
  const { cause, title, icon: Icon, tier = 'page', action, filtered } = props
  const t = useMessages(home)
  return (
    <div
      data-slot="empty-state"
      data-tier={tier}
      className={cn(
        'flex min-w-0 flex-col items-center gap-2 text-center',
        tier === 'page'
          ? 'px-6 py-16'
          : 'rounded-inset px-5 py-8 shadow-[inset_0_0_0_1px_var(--basalt-hairline)] forced-colors:border forced-colors:border-current',
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
      {title !== undefined && tier === 'page' && (
        <p data-slot="empty-state-title" className="m-0 text-lg font-semibold text-foreground">
          {title}
        </p>
      )}
      <p
        data-slot="empty-state-why"
        className={cn(
          'm-0 max-w-90 text-muted-foreground',
          tier === 'page' ? 'text-md' : 'text-sm',
        )}
      >
        {cause}
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
          <AppLink href={action.href} data-slot="empty-state-action" className={ACTION}>
            {action.label}
          </AppLink>
        ) : (
          <button
            type="button"
            data-slot="empty-state-action"
            className={ACTION}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))
      )}
    </div>
  )
}
