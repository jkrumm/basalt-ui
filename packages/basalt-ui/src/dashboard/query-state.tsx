/**
 * QueryState — the one wrapper a page puts around an async result, and the sibling `EmptyState`
 * shipped without.
 *
 * The argument is correctness, not convenience. A framework that ships only the EMPTY branch
 * steers every consumer into rendering "nothing here" for "the server failed": image-share's
 * library rendered *No images* on a 500, and a share detail rendered *Share not found — it may
 * have been deleted* on a dropped connection, until 204 hand-rolled lines were written to stop it.
 * basalt already owned both ends of that file — `EmptyState` and `toErrorMessage` — and nothing in
 * between.
 *
 * Component, not a hook: the product IS the branch precedence below. A hook returning
 * `{ status, data }` would hand every call site the same four-way switch back, which is exactly
 * the re-derivation this exists to delete. `LoadingState` / `ErrorState` ship alongside as the
 * escape hatch for a page that must place its branches in different DOM positions.
 */
import { Alert, Button, Center, Group, Loader, Stack, Text } from '@mantine/core'
import type { CSSProperties, ReactNode } from 'react'
import { toErrorMessage } from '../common/errors'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps } from '../common/props'
import { EmptyState } from './empty-state'
import { assertQueryStateLike } from '../common/query-state-like'
import type { QueryStateLike } from '../common/query-state-like'

/**
 * How loud this state is: `'page'` = a full route body (generous padding), `'section'` = a
 * card/panel region (compact).
 *
 * Named `tier`, not `variant` (audit B #19): `tier` is already the package's word for "how loud is
 * this" on `WidgetHeader` and `CtlSlot`, and `'section'` meant two different things across the two
 * spellings.
 */
export type QueryStateTier = 'page' | 'section'

/**
 * The structural subset of a TanStack `UseQueryResult` these components read — defined in
 * `common/query-state-like.ts` and re-exported here, where consumers have always imported it from.
 * The runtime assertion over it lives beside the type, because `./data`'s containers read the same
 * envelope and a second copy of the check had already drifted to a weaker one.
 */
export type { QueryStateLike }

/** Copy for the empty branch. Rendered through `EmptyState`, so it looks like every other one. */
export type QueryEmptyCopy = {
  title: string
  /** Optional — a one-word empty panel should not have to invent a sentence. */
  description?: string
  /** Optional glyph slot, rendered faint. */
  icon?: ReactNode
  /** Call-to-action below the copy (e.g. "Reset filters"). */
  action?: ReactNode
}

// ── LoadingState ──────────────────────────────────────────────────────────────────────────────────

export type LoadingStateProps = BasaltProps & {
  /** How loud this state is. Default `'page'`. */
  tier?: QueryStateTier
  /** Accessible name for the spinner. Say what is loading. */
  label?: string
}

/** A spinner on its own — `tier="page"` centres it in a generous block, `'section'` is bare. */
export function LoadingState({
  tier,
  label = 'Loading',
  className,
  style,
}: LoadingStateProps): ReactNode {
  const resolved = tier ?? 'page'
  if (resolved === 'section') {
    return (
      <Loader
        size="sm"
        aria-label={label}
        {...(className !== undefined && { className })}
        {...(style !== undefined && { style })}
      />
    )
  }
  // Same page-level vertical inset `EmptyState`'s `'page'` variant uses (`empty-state.tsx`'s
  // `PAGE_PADDING_Y`) — the finest density-tracking rhythm step scaled by an exact integer, so this
  // renders at today's 64px at level 0 and tracks every other density level with it.
  return (
    <Center
      {...(className !== undefined && { className })}
      style={{ paddingBlock: 'calc(var(--vx-space-stack-xs, 0.25rem) * 16)', ...style }}
    >
      <Loader size="sm" aria-label={label} />
    </Center>
  )
}

// ── ErrorState ────────────────────────────────────────────────────────────────────────────────────

export type ErrorStateProps = BasaltProps & {
  /** Whatever was thrown — the raw Eden/fetch envelope is fine, it gets decoded. */
  error: unknown
  /** Alert heading. Say what failed, e.g. `Could not load images`. */
  title?: string
  /** Shown only when the server body carries no readable message. */
  fallback?: string
  onRetry?: () => void
  /** Disables/spins the retry button while a refetch is in flight. */
  retrying?: boolean
  /** How loud this state is. Default `'page'`. */
  tier?: QueryStateTier
  /** Extra controls beside Retry (e.g. a "Back to shares" link). */
  action?: ReactNode
}

/**
 * The error branch: the REAL server message (via `toErrorMessage`) plus a retry. Usable on its own,
 * outside a query — an auth gate or a boundary fallback renders it directly.
 */
export function ErrorState({
  error,
  title = 'Something went wrong',
  fallback = 'The request failed.',
  onRetry,
  retrying = false,
  tier,
  action,
  className,
  style,
}: ErrorStateProps): ReactNode {
  const resolved = tier ?? 'page'
  const alert = (
    <Alert
      color="red"
      variant="light"
      title={title}
      {...(resolved === 'section' && className !== undefined && { className })}
      {...(resolved === 'section' && style !== undefined && { style })}
    >
      <Stack gap="sm">
        <Text size="sm">{toErrorMessage(error, fallback)}</Text>
        {(onRetry ?? action) !== undefined && (
          <Group gap="xs">
            {onRetry && (
              <Button size="xs" variant="default" loading={retrying} onClick={onRetry}>
                Retry
              </Button>
            )}
            {action}
          </Group>
        )}
      </Stack>
    </Alert>
  )
  if (resolved === 'section') return alert
  return (
    <Stack
      py="md"
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    >
      {alert}
    </Stack>
  )
}

