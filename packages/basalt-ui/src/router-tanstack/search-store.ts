/**
 * `createSearchStore` — one factory over typed fields, replacing the enum-only
 * `createSearchParamStore` / `createMultiSearchParamStore` pair.
 *
 * The URL is the truth; the localStorage mirror is a fallback UNDER it. Every field resolves the
 * same way — URL ⊳ localStorage ⊳ fallback (C4) — and declares its lanes once, at definition.
 *
 * Ground truth for the placement/persistence law this implements: `docs/CONTROLS-SPEC.md` §4.
 * What used to be a 100-line recipe in this module's sibling is that spec plus `agent/rules/
 * basalt-state.md`; the API below is what those paragraphs were waiting for.
 *
 * Two behaviours worth knowing before reading the code:
 *
 * - **A deep link wins over the mirror.** `?range=7d` reads back `7d` even when localStorage says
 *   `30d`. The enum-only pair could not do this: its reader hook was the localStorage state, so a
 *   shared link opened on the wrong window (A8).
 * - **A write from outside the owning route persists only.** `use()`'s setter navigates only when
 *   the matched route validates the param — detected by the param key being PRESENT in the current
 *   search, which a route running this store's `validateSearch` always is (it returns every
 *   URL-lane param unconditionally) and a foreign route is not. `validateSearch` then picks the
 *   persisted value up on the next visit (A1). The honest limit of that detection: two DIFFERENT
 *   stores using the same param name on overlapping routes read as one owner. Presence is what a
 *   store can see without the router telling it which route declared what, and the alternative — a
 *   context flag — would need a provider per store, which is the thing this API does not have.
 *
 * Headless — no Mantine, no JSX. Same tier as `useBasaltNav` and `useRouterBreadcrumbs`.
 */
import { useNavigate, useSearch } from '@tanstack/react-router'
import { createStoreCore } from '../state'
import type { AnyField, FieldHandle, SearchValues, StoreEntry, StoredValues } from '../state'

// ── Types ──────────────────────────────────────────────────────────────────

export type CreateSearchStoreOptions<S extends Record<string, AnyField>> = {
  /** localStorage key (namespaced `basalt:<key>` automatically). One entry per store. */
  key: string
  /** The fields, built with `field.*`. The key of each is its default URL param name. */
  fields: S
  /** Envelope version — bump when the field set changes to discard stale localStorage. */
  version?: number
}

export type SearchStore<S extends Record<string, AnyField>> = {
  /**
   * Pass directly to `createFileRoute({ validateSearch })`. Returns every URL-lane param, resolved
   * URL ⊳ localStorage ⊳ fallback — a route wired to it therefore always has the params, which is
   * what makes `use()`'s "does this route own the field" check trivial and exact.
   */
  validateSearch: (raw: Record<string, unknown>) => SearchValues<S>
  /**
   * The click-time `search:` value for a nav link. Pass it BY REFERENCE
   * (`search: store.linkSearch`) inside `defineNav` — never a literal object, which pins the
   * fallback on every click and is why one consumer's reader had zero call sites (C10, A2).
   */
  linkSearch: () => SearchValues<S>
  /** Plain read for non-React contexts (a redirect, a loader, a guard, a test). */
  readStored: () => Partial<StoredValues<S>>
  /** The per-field handles every basalt control takes instead of `value`/`onChange` (C2). */
  field: { [K in keyof S]: FieldHandle<S[K]> }
  /** Option labels for enum / multi / range fields. Chainable — call it once, at definition. */
  labels: (map: Partial<{ [K in keyof S]: Record<string, string> }>) => SearchStore<S>
  /** Every URL-lane param, resolved — the object a page hands to its query. */
  useValues: () => SearchValues<S>
  /** How many fields differ from their fallback — the `n` in a `Filters (n)` pill. */
  useActiveCount: () => number
  /** Resets every field to its fallback: one navigate, one storage write. */
  useReset: () => () => void
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
    `[basalt-ui] createSearchStore('${key}'): the URL pinned \`${param}=${urlValue}\` ` +
      '(the fallback) ' +
      `while '${storedValue}' was persisted, and nothing has read this store back. A nav link is ` +
      `almost certainly declaring \`search: { ${param}: '${urlValue}' }\` at module scope, which ` +
      "overrides the stored value on every click — pass the store's own reader instead: " +
      '`search: <store>.linkSearch`. (dev only)',
  )
}

// ── Implementation ─────────────────────────────────────────────────────────

