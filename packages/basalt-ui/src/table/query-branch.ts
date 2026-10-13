/**
 * The uniform query contract `./data`'s two containers resolve (law C3, components audit #3).
 *
 * `BasaltDataTable` took `isLoading` + `emptyState` and had NO error branch at all;
 * `BasaltVirtualList` took `isLoading` alone. Both therefore steered a caller into the same wrong
 * render `QueryState` exists to delete — *No data to display.* printed over a 500 — and neither
 * could be handed a `UseQueryResult` at all.
 *
 * This is not a second `QueryState`. `QueryState` REPLACES its children with a branch; a table has
 * to keep its `<thead>`, its toolbar and its header drawn and swap only the `<tbody>`, so what it
 * needs from the contract is the BRANCH, not the rendering. Hence one function, and the same
 * precedence `QueryState` documents, read from one place so the two cannot drift.
 */
import { assertQueryStateLike } from '../common/query-state-like'
import type { QueryStateLike } from '../common/query-state-like'

/**
 * Which body a data container paints.
 *
 * `'ready'` covers three of `QueryState`'s four cases — data, an EMPTY resolved result, and an
 * error that arrived over cached data. The container itself decides between rows and its own empty
 * state, because it already knows whether it has any (`table.getRowCount()`, `items.length`) and a
 * query envelope does not.
 *
 * A refetch that fails while rows are already on screen therefore keeps the rows, with no banner —
 * that is `QueryState`'s "a background refetch failing must not blank a page that already works",
 * minus the banner it draws. Compose `QueryState` AROUND the container when the banner is wanted.
 */
export type DataQueryBranch = 'pending' | 'error' | 'ready'

/**
 * Resolves a `QueryStateLike` to the branch its container should paint, asserting first — through
 * the SAME `assertQueryStateLike` `QueryState` runs (`common/query-state-like.ts`), so the table and
 * the wrapper cannot disagree about what a valid envelope is. This function once carried its own
 * narrower copy that skipped the `data` key and the `refetch()` check, which let a result whose
 * Retry button did nothing through the very branch that renders one.
 *
 * `isError` WITH data is `'ready'`, not `'error'`: the stale rows stay on screen. That is deliberate
 * and it differs from `QueryState`, which paints the same case as children PLUS a "showing cached
 * data" banner — a container swaps only its body, so it has nowhere to draw one. Compose
 * `QueryState` AROUND the container when the banner is wanted. Pinned in `data-table.test.tsx`.
 */
export function dataQueryBranch(
  component: string,
  query: QueryStateLike<unknown>,
): DataQueryBranch {
  assertQueryStateLike(component, query)
  if (query.isError && query.data === undefined) return 'error'
  // `idle` with no data is an `enabled: false` query, not a pending one — it resolves to the
  // container's own empty state, exactly as `QueryState` resolves it to `empty`.
  if (query.data === undefined && query.fetchStatus !== 'idle') return 'pending'
  return 'ready'
}