// ── QueryState ────────────────────────────────────────────────────────────────────────────────────

/** `[]`, `{ data: [], total }` (the common pagination envelope) and null all count as empty. */
function defaultIsEmpty(data: unknown): boolean {
  if (data === null || data === undefined) return true
  if (Array.isArray(data)) return data.length === 0
  if (typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: unknown[] }).data.length === 0
  }
  return false
}

/**
 * ONE slot, and the single-member union is the statement (`common/props.ts` lists this among the
 * composites): `root` is whichever branch is live — the error alert's stack, the spinner's centre,
 * the empty state, or the cached-data wrapper. `QueryState` renders exactly one of them at a time
 * and never two boxes at once, so there is no second slot to name; `className` and `classNames.root`
 * both land on it, joined rather than one replacing the other.
 *
 * A branch a consumer wants styled DIFFERENTLY from its siblings is `LoadingState`/`ErrorState`/
 * `EmptyState` placed by hand — that escape hatch is why they ship.
 */
export type QueryStateSlot = 'root'

export type QueryStateProps<TData> = BasaltProps &
  SlotStylesProps<QueryStateSlot> & {
    query: QueryStateLike<TData>
    /** A render function gets `data` narrowed to non-undefined; a plain node also works. */
    children: ReactNode | ((data: TData) => ReactNode)
    /** Omit to render nothing when the result is empty. */
    empty?: QueryEmptyCopy
    /** Override the default `[]` / `{ data: [] }` emptiness test — `() => false` disables it. */
    isEmpty?: (data: TData) => boolean
    /** Alert heading on the error branch — say what failed. */
    errorTitle?: string
    /** Shown only when the server body carries no readable message. */
    errorFallback?: string
    /** Extra controls beside Retry on the error branch. */
    errorAction?: ReactNode
    /** How loud every branch is. Default `'page'`. */
    tier?: QueryStateTier
    /** Replace the default spinner (e.g. with a skeleton grid). */
    loading?: ReactNode
  }

/**
 * Renders loading / error-with-retry / empty / children for a query result, in that order.
 * Branch precedence is the whole point, and it is deliberate:
 *
 *  - error AND no cached data → the full error state (the page cannot render)
 *  - error WITH cached data   → children, plus a compact "showing cached data" banner on top
 *    (a background refetch failing must not blank a page that already works)
 *  - no data, fetch idle      → empty (this is an `enabled: false` query, not a pending one)
 *  - no data, fetching        → `loading` (or the default spinner)
 *
 * @example
 * <QueryState
 *   query={q}
 *   errorTitle="Could not load images"
 *   empty={{ title: 'No images match', description: 'Widen the capture dates.' }}
 * >
 *   {(data) => <ImageGrid images={data.rows} />}
 * </QueryState>
 */
export function QueryState<TData>({
  query,
  children,
  empty,
  isEmpty,
  errorTitle = 'Could not load',
  errorFallback = 'The request failed.',
  errorAction,
  tier,
  loading,
  className,
  style,
  classNames,
}: QueryStateProps<TData>): ReactNode {
  assertQueryStateLike('QueryState', query)
  const resolvedTier = tier ?? 'page'
  // One class for every branch — see {@link QueryStateSlot}. `cx` returns `''` when both are
  // absent, and an empty `className` on a branch that previously carried none would be a DOM diff,
  // so it collapses back to `undefined`.
  const rootClassName = cx(classNames?.root, className) || undefined
  const { data, isError, error, fetchStatus } = query
  const retrying = fetchStatus === 'fetching'
  const retry = (): void => void query.refetch()

  if (isError && data === undefined) {
    return (
      <ErrorState
        error={error}
        title={errorTitle}
        fallback={errorFallback}
        onRetry={retry}
        retrying={retrying}
        tier={resolvedTier}
        {...(errorAction !== undefined && { action: errorAction })}
        {...(rootClassName !== undefined && { className: rootClassName })}
        {...(style !== undefined && { style })}
      />
    )
  }

  if (data === undefined) {
    if (fetchStatus === 'idle' && !isError)
      return empty ? renderEmpty(empty, resolvedTier, rootClassName, style) : null
    return (
      loading ?? (
        <LoadingState
          tier={resolvedTier}
          {...(rootClassName !== undefined && { className: rootClassName })}
          {...(style !== undefined && { style })}
        />
      )
    )
  }

  const emptyNow = isEmpty ? isEmpty(data) : defaultIsEmpty(data)
  const body = emptyNow
    ? empty
      ? renderEmpty(empty, resolvedTier, rootClassName, style)
      : null
    : typeof children === 'function'
      ? children(data)
      : children

  if (!isError) return body

  return (
    <Stack
      gap="sm"
      {...(rootClassName !== undefined && { className: rootClassName })}
      {...(style !== undefined && { style })}
    >
      <ErrorState
        error={error}
        title="Showing cached data"
        fallback="The last refresh failed."
        onRetry={retry}
        retrying={retrying}
        tier="section"
      />
      {body}
    </Stack>
  )
}

function renderEmpty(
  empty: QueryEmptyCopy,
  tier: QueryStateTier,
  className?: string,
  style?: CSSProperties,
): ReactNode {
  return (
    <EmptyState
      title={empty.title}
      tier={tier}
      {...(empty.description !== undefined && { description: empty.description })}
      {...(empty.icon !== undefined && { icon: empty.icon })}
      {...(empty.action !== undefined && { action: empty.action })}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    />
  )
}
