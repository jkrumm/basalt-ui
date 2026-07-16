/**
 * createMultiSearchParamStore — the multi-select sibling of `createSearchParamStore`, for search
 * params backed by an ANY-OF set (e.g. a tag filter) instead of a single value (e.g. a tab).
 *
 * Same three-concern factory shape as `createSearchParamStore`:
 * 1. `validateSearch` — pass directly to `createFileRoute({ validateSearch })`.
 *    Falls back to localStorage when the URL param is absent or invalid, then to `fallback`.
 * 2. `useStore` — React hook: `const [values, persist] = store.useStore()`.
 *    Call `persist(next)` alongside `navigate` so the selection survives navigation.
 * 3. `readStored` — plain function for non-React contexts (tests, guards).
 *
 * Headless — no Mantine, no JSX. Same tier as `createSearchParamStore`.
 *
 * ## Encoding — array-native, not CSV
 *
 * TanStack Router's default search serialization is `stringifySearchWith(JSON.stringify,
 * JSON.parse)`, and its `stringifyValue` branches on `typeof val === 'object' && val !== null` —
 * an array is an object, so `{ tags: ['a', 'b'] }` serializes to `?tags=%5B%22a%22%2C%22b%22%5D`
 * and `parseSearchWith(JSON.parse)` reverses it losslessly. This store deals entirely in arrays
 * (what `validateSearch` returns is exactly what the router stringifies), so a CSV encoding is not
 * reachable from here — there is no string-building step to intercept. A consumer who wants
 * prettier URLs (e.g. `?tags=a,b`) configures router-global `parseSearch`/`stringifySearch` (see
 * TanStack Router's documented custom-search-param-serialization recipe); this store keeps working
 * untouched either way, because it hands the router an array, not an encoding.
 *
 * ## Decoding — defensive and canonical
 *
 * Any value pulled from the URL or localStorage is normalized in this order:
 * 1. Accept only `Array.isArray` input — anything else decodes to empty.
 * 2. Keep only entries present in `opts.values` (drops tampered values and values dropped from the
 *    vocabulary since the URL/localStorage entry was written).
 * 3. Dedupe.
 * 4. Re-sort into `opts.values` DECLARATION order.
 *
 * Canonical ordering means `['api', 'design']` and `['design', 'api']` normalize to the SAME
 * array — one URL for one logical selection, so history entries and any loader cache keyed on the
 * search stay stable regardless of the order a user toggled filters in.
 *
 * @example
 * export const articleTags = createMultiSearchParamStore({
 *   key: 'article-tags', param: 'tags',
 *   values: ['api', 'design', 'guide'] as const,
 * })
 *
 * export const Route = createFileRoute('/content')({
 *   validateSearch: articleTags.validateSearch,
 * })
 */

import { createPersistedState, readPersistedValue } from '../state'

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
   * Call `persist(next)` in your filter's `onChange` alongside `navigate()`.
   */
  useStore: () => readonly [readonly T[], (next: readonly T[]) => void]
  /** Plain read — for use outside React (tests, guards, fallback reads). */
  readStored: () => readonly T[] | null
}

// ── Implementation ─────────────────────────────────────────────────────────

export function createMultiSearchParamStore<const T extends string, const P extends string>(
  opts: MultiSearchParamStoreOptions<T, P>,
): MultiSearchParamStore<T, P> {
  const version = opts.version ?? 1
  const fallback = opts.fallback ?? []
  const allowed = new Set<string>(opts.values)

  /** Array-only, allowlist-filtered, deduped, canonically re-sorted into `opts.values` order. */
  const normalize = (raw: unknown): readonly T[] => {
    if (!Array.isArray(raw)) return []
    const present = new Set<T>()
    for (const entry of raw) {
      if (typeof entry === 'string' && allowed.has(entry)) present.add(entry as T)
    }
    return opts.values.filter((value) => present.has(value))
  }

  const readStored = (): readonly T[] | null => {
    const raw = readPersistedValue(opts.key, version)
    if (!Array.isArray(raw)) return null
    return normalize(raw)
  }

  const validateSearch = (search: Record<string, unknown>): { [K in P]: readonly T[] } => {
    const fromUrl = normalize(search[opts.param])
    if (fromUrl.length > 0) {
      return { [opts.param]: fromUrl } as { [K in P]: readonly T[] }
    }
    return { [opts.param]: readStored() ?? fallback } as { [K in P]: readonly T[] }
  }

  const useStore = createPersistedState<readonly T[]>({
    key: opts.key,
    version,
    initial: fallback,
  })

  return { validateSearch, useStore, readStored }
}
