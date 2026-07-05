/**
 * createSearchParamStore — bridge between TanStack Router URL search params and
 * basalt-ui's localStorage persistence.
 *
 * Combines three concerns into one factory:
 * 1. `validateSearch` — pass directly to `createFileRoute({ validateSearch })`.
 *    Falls back to localStorage when the URL param is absent or invalid.
 * 2. `useStore` — React hook: `const [value, persist] = store.useStore()`.
 *    Call `persist(next)` alongside `navigate` so the selection survives
 *    navigation away from and back to the route.
 * 3. `readStored` — plain function for non-React contexts (tests, guards).
 *
 * Headless — no Mantine, no JSX. Same tier as `useBasaltNav` and
 * `useRouterBreadcrumbs`.
 *
 * @example
 * // 1. Define once per search param:
 * const rangeStore = createSearchParamStore({
 *   key: 'dashboard-range',
 *   param: 'range',
 *   values: ['1d', '7d', '30d'] as const,
 *   fallback: '30d',
 * })
 *
 * // 2. In your route file:
 * export const Route = createFileRoute('/dashboard')({
 *   validateSearch: rangeStore.validateSearch,
 *   component: DashboardLayout,
 * })
 *
 * // 3. In your filter component:
 * function DateFilter() {
 *   const { range } = useSearch({ from: '/dashboard' })
 *   const [, persist] = rangeStore.useStore()
 *   const navigate = useNavigate()
 *   const router = useRouter()
 *   return (
 *     <SegmentedControl
 *       value={range}
 *       onChange={(v) => {
 *         persist(v)
 *         navigate({ to: router.state.location.pathname, search: (prev) => ({ ...prev, range: v }) })
 *       }}
 *     />
 *   )
 * }
 */

import { createPersistedState, readPersistedValue } from '../state'

// ── Types ──────────────────────────────────────────────────────────────────

export type SearchParamStoreOptions<T extends string, P extends string = string> = {
  /** localStorage key (namespaced `basalt:<key>` automatically). */
  key: string
  /** URL search-param name (e.g. `"range"`, `"tab"`, `"filter"`). */
  param: P
  /** Allowed values — `as const` for best type inference. */
  values: readonly T[]
  /** Factory default when nothing is in the URL or localStorage. */
  fallback: T
  /** Envelope version — bump when `values` change to discard stale localStorage. */
  version?: number
}

export type SearchParamStore<T extends string, P extends string = string> = {
  /**
   * validateSearch — pass directly to `createFileRoute({ validateSearch })`.
   * Falls back to localStorage, then to `fallback`.
   */
  validateSearch: (search: Record<string, unknown>) => { [K in P]: T }
  /**
   * React hook: `const [current, persist] = store.useStore()`.
   * Call `persist(next)` in your filter's `onChange` alongside `navigate()`.
   */
  useStore: () => readonly [T, (next: T) => void]
  /** Plain read — for use outside React (tests, guards, fallback reads). */
  readStored: () => T | null
}

// ── Implementation ─────────────────────────────────────────────────────────

export function createSearchParamStore<const T extends string, const P extends string>(
  opts: SearchParamStoreOptions<T, P>,
): SearchParamStore<T, P> {
  const version = opts.version ?? 1

  const readStored = (): T | null => {
    const raw = readPersistedValue(opts.key, version)
    if (typeof raw !== 'string') return null
    if ((opts.values as readonly string[]).includes(raw)) return raw as T
    return null
  }

  const validateSearch = (search: Record<string, unknown>): { [K in P]: T } => {
    const raw = search[opts.param]
    if (typeof raw === 'string' && (opts.values as readonly string[]).includes(raw)) {
      return { [opts.param]: raw as T } as { [K in P]: T }
    }
    return { [opts.param]: (readStored() ?? opts.fallback) as T } as { [K in P]: T }
  }

  const useStore = createPersistedState<T>({
    key: opts.key,
    version,
    initial: opts.fallback,
  })

  return { validateSearch, useStore, readStored }
}