/** Reads the merged search of every matched route, so a child or sibling needs no `from` (A3). */
function useCurrentSearch(): Record<string, unknown> {
  const search = useSearch({ strict: false }) as unknown
  return typeof search === 'object' && search !== null ? (search as Record<string, unknown>) : {}
}

function describeValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

/**
 * Dev-only, once per field: a `persist: false` field was written from a route that does not
 * validate it, so the write had nowhere to go — no URL (the route owns no such param) and no mirror
 * (the field opted out of one). Silence is the wrong answer here: every other lane combination does
 * something, so a control that appears to work and changes nothing reads as a basalt bug.
 */
function warnWriteHasNowhereToGo(input: { key: string; name: string; param: string }): void {
  const { key, name, param } = input
  // oxlint-disable-next-line no-console -- a dev-time wiring warning has no other channel
  console.warn(
    `[basalt-ui] createSearchStore('${key}'): wrote field '${name}' from a route that does not ` +
      `validate \`${param}\`, and the field is \`persist: false\` — so the write was dropped. ` +
      'Either render this control on the route wired to `validateSearch`, or give the field the ' +
      'localStorage lane (drop `persist: false`) so a write from elsewhere survives until the ' +
      'owning route reads it. (dev only)',
  )
}

/**
 * The public store plus the one member only the deprecated wrappers need: `markReaderWired`, so a
 * consumer whose only reader is the wrapper's own `useStore()` still counts as wired and never sees
 * the pinned-link warning it never used to see.
 *
 * @internal — absent from `SearchStore`, so it is invisible on `createSearchStore`'s return type.
 */
export type InternalSearchStore<S extends Record<string, AnyField>> = SearchStore<S> & {
  markReaderWired: () => void
}

/**
 * The store, plus the one knob the deprecated wrappers need: `legacyValueField` keeps the
 * enum-only stores' single-value storage layout so an already-persisted selection still resolves.
 * Not exported from the barrel — `createSearchStore` is the public door.
 */
