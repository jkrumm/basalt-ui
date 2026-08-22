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
 * 4. `linkSearch` — the click-time `search:` thunk a nav link needs, ready-made.
 *
 * ## The half that is easy to skip
 *
 * `validateSearch` restores the value when you navigate TO the route with no param. It cannot do
 * anything about a nav link that declares the param itself — and a link written as
 * `search: { range: '30d' }` at module scope pins the fallback on every click, which silently
 * defeats the whole store. The reference consumer shipped exactly that: three features adopted the
 * persistence, the reader had ZERO call sites, and "remember my window" had never once worked.
 *
 * `linkSearch` exists so that failure is unreachable from the API rather than only warned about in
 * this comment — the mistake is made while typing `search:`, so the remedy has to be something
 * autocomplete offers at that keystroke. The JSDoc was already here when it happened.
 *
 * Headless — no Mantine, no JSX. Same tier as `useBasaltNav` and
 * `useRouterBreadcrumbs`.
 *
 * ## Full integration recipe (5 steps)
 *
 * **1. Define** — one call per search param, e.g. in a shared lib/ module:
 *
 *     export const dashboardRange = createSearchParamStore({
 *       key: 'dashboard-range',  param: 'range',
 *       values: ['1d', '7d', '30d'] as const,  fallback: '30d',
 *     })
 *
 * **2. Route** — plug validateSearch into the parent layout route:
 *
 *     export const Route = createFileRoute('/dashboard')({
 *       validateSearch: dashboardRange.validateSearch,
 *       component: DashboardLayout,  // renders <DateFilter/> + <Outlet/>
 *     })
 *
 * **3. Filter** — a component in the shell header (PageActions portal):
 *
 *     function DateFilter() {
 *       const { range } = useSearch({ from: '/dashboard' })
 *       const [, persist] = dashboardRange.useStore()
 *       return <SegmentedControl value={range}
 *         onChange={(v) => { persist(v); navigate({ to: '.',
 *           search: (prev) => ({ ...prev, range: v }) }) }} />
 *     }
 *
 * **4. Page** — accepts the param as a **prop**, NOT from useSearch:
 *
 *     // CRITICAL: never call useSearch({ from: '/dashboard' }) in a page
 *     // component that renders on a sibling route (e.g. /activity).
 *     // Sibling routes aren't children — the `from` fails.
 *     function DashboardPage({ range = '30d' }: { range?: DateRange }) {
 *       const data = useMemo(() => generateData(range), [range])
 *       return <Charts data={data} range={range} />
 *     }
 *
 * **5. Nav links** — carry the param across sub-pages, set per destination in
 * the nav definition so only the dashboard sub-tree inherits it and every
 * other link stays clean. Pass `linkSearch` BY REFERENCE — it is the click-time thunk:
 *
 *     navGroup({ id: 'dash', label: 'Dashboard' }, [
 *       { id: 'dash-overview', label: 'Overview', icon: <IconHome />,
 *         link: linkOptions({ to: '/dashboard', search: dashboardRange.linkSearch }) },
 *       { id: 'dash-activity', label: 'Activity', icon: <IconPulse />,
 *         link: linkOptions({ to: '/dashboard/activity', search: dashboardRange.linkSearch }) },
 *     ])
 *
 * `linkSearch` IS that thunk (`() => ({ [param]: readStored() ?? fallback })`) — hand-rolling it
 * over `readStored` still works and is what you need when the link also carries other params.
 *
 * NOT `search: true`. That flag means "keep the current search" and TanStack
 * only offers it where the target's search is OPTIONAL — a route wired to a
 * store's `validateSearch` always returns the param, so the router requires a
 * value and `search: true` is a type error. The thunk is also the better
 * behaviour: `<Link>` re-evaluates it at click time, so arriving from OUTSIDE
 * the sub-tree restores the last selection instead of landing on the factory
 * default, and a definition evaluated once at module scope never goes stale.
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
  /**
   * The click-time `search:` thunk for a nav link — `() => ({ [param]: readStored() ?? fallback })`.
   *
   * Pass it BY REFERENCE (`search: store.linkSearch`), never call it: `<Link>` re-evaluates the
   * thunk on every click, so arriving from outside the sub-tree restores the last selection,
   * whereas a value computed once at module scope goes stale immediately and pins the fallback.
   */
  linkSearch: () => { [K in P]: T }
}

/**
 * Dev-only, once per store: the URL is pinning `fallback` while something else is persisted, and
 * neither reader has ever been called. That combination has exactly one realistic cause — a nav
 * link declaring the param as a literal — and it is invisible otherwise, because every individual
 * piece looks correct and the feature merely never remembers anything.
 *
 * Deliberately NOT a timer over "was this store ever read": that fires in every test that builds a
 * store, and it cannot say what to do about it. This fires only in the broken state, and names the
 * fix.
 */
function warnLinkPinsFallback(input: {
  key: string
  param: string
  urlValue: string
  storedValue: string
}): void {
  const { key, param, urlValue, storedValue } = input
  // oxlint-disable-next-line no-console -- a dev-time wiring warning has no other channel
  console.warn(
    `[basalt-ui] createSearchParamStore('${key}'): the URL pinned \`${param}=${urlValue}\` ` +
      '(the fallback) ' +
      `while '${storedValue}' was persisted, and nothing has read this store back. A nav link is ` +
      `almost certainly declaring \`search: { ${param}: '${urlValue}' }\` at module scope, which ` +
      "overrides the stored value on every click — pass the store's own reader instead: " +
      '`search: <store>.linkSearch`. (dev only)',
  )
}

// ── Implementation ─────────────────────────────────────────────────────────

export function createSearchParamStore<const T extends string, const P extends string>(
  opts: SearchParamStoreOptions<T, P>,
): SearchParamStore<T, P> {
  const version = opts.version ?? 1

  // `validateSearch` reads the store internally on every navigation, which says nothing about
  // whether the CONSUMER wired a reader — only the two public readers below set this.
  let readerWired = false
  let warned = false

  const read = (): T | null => {
    const raw = readPersistedValue(opts.key, version)
    if (typeof raw !== 'string') return null
    if ((opts.values as readonly string[]).includes(raw)) return raw as T
    return null
  }

  const readStored = (): T | null => {
    readerWired = true
    return read()
  }

  const linkSearch = (): { [K in P]: T } => {
    readerWired = true
    return { [opts.param]: (read() ?? opts.fallback) as T } as { [K in P]: T }
  }

  const validateSearch = (search: Record<string, unknown>): { [K in P]: T } => {
    const raw = search[opts.param]
    if (typeof raw === 'string' && (opts.values as readonly string[]).includes(raw)) {
      if (
        !warned &&
        !readerWired &&
        raw === opts.fallback &&
        process.env['NODE_ENV'] !== 'production'
      ) {
        const stored = read()
        if (stored !== null && stored !== raw) {
          warned = true
          warnLinkPinsFallback({
            key: opts.key,
            param: opts.param,
            urlValue: raw,
            storedValue: stored,
          })
        }
      }
      return { [opts.param]: raw as T } as { [K in P]: T }
    }
    return { [opts.param]: (read() ?? opts.fallback) as T } as { [K in P]: T }
  }

  const useStore = createPersistedState<T>({
    key: opts.key,
    version,
    initial: opts.fallback,
  })

  return { validateSearch, useStore, readStored, linkSearch }
}
