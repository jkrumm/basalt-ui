/**
 * @deprecated `createMultiSearchParamStore` is a thin wrapper over `createSearchStore`
 * and is removed in 1.29.0. Replace it with `field.multi`:
 *
 *     const store = createSearchStore({
 *       key: 'article-tags',
 *       fields: { tags: field.multi(['api', 'design', 'guide'], []) },
 *     })
 *
 * Two differences to know when you migrate:
 *
 * - **An empty URL array is a VALUE in the new store**, not "absent". This wrapper keeps the old
 *   rule (`?tags=[]` falls through to localStorage, then to `fallback`) so an existing consumer's
 *   links behave identically; `field.multi` treats a cleared selection as a cleared selection.
 * - `useStore` is localStorage-only. `store.field.tags.use()` reads the URL first (A8).
 *
 * Encoding is unchanged and array-native: TanStack Router's default
 * `stringifySearchWith(JSON.stringify, JSON.parse)` round-trips `{ tags: ['a', 'b'] }` losslessly,
 * so there is no CSV step to intercept — a consumer wanting `?tags=a,b` configures router-global
 * `parseSearch`/`stringifySearch` and this store keeps working untouched, because it hands the
 * router an array rather than an encoding.
 *
 * Decoding is unchanged too: array-only input, allowlist-filtered, deduped, then re-sorted into
 * `values` DECLARATION order — so `['api', 'design']` and `['design', 'api']` normalize to the same
 * array, and one logical selection has one URL.
 *
 * The four returned members (`validateSearch`, `useStore`, `readStored`, `linkSearch`), their
 * signatures and the single-value localStorage envelope are preserved byte-for-byte.
 */
import { createPersistedState, field } from '../state'
import { buildSearchStore } from './search-store'

// ── Types ──────────────────────────────────────────────────────────────────

export type MultiSearchParamStoreOptions<T extends string, P extends string = string> = {
  /** localStorage key (namespaced `basalt:<key>` automatically). */
  key: string
  /** URL search-param name (e.g. `"tags"`, `"categories"`). */
  param: P
  /** Allowed values — `as const` for best type inference. Also the canonical sort order. */
  values: readonly T[]
  /** Factory default when nothing is in the URL or localStorage. Default `[]` (unfiltered). */
  fallback?: readonly T[]
  /** Envelope version — bump when `values` change to discard stale localStorage. */
  version?: number
}

export type MultiSearchParamStore<T extends string, P extends string = string> = {
  /**
   * validateSearch — pass directly to `createFileRoute({ validateSearch })`.
   * Falls back to localStorage, then to `fallback`.
   */
  validateSearch: (search: Record<string, unknown>) => { [K in P]: readonly T[] }
  /**
   * React hook: `const [current, persist] = store.useStore()`.
   * localStorage only — it does NOT read or write the URL.
   */
  useStore: () => readonly [readonly T[], (next: readonly T[]) => void]
  /** Plain read — for use outside React (tests, guards, fallback reads). */
  readStored: () => readonly T[] | null
  /**
   * The click-time `search:` thunk for a nav link — `() => ({ [param]: readStored() ?? fallback })`.
   * Pass it BY REFERENCE (`search: store.linkSearch`), never call it; see `createSearchParamStore`
   * for why a module-scope literal silently defeats the store.
   *
   * No dev warning rides on this one, unlike the single-value store: an empty array in the URL is
   * indistinguishable from an absent param here, so a link declaring `{ tags: [] }` restores
   * correctly and there is no broken state to detect.
   */
  linkSearch: () => { [K in P]: readonly T[] }
}

// ── Implementation ─────────────────────────────────────────────────────────

/** @deprecated Use `createSearchStore` + `field.multi`. Removed in 1.29.0. */
export function createMultiSearchParamStore<const T extends string, const P extends string>(
  opts: MultiSearchParamStoreOptions<T, P>,
): MultiSearchParamStore<T, P> {
  const version = opts.version ?? 1
  const fallback = opts.fallback ?? []
  const store = buildSearchStore({
    key: opts.key,
    version,
    fields: { [opts.param]: field.multi(opts.values, fallback) },
    legacyValueField: opts.param,
  })

  const persisted = createPersistedState<readonly T[]>({
    key: opts.key,
    version,
    initial: fallback,
  })
  // A reader, like the single-value wrapper's — see the note there.
  const useStore = (): readonly [readonly T[], (next: readonly T[]) => void] => {
    store.markReaderWired()
    return persisted()
  }

  return {
    validateSearch: (search) => store.validateSearch(search) as { [K in P]: readonly T[] },
    useStore,
    readStored: () =>
      (store.readStored() as Record<string, readonly T[] | undefined>)[opts.param] ?? null,
    linkSearch: () => store.linkSearch() as { [K in P]: readonly T[] },
  }
}
