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
import { toErrorMessage } from '../query/error-message'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps } from '../common/props'
import { EmptyState } from './empty-state'

/** `'page'` = a full route body (generous padding). `'section'` = a card/panel region (compact). */
export type QueryStateVariant = 'page' | 'section'

/**
 * The structural subset of a TanStack `UseQueryResult` these components read.
 *
 * Typed as a SUBSET rather than as `UseQueryResult<T>` on purpose: a composed, derived or
 * hand-rolled result must be passable without a cast, and
 * these components stay independent of which `@tanstack/react-query` major a consumer pins. This
 * is NOT a claim that the root barrel is free of that package — `./connectivity` imports
 * `onlineManager` as a value and is re-exported from `src/index.ts`. The cost of the subset is
 * that the compiler stops policing the shape — which is why {@link QueryState} asserts it at
 * runtime.
 */
export type QueryStateLike<TData> = {
  data: TData | undefined
  isError: boolean
  error: unknown
  fetchStatus: 'fetching' | 'paused' | 'idle'
  refetch: () => unknown
}

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
  variant?: QueryStateVariant
  /** Accessible name for the spinner. Say what is loading. */
  label?: string
}

/** A spinner on its own — `variant="page"` centres it in a generous block, `'section'` is bare. */
export function LoadingState({
  variant = 'page',
  label = 'Loading',
  className,
  style,
}: LoadingStateProps): ReactNode {
  if (variant === 'section') {
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
  variant?: QueryStateVariant
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
  variant = 'page',
  action,
  className,
  style,
}: ErrorStateProps): ReactNode {
  const alert = (
    <Alert
      color="red"
      variant="light"
      title={title}
      {...(variant === 'section' && className !== undefined && { className })}
      {...(variant === 'section' && style !== undefined && { style })}
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
  if (variant === 'section') return alert
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

const FETCH_STATUSES = new Set(['fetching', 'paused', 'idle'])

/**
 * `QueryStateLike` is a structural subset, so TypeScript cannot protect a hand-composed result the
 * way it protects a real `UseQueryResult` — and every field it drops fails SILENTLY in the exact
 * direction this component exists to prevent. A missing `isError` renders "no data" over a 500. A
 * misspelled `fetchStatus` never leaves the spinner. A missing `refetch` renders a Retry button
 * that does nothing. Each of those is a false claim about the data, so it throws.
 */
function assertQueryStateLike(query: unknown): asserts query is QueryStateLike<unknown> {
  const bad = (detail: string): never => {
    throw new Error(
      `QueryState: \`query\` ${detail}. It must carry { data, isError, error, fetchStatus, refetch } — ` +
        'a TanStack UseQueryResult does; a hand-composed one must spell every field, because a ' +
        'missing branch flag renders a false claim about the data instead of an error.',
    )
  }
  if (query === null || typeof query !== 'object')
    bad(`is ${query === null ? 'null' : typeof query}`)
  const q = query as Record<string, unknown>
  if (!('data' in q)) bad('has no `data` key')
  if (typeof q['isError'] !== 'boolean') bad('has no boolean `isError`')
  if (typeof q['fetchStatus'] !== 'string' || !FETCH_STATUSES.has(q['fetchStatus']))
    bad(`has fetchStatus=${JSON.stringify(q['fetchStatus'])}, not 'fetching' | 'paused' | 'idle'`)
  if (typeof q['refetch'] !== 'function') bad('has no `refetch()`')
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
    variant?: QueryStateVariant
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
  variant = 'page',
  loading,
  className,
  style,
  classNames,
}: QueryStateProps<TData>): ReactNode {
  assertQueryStateLike(query)
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
        variant={variant}
        {...(errorAction !== undefined && { action: errorAction })}
        {...(rootClassName !== undefined && { className: rootClassName })}
        {...(style !== undefined && { style })}
      />
    )
  }

  if (data === undefined) {
    if (fetchStatus === 'idle' && !isError)
      return empty ? renderEmpty(empty, variant, rootClassName, style) : null
    return (
      loading ?? (
        <LoadingState
          variant={variant}
          {...(rootClassName !== undefined && { className: rootClassName })}
          {...(style !== undefined && { style })}
        />
      )
    )
  }

  const emptyNow = isEmpty ? isEmpty(data) : defaultIsEmpty(data)
  const body = emptyNow
    ? empty
      ? renderEmpty(empty, variant, rootClassName, style)
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
        variant="section"
      />
      {body}
    </Stack>
  )
}

function renderEmpty(
  empty: QueryEmptyCopy,
  variant: QueryStateVariant,
  className?: string,
  style?: CSSProperties,
): ReactNode {
  return (
    <EmptyState
      title={empty.title}
      variant={variant}
      {...(empty.description !== undefined && { description: empty.description })}
      {...(empty.icon !== undefined && { icon: empty.icon })}
      {...(empty.action !== undefined && { action: empty.action })}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    />
  )
}
