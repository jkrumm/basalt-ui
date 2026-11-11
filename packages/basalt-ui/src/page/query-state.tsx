import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { home } from '../core/messages/home'
import { useMessages } from '../core/messages/use-messages'
import { resolvePhase } from '../core/phase'
import type { Empty, ErrorKind } from '../core/phase'
import type { Phase, QueryStateLike } from '../core/ports'
import { buttonVariants } from '../ui/button'
import { Spinner } from '../ui/skeleton'
import { EmptyState } from './empty-state'

/**
 * A TanStack query result also carries `fetchStatus`; `QueryStateLike` does not name it, so it is
 * read here as an optional extra. A `paused` fetch with no data is the offline case.
 */
type QueryResultLike = QueryStateLike & {
  fetchStatus?: 'fetching' | 'paused' | 'idle'
}

export type QueryStateProps = {
  /** A `Phase` or the app's query object, as every frame takes it. */
  phase: Phase | QueryResultLike
  /** The measured-empty state; it applies once the query settled and shows `EmptyState`. */
  empty?: Empty | null
  /** `page` for a route body, `section` for a region in a card or panel. Default `page`. */
  tier?: 'page' | 'section'
  /** Replaces the default spinner while loading, e.g. a skeleton in the loaded shape. */
  loading?: ReactNode
  /** Rendered when there is data worth showing. */
  children?: ReactNode
}

const ACTION = buttonVariants({ variant: 'secondary', size: 'sm' })

const isQueryResult = (phase: QueryStateProps['phase']): phase is QueryResultLike =>
  typeof phase === 'object' && 'isPending' in phase

const retryOf = (phase: QueryStateProps['phase']): (() => void) | undefined => {
  if (!isQueryResult(phase) || phase.refetch === undefined) return undefined
  const { refetch } = phase
  return () => {
    void refetch()
  }
}

const ERROR_KEYS = {
  forbidden: 'home.error.forbidden',
  'not-found': 'home.error.not-found',
  default: 'home.error.default',
} as const satisfies Record<ErrorKind | 'default', keyof typeof home>

function Notice({
  tier,
  alert,
  children,
}: {
  tier: 'page' | 'section'
  alert: boolean
  children: ReactNode
}): ReactElement {
  const className = cn(
    'flex min-w-0 flex-col items-center gap-2 text-center',
    tier === 'page' ? 'px-6 py-16' : 'px-5 py-8',
  )
  return alert ? (
    <div role="alert" className={className}>
      {children}
    </div>
  ) : (
    <output className={className}>{children}</output>
  )
}

/**
 * The one wrapper a page puts around an async result. It owns the branch precedence, which is the
 * point: loading, then error, then empty, then the data. A failed query never reads as "nothing
 * here", a failed refetch over saved data keeps the data and says it is old, and a fetch paused
 * for lack of a connection, with nothing to show, reads Offline instead of spinning forever.
 *
 * A 403 or 404 on the error picks the forbidden or not-found line, and forbidden offers no retry.
 *
 * @useWhen a page or region renders the result of one query and must tell loading, failure, offline and empty apart
 * @neverWhen the container is a frame that already takes `phase` (`StatCard`, `ChartCard`) or the data is synchronous
 *
 * @example
 * <QueryState
 *   phase={runs}
 *   empty={runs.data?.length === 0 ? { cause: 'No runs match. Widen the dates.' } : null}
 * >
 *   <RunTable rows={runs.data ?? []} />
 * </QueryState>
 */
export function QueryState({
  phase,
  empty,
  tier = 'page',
  loading,
  children,
}: QueryStateProps): ReactElement {
  const t = useMessages(home)
  const offline = isQueryResult(phase) && phase.isPending && phase.fetchStatus === 'paused'
  const resolved = offline ? null : resolvePhase({ phase, empty })
  const tag = resolved === null ? 'offline' : resolved.tag
  const retryBtn = (retry: (() => void) | undefined): ReactNode =>
    retry === undefined ? null : (
      <button type="button" data-slot="query-state-retry" className={ACTION} onClick={retry}>
        {t('home.retry')}
      </button>
    )

  let body: ReactNode
  if (resolved === null) {
    body = (
      <Notice tier={tier} alert={false}>
        <p className="m-0 text-sm text-muted-foreground">{t('home.offline')}</p>
      </Notice>
    )
  } else if (resolved.tag === 'loading') {
    body = loading ?? (
      <div className={cn('flex justify-center', tier === 'page' ? 'py-16' : 'py-8')}>
        <Spinner />
      </div>
    )
  } else if (resolved.tag === 'error') {
    const { kind, message, retry } = resolved
    body = (
      <Notice tier={tier} alert>
        <p className="m-0 text-sm text-foreground">{t(ERROR_KEYS[kind ?? 'default'])}</p>
        {message !== undefined && kind === undefined && (
          <p className="m-0 text-xs text-muted-foreground">{message}</p>
        )}
        {retryBtn(retry)}
      </Notice>
    )
  } else if (resolved.tag === 'empty') {
    const { cause, action, filtered } = resolved.empty
    body =
      filtered !== undefined ? (
        <EmptyState why={cause} tier={tier} filtered={filtered} />
      ) : (
        <EmptyState why={cause} tier={tier} {...(action !== undefined && { action })} />
      )
  } else if (resolved.tag === 'stale' && resolved.refreshFailed) {
    body = (
      <div className="flex min-w-0 flex-col gap-3">
        <output
          data-slot="query-state-banner"
          className="flex items-center justify-between gap-3 rounded-inset bg-warn-tint px-3 py-2 text-sm text-foreground"
        >
          <span>{t('home.refreshFailed')}</span>
          {retryBtn(retryOf(phase))}
        </output>
        {children}
      </div>
    )
  } else {
    body = children
  }

  return (
    <div data-slot="query-state" data-phase={tag} className="min-w-0">
      {body}
    </div>
  )
}
