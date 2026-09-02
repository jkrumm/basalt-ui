/**
 * The query envelope every basalt container reads, and the ONE runtime assertion that stands in for
 * the compiler over it.
 *
 * It lives in `common/` because two independent readers grew their own copy and the copies
 * DISAGREED: `QueryState` (`dashboard/query-state.tsx`) checked the `data` key and that `refetch` is
 * a function; `dataQueryBranch` (`data/query-branch.ts`) checked neither, so the table accepted a
 * result whose Retry button did nothing. A validator that exists twice is a validator with two
 * strictnesses, which is exactly the class of defect the assertion exists to catch.
 *
 * Mantine-free by construction (`common/boundary.test.ts`): types, a set and a throw.
 */

/**
 * The structural subset of a TanStack `UseQueryResult` these components read.
 *
 * Typed as a SUBSET rather than as `UseQueryResult<T>` on purpose: a composed, derived or
 * hand-rolled result must be passable without a cast, and the components stay independent of which
 * `@tanstack/react-query` major a consumer pins. This is NOT a claim that the root barrel is free of
 * that package — `./connectivity` imports `onlineManager` as a value and is re-exported from
 * `src/index.ts`. The cost of the subset is that the compiler stops policing the shape — which is
 * why {@link assertQueryStateLike} checks it at runtime.
 */
export type QueryStateLike<TData> = {
  data: TData | undefined
  isError: boolean
  error: unknown
  fetchStatus: 'fetching' | 'paused' | 'idle'
  refetch: () => unknown
}

/** The three `fetchStatus` values a `UseQueryResult` can carry. */
export const FETCH_STATUSES: ReadonlySet<string> = new Set(['fetching', 'paused', 'idle'])

/**
 * `QueryStateLike` is a structural subset, so TypeScript cannot protect a hand-composed result the
 * way it protects a real `UseQueryResult` — and every field it drops fails SILENTLY in the exact
 * direction these components exist to prevent. A missing `isError` renders "no data" over a 500. A
 * misspelled `fetchStatus` never leaves the spinner. A missing `refetch` renders a Retry button that
 * does nothing. Each of those is a false claim about the data, so it throws.
 *
 * `component` opens the message so the throw names the container that got the bad envelope —
 * `QueryState`, `BasaltDataTable`, `BasaltVirtualList` all read the same shape.
 */
export function assertQueryStateLike(
  component: string,
  query: unknown,
): asserts query is QueryStateLike<unknown> {
  const bad = (detail: string): never => {
    throw new Error(
      `${component}: \`query\` ${detail}. It must carry { data, isError, error, fetchStatus, refetch } — ` +
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