export function buildSearchStore<const S extends Record<string, AnyField>>(
  o: CreateSearchStoreOptions<S> & { legacyValueField?: string },
): InternalSearchStore<S> {
  const core = createStoreCore(o)

  // `validateSearch` reads storage on every navigation, which says nothing about whether the
  // CONSUMER wired a reader. Everything a consumer can read THROUGH sets this: `linkSearch`,
  // `readStored`, and `field.<name>.use()` — the documented reader, and the one a page that never
  // touches the other two uses exclusively. Missing it there made the pinned-link warning fire on
  // correctly wired pages.
  let readerWired = false
  let warned = false
  const markReaderWired = (): void => {
    readerWired = true
  }
  const nowhereWarned = new Set<string>()

  const flatten = (
    search: Record<string, unknown> | null,
    record: Record<string, unknown>,
  ): Record<string, unknown> => {
    const out: Record<string, unknown> = {}
    for (const entry of core.urlEntries) {
      Object.assign(out, entry.codec.toSearch(core.resolve(entry, search, record)))
    }
    return out
  }

  const maybeWarn = (raw: Record<string, unknown>, record: Record<string, unknown>): void => {
    if (warned || readerWired || process.env['NODE_ENV'] === 'production') return
    for (const entry of core.urlEntries) {
      const fromUrl = entry.codec.fromSearch(raw)
      if (fromUrl === null || !entry.codec.equals(fromUrl, entry.codec.fallback)) continue
      const stored = entry.codec.decode(record[entry.name])
      if (stored === null || entry.codec.equals(stored, fromUrl)) continue
      // Describe both sides as the URL spells them (a range prints `30d`, not its whole value
      // object) — the message quotes a `search:` literal, so it has to be URL-shaped to be advice.
      warned = true
      warnLinkPinsFallback({
        key: o.key,
        param: entry.codec.primary,
        urlValue: describeValue(entry.codec.toSearch(fromUrl)[entry.codec.primary]),
        storedValue: describeValue(entry.codec.toSearch(stored)[entry.codec.primary]),
      })
      return
    }
  }

  const validateSearch = (raw: Record<string, unknown>): SearchValues<S> => {
    const record = core.readRecord()
    maybeWarn(raw, record)
    return flatten(raw, record) as SearchValues<S>
  }

  const linkSearch = (): SearchValues<S> => {
    readerWired = true
    return flatten(null, core.readRecord()) as SearchValues<S>
  }

  const readStored = (): Partial<StoredValues<S>> => {
    readerWired = true
    return core.readStoredFlat() as Partial<StoredValues<S>>
  }

  const urlUse = (entry: StoreEntry) => (): readonly [unknown, (next: unknown) => void] => {
    const search = useCurrentSearch()
    const navigate = useNavigate()
    const [record, setRecord] = core.usePersistedRecord()
    markReaderWired()
    const value = core.resolve(entry, search, record)
    // The matched route validates this field iff its primary param is present (see the module
    // header). A foreign route gets the persist-only lane.
    const validated = Object.hasOwn(search, entry.codec.primary)

    return [
      value,
      (next: unknown) => {
        if (validated) {
          navigate({
            to: '.',
            search: (prev: Record<string, unknown>) => ({ ...prev, ...entry.codec.toSearch(next) }),
            replace: entry.codec.lane.history === 'replace',
          })
        }
        if (entry.codec.lane.persist) {
          core.writeField(setRecord, entry.name, next)
          return
        }
        if (validated || nowhereWarned.has(entry.name)) return
        if (process.env['NODE_ENV'] === 'production') return
        nowhereWarned.add(entry.name)
        warnWriteHasNowhereToGo({ key: o.key, name: entry.name, param: entry.codec.primary })
      },
    ] as const
  }

  const localUse = (entry: StoreEntry) => (): readonly [unknown, (next: unknown) => void] => {
    const [record, setRecord] = core.usePersistedRecord()
    markReaderWired()
    return [
      core.resolve(entry, null, record),
      (next: unknown) => core.writeField(setRecord, entry.name, next),
    ] as const
  }

  const field = {} as { [K in keyof S]: FieldHandle<S[K]> }
  for (const entry of core.entries) {
    const use = entry.codec.lane.url ? urlUse(entry) : localUse(entry)
    field[entry.name as keyof S] = core.handle(entry, use) as unknown as FieldHandle<S[keyof S]>
  }

  const useValues = (): SearchValues<S> => {
    const search = useCurrentSearch()
    const [record] = core.usePersistedRecord()
    markReaderWired()
    return flatten(search, record) as SearchValues<S>
  }

  const useActiveCount = (): number => {
    const search = useCurrentSearch()
    const [record] = core.usePersistedRecord()
    let count = 0
    for (const entry of core.entries) {
      const value = core.resolve(entry, entry.codec.lane.url ? search : null, record)
      if (!entry.codec.equals(value, entry.codec.fallback)) count += 1
    }
    return count
  }

  const useReset = (): (() => void) => {
    const navigate = useNavigate()
    const [, setRecord] = core.usePersistedRecord()

    return () => {
      if (core.urlEntries.length > 0) {
        const patch: Record<string, unknown> = {}
        for (const entry of core.urlEntries) {
          Object.assign(patch, entry.codec.toSearch(entry.codec.fallback))
        }
        navigate({
          to: '.',
          search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }),
          replace: true,
        })
      }
      if (!core.anyPersisted) return
      const next = { ...core.readRecord() }
      for (const entry of core.entries) {
        if (entry.codec.lane.persist) next[entry.name] = entry.codec.fallback
      }
      setRecord(next)
    }
  }

  const store: InternalSearchStore<S> = {
    validateSearch,
    linkSearch,
    readStored,
    field,
    labels: (map) => {
      core.setLabels(map as Record<string, Record<string, string> | undefined>)
      return store
    },
    useValues,
    useActiveCount,
    useReset,
    markReaderWired,
  }

  return store
}

/**
 * One store per page (or per feature), over typed fields. `key` is the localStorage key; each
 * field's map key is its default URL param name.
 *
 * @example
 * export const analytics = createSearchStore({
 *   key: 'analytics',
 *   fields: {
 *     range: field.range({ presets: ['7d', '30d', '90d'], fallback: '30d', custom: true }),
 *     compare: field.enum(['none', 'previous'], 'none'),
 *     channels: field.multi(CHANNELS, []),
 *   },
 * }).labels({ range: { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' } })
 *
 * export const Route = createFileRoute('/analytics')({
 *   validateSearch: analytics.validateSearch,
 *   loaderDeps: ({ search }) => search,
 * })
 *
 * // in the page: <RangeFilter field={analytics.field.range} />
 * // in the nav:  linkOptions({ to: '/analytics', search: analytics.linkSearch })
 */
export function createSearchStore<const S extends Record<string, AnyField>>(
  o: CreateSearchStoreOptions<S>,
): SearchStore<S> {
  return buildSearchStore(o)
}
