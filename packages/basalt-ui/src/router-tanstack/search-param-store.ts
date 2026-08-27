/**
 * @deprecated `createSearchParamStore` is a thin wrapper over `createSearchStore` and is
 * removed in 1.29.0. It can express exactly one closed string enum on one param; the store it
 * delegates to expresses six field kinds, per-field lanes, and a range's three params.
 *
 * Migration is mechanical:
 *
 *     // before
 *     const range = createSearchParamStore({
 *       key: 'dashboard-range', param: 'range', values: ['1d', '7d', '30d'] as const, fallback: '30d',
 *     })
 *     const [, persist] = range.useStore()          // localStorage only — never the URL
 *
 *     // after
 *     const dash = createSearchStore({
 *       key: 'dashboard-range',
 *       fields: { range: field.enum(['1d', '7d', '30d'], '30d') },
 *     })
 *     const [value, set] = dash.field.range.use()    // reads the URL, writes both lanes
 *
 * The two are NOT equivalent in the one way that matters: `useStore` reads localStorage, so a deep
 * link `?range=7d` rendered `30d` (A8). `field.range.use()` reads the URL first. See
 * `docs/CONTROLS-SPEC.md` §4 and `MIGRATING.md`.
 *
 * What the wrapper preserves byte-for-byte, because `basalt-ui-obsidian` consumes it two hops
 * downstream: the four returned members (`validateSearch`, `useStore`, `readStored`, `linkSearch`),
 * their signatures, and the single-value localStorage envelope an existing browser already holds.
 */
import { createPersistedState, field } from '../state'
import { buildSearchStore } from './search-store'

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
   * localStorage only — it does NOT read or write the URL. `createSearchStore`'s
   * `field.<name>.use()` is the replacement that does both.
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

// ── Implementation ─────────────────────────────────────────────────────────

/** @deprecated Use `createSearchStore` + `field.enum`. Removed in 1.29.0. */
export function createSearchParamStore<const T extends string, const P extends string>(
  opts: SearchParamStoreOptions<T, P>,
): SearchParamStore<T, P> {
  const version = opts.version ?? 1
  const store = buildSearchStore({
    key: opts.key,
    version,
    fields: { [opts.param]: field.enum(opts.values, opts.fallback) },
    legacyValueField: opts.param,
  })

  const persisted = createPersistedState<T>({ key: opts.key, version, initial: opts.fallback })
  // `useStore` is a reader too. Without this, a consumer whose ONLY reader is `useStore()` — the
  // documented wiring for this factory — would start seeing the pinned-link warning it never saw
  // before, purely because the wrapper now delegates.
  const useStore = (): readonly [T, (next: T) => void] => {
    store.markReaderWired()
    return persisted()
  }

  return {
    validateSearch: (search) => store.validateSearch(search) as { [K in P]: T },
    useStore,
    readStored: () => (store.readStored() as Record<string, T | undefined>)[opts.param] ?? null,
    linkSearch: () => store.linkSearch() as { [K in P]: T },
  }
}
