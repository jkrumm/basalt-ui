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
 * - **A field with neither lane is in memory, not nowhere.** `{ url: false, persist: false }` is
 *   the memory-only lane: session-scoped, shared across every mount of the store, gone on reload —
 *   the same lane `createLocalStore` gives such a field, through the same store-core helper. It is
 *   the honest home for a value a reader should not be handed back tomorrow.
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
import { useEffect } from 'react'
import { useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import type { AnyRouter } from '@tanstack/react-router'
import { createStoreCore } from '../state/fields'
import { createStoreWarnings } from './search-store-warnings'
import type {
  AnyField,
  FieldHandle,
  FieldSetOptions,
  FieldWrite,
  SearchValues,
  StoreEntry,
  StoredValues,
} from '../state/fields'

// ── Types ──────────────────────────────────────────────────────────────────

export type CreateSearchStoreOptions<S extends Record<string, AnyField>> = {
  /** localStorage key (namespaced `basalt:<key>` automatically). One entry per store. */
  key: string
  /** The fields, built with `field.*`. The key of each is its default URL param name. */
  fields: S
  /** Envelope version — bump when the field set changes to discard stale localStorage. */
  version?: number
  /**
   * Search params this store does NOT own that a URL-lane write drops, in the SAME navigate —
   * `['page']` on a paginated list, so narrowing the set on page 5 lands on page 1 and Back restores
   * both together. Dropped, not written: the route's own `validateSearch` resolves the default
   * (`page` → 1), so the store never has to know it. Applies to a URL-lane field's setter and
   * `clear()` when the value moves, and to `useReset()` when any field moves; an explicit `patch`
   * naming the same key wins.
   *
   * **URL-lane writes only.** A `url: false` field (mirror-only or memory) makes no navigate, so it
   * has none to ride — and a `useReset()` on a store with no URL-lane field keeps the page too.
   *
   * Store-wide by design: every filter of a list narrows the same list. A param the store owns is
   * refused at definition — reset a field with `useReset()` or its own `clear()`.
   *
   * @example
   * createSearchStore({ key: 'shares', fields: { q: field.string({}), sort: … }, resets: ['page'] })
   */
  resets?: readonly string[]
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
  /**
   * Returns every field to its fallback: one navigate, one storage write. The mirror is UNSET
   * rather than written — see `FieldHandle.clear()` for why writing the fallback pins a thunk.
   */
  useReset: () => () => void
}

// ── Implementation ─────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Reads the merged search of every matched route, so a child or sibling needs no `from` (A3). */
function useCurrentSearch(): Record<string, unknown> {
  const search: unknown = useSearch({ strict: false })
  return isRecord(search) ? search : {}
}

/**
 * A thunk fallback belongs to the LOCAL and MEMORY lanes only. On the URL lane `validateSearch`
 * would evaluate it on every navigation and write the result into the URL, so a deep link would
 * carry a value nobody picked and two visits a second apart would disagree. Thrown at definition
 * rather than warned at read time: the field set is static, so there is no run in which this is
 * anything but a mistake.
 */
function assertNoLazyUrlFallback(key: string, fields: Record<string, AnyField>): void {
  for (const [name, f] of Object.entries(fields)) {
    if (typeof f.fallback !== 'function' || !f.lane.url) continue
    throw new Error(
      `basalt-ui: createSearchStore('${key}'): field '${name}' has a thunk fallback on the URL ` +
        'lane — `validateSearch` would evaluate it on every navigation and pin the result into the ' +
        'URL. Pass a value instead, or move the field off the URL lane (`{ url: false }`, or ' +
        '`createLocalStore`), where a lazy fallback is resolved per read.',
    )
  }
}

/**
 * `resets` exists for keys the store does NOT own; one it owns would be dropped from the URL while
 * the mirror kept its value — the same URL/mirror split `patch` refuses. Static, so thrown at
 * definition.
 */
function assertResetsNotOwned(input: {
  key: string
  resets: readonly string[]
  paramOwners: ReadonlyMap<string, string>
}): void {
  const { key, resets, paramOwners } = input
  for (const param of resets) {
    const owner = paramOwners.get(param)
    if (owner === undefined) continue
    throw new Error(
      `basalt-ui: createSearchStore('${key}'): \`resets\` names \`${param}\`, which this store's ` +
        `field '${owner}' owns. \`resets\` is for sibling params the store does not own (a ` +
        '`page`); a field of the store is reset through `useReset()` or its own `clear()`.',
    )
  }
}

/** The memory-only lane: neither the URL nor the mirror, so the value lives in the store's own
 * session-scoped external store (`StoreCore.memoryUse`) — the lane `createLocalStore` also uses. */
function isMemoryLane(entry: StoreEntry): boolean {
  return !entry.codec.lane.url && !entry.codec.lane.persist
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
  assertNoLazyUrlFallback(o.key, o.fields)
  const core = createStoreCore(o)

  // `validateSearch` reads storage on every navigation, which says nothing about whether the
  // CONSUMER wired a reader. Everything a consumer can read THROUGH sets this: `linkSearch`,
  // `readStored`, and `field.<name>.use()` — the documented reader, and the one a page that never
  // touches the other two uses exclusively. Missing it there made the pinned-link warning fire on
  // correctly wired pages.
  let readerWired = false
  /** Raw inputs this store's `validateSearch` has seen — how a composed route proves it ran it. */
  const ranOn = new WeakSet<object>()
  const markReaderWired = (): void => {
    readerWired = true
  }
  const warnings = createStoreWarnings(o.key)

  /** Every URL param this store owns, mapped to the field that owns it — what a `patch` may not name. */
  const paramOwners = new Map<string, string>()
  for (const entry of core.urlEntries) {
    for (const param of entry.codec.params) paramOwners.set(param, entry.name)
  }
  const resets = o.resets ?? []
  assertResetsNotOwned({ key: o.key, resets, paramOwners })
  /** Spread right after `prev` in every store navigate, so a `patch` or the field itself wins. */
  const resetPatch: Record<string, undefined> = Object.fromEntries(
    resets.map((param) => [param, undefined]),
  )
  /**
   * `resetPatch` when `next` moves the field off what the URL holds NOW — read from the navigate's
   * own `prev`, never the render-captured value, which a second `set()` in the same tick would
   * misjudge against a value the first one already replaced.
   */
  const resetsFor = (
    entry: StoreEntry,
    prev: Record<string, unknown>,
    next: unknown,
  ): Record<string, undefined> | undefined => {
    const current = core.resolve(entry, prev, core.readRecord())
    return entry.codec.equals(next, current) ? undefined : resetPatch
  }
  const persistedNames = new Set(
    core.entries.filter((entry) => entry.codec.lane.persist).map((entry) => entry.name),
  )

  /**
   * The URL lane's `clear()` runs from an event handler, where no hook is in reach. A mounted
   * `urlUse` lends its router here from an EFFECT — never the render body, which a discarded or
   * StrictMode render would leave behind — so `clear()` navigates through the live router and
   * judges ownership against the location it is called at. With no mount reading the store it
   * clears the mirror alone.
   */
  const mounts = new Map<AnyRouter, number>()

  const assertPatchNotOwned = (entry: StoreEntry, patch: Record<string, unknown>): void => {
    for (const param of Object.keys(patch)) {
      const owner = paramOwners.get(param)
      // The field's OWN params are harmless: its `toSearch` is spread after the patch and wins.
      if (owner === undefined || entry.codec.params.includes(param)) continue
      warnings.patchOwned({ name: entry.name, owner, param })
    }
  }

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

  const maybeWarn = (raw: Record<string, unknown>): void => {
    if (process.env['NODE_ENV'] === 'production' || readerWired) return
    const record = core.readRecord()
    for (const entry of core.urlEntries) {
      const fromUrl = entry.codec.fromSearch(raw)
      if (fromUrl === null || !entry.codec.equals(fromUrl, entry.codec.fallback)) continue
      const stored = entry.codec.decode(record[entry.name])
      if (stored === null || entry.codec.equals(stored, fromUrl)) continue
      // Describe both sides as the URL spells them (a range prints `30d`, not its whole value
      // object) — the message quotes a `search:` literal, so it has to be URL-shaped to be advice.
      warnings.linkPinsFallback({
        param: entry.codec.primary,
        urlValue: entry.codec.toSearch(fromUrl)[entry.codec.primary],
        storedValue: entry.codec.toSearch(stored)[entry.codec.primary],
      })
      return
    }
  }

  /**
   * Pure on a server-rendered page (and on the server): the stored layer would make the client's
   * first search differ from the HTML the server rendered, and a loader keyed on `search` would run
   * with different deps on hydration. `window.$_TSR` is the router's own bootstrap payload — present
   * exactly when the page was dehydrated by SSR. A client-only app has none, so a paramless visit
   * still resolves URL ⊳ mirror ⊳ fallback; an SSR app reaches the mirror through `linkSearch`.
   */
  const stored = (): Record<string, unknown> =>
    typeof window === 'undefined' || '$_TSR' in window ? {} : core.readRecord()

  const validateSearch = (raw: Record<string, unknown>): SearchValues<S> => {
    ranOn.add(raw)
    maybeWarn(raw)
    return flatten(raw, stored()) as SearchValues<S>
  }

  /** Dev only: does any matched route run THIS store's `validateSearch`, directly or composed? */
  const routesRunStore = (router: AnyRouter): boolean =>
    router.state.matches.some((match) => {
      const validate: unknown = router.routesById[match.routeId]?.options.validateSearch
      if (typeof validate !== 'function') return false
      if (validate === validateSearch) return true
      const probe = {}
      try {
        validate(probe)
      } catch {
        // a schema may reject the probe; what matters is whether it reached this store first
      }
      return ranOn.has(probe)
    })

  const linkSearch = (): SearchValues<S> => {
    readerWired = true
    return flatten(null, core.readRecord()) as SearchValues<S>
  }

  const readStored = (): Partial<StoredValues<S>> => {
    readerWired = true
    return core.readStoredFlat() as Partial<StoredValues<S>>
  }

  const urlUse = (entry: StoreEntry) => (): readonly [unknown, FieldWrite] => {
    const search = useCurrentSearch()
    const navigate = useNavigate()
    const router = useRouter()
    const [record, setRecord] = core.usePersistedRecord()
    markReaderWired()
    const value = core.resolve(entry, search, record)
    // The matched route validates this field iff its primary param is present (see the module
    // header). A foreign route gets the persist-only lane.
    const validated = Object.hasOwn(search, entry.codec.primary)

    useEffect(() => {
      mounts.set(router, (mounts.get(router) ?? 0) + 1)
      return () => {
        const left = (mounts.get(router) ?? 1) - 1
        if (left > 0) mounts.set(router, left)
        else mounts.delete(router)
      }
    }, [router])

    useEffect(() => {
      if (process.env['NODE_ENV'] === 'production' || !validated) return
      if (!routesRunStore(router))
        warnings.foreignParam({ name: entry.name, param: entry.codec.primary })
    }, [validated, router])

    return [
      value,
      (next: unknown, opts?: FieldSetOptions) => {
        const patch = opts?.patch
        if (patch !== undefined && Object.keys(patch).length > 0) {
          assertPatchNotOwned(entry, patch)
          if (!validated) warnings.patchWasDropped({ name: entry.name, param: entry.codec.primary })
        }
        if (!validated) {
          if (entry.codec.lane.persist) core.writeField(setRecord, entry.name, next)
          else warnings.writeHasNowhereToGo({ name: entry.name, param: entry.codec.primary })
          return
        }
        navigate({
          to: '.',
          // `patch` FIRST, the field's own params last: a patch is for keys the store does not
          // own (clearing a sibling `detailDate` with `undefined`), so it must never be able to
          // overwrite the value this very call is setting.
          // `resets` only when the value moves: a no-op write (a debounced box settling back on
          // what it held) must not throw the reader off the page they are on.
          search: (prev: Record<string, unknown>) => ({
            ...prev,
            ...resetsFor(entry, prev, next),
            ...opts?.patch,
            ...entry.codec.toSearch(next),
          }),
          replace: entry.codec.lane.history === 'replace',
          // A filter lives halfway down a page as often as it lives in the bar, and the router's
          // default scroll restoration treats this same-route search write as a navigation — so
          // without this a select two screens down jumps the reader back to the top on every
          // change. Never a prop: there is no filter write that WANTS the page to scroll.
          resetScroll: false,
        })
        if (entry.codec.lane.persist) core.writeField(setRecord, entry.name, next)
      },
    ] as const
  }

  // No `patch` here or in the memory lane: neither navigates, so there is no search object to merge
  // into and nothing to silently half-apply.
  const localUse = (entry: StoreEntry) => (): readonly [unknown, FieldWrite] => {
    const [record, setRecord] = core.usePersistedRecord()
    markReaderWired()
    return [
      core.resolve(entry, null, record),
      (next: unknown) => core.writeField(setRecord, entry.name, next),
    ] as const
  }

  // Three lanes, decided once per field at definition: URL (+ optional mirror), mirror-only, and
  // memory-only. The third used to be the one combination that dropped its write.
  const memoryEntries = core.entries.filter(isMemoryLane)

  /**
   * Unsetting one field, per lane: drop the mirror key (never write the fallback — a thunk fallback
   * resolved into localStorage is a value nobody chose), drop the memory value, and on the URL lane
   * navigate back to the fallback params through the mounted router.
   */
  const clearFor = (entry: StoreEntry) => (): void => {
    if (entry.codec.lane.persist) core.clearField(entry.name)
    else if (!entry.codec.lane.url) core.clearMemory(entry.name)
    if (!entry.codec.lane.url) return
    for (const router of mounts.keys()) {
      // Ownership is judged where the user is NOW (the committed, validated location), not where
      // the last render happened to be.
      const { search } = router.state.location
      if (!isRecord(search) || !Object.hasOwn(search, entry.codec.primary)) continue
      router
        .navigate({
          to: '.',
          // Gated like the setter: clearing a field already at its fallback keeps the page.
          search: (prev: Record<string, unknown>) => ({
            ...prev,
            ...resetsFor(entry, prev, entry.codec.fallback),
            ...entry.codec.toSearch(entry.codec.fallback),
          }),
          replace: true,
          resetScroll: false,
        })
        .catch(reportError)
    }
  }

  const field = {} as { [K in keyof S]: FieldHandle<S[K]> }
  for (const entry of core.entries) {
    const use = entry.codec.lane.url
      ? urlUse(entry)
      : entry.codec.lane.persist
        ? localUse(entry)
        : core.memoryUse(entry)
    field[entry.name as keyof S] = core.handle(
      entry,
      use,
      clearFor(entry),
    ) as unknown as FieldHandle<S[keyof S]>
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
    // A memory field is as much a filter as any other, so the `Filters (n)` pill has to count it —
    // which means subscribing to the lane, or the count would go stale the moment one is written.
    core.useMemoryVersion()
    let count = 0
    for (const entry of core.entries) {
      const value = isMemoryLane(entry)
        ? core.readMemoryValue(entry)
        : core.resolve(entry, entry.codec.lane.url ? search : null, record)
      if (!entry.codec.equals(value, entry.codec.fallback)) count += 1
    }
    return count
  }

  const useReset = (): (() => void) => {
    const search = useCurrentSearch()
    const navigate = useNavigate()
    const [, setRecord] = core.usePersistedRecord()

    return () => {
      // Same "does this route own the field" gate as `urlUse` — only reset the params a foreign
      // route's `validateSearch` actually validates, or the reset navigates there and pollutes it.
      const validatedEntries = core.urlEntries.filter((entry) =>
        Object.hasOwn(search, entry.codec.primary),
      )
      if (validatedEntries.length > 0) {
        const patch: Record<string, unknown> = {}
        for (const entry of validatedEntries) {
          Object.assign(patch, entry.codec.toSearch(entry.codec.fallback))
        }
        navigate({
          to: '.',
          // `resets` only when some field actually moves — the same gate as the setter and
          // `clear()`. A `Reset all` with everything already at its fallback must keep the page:
          // this navigate REPLACES, so a page dropped here could not be got back with Back.
          search: (prev: Record<string, unknown>) => {
            const moved = validatedEntries.some(
              (entry) => resetsFor(entry, prev, entry.codec.fallback) !== undefined,
            )
            return { ...prev, ...(moved ? resetPatch : undefined), ...patch }
          },
          replace: true,
          // Same reason as a single field's write above — a `Reset all` pressed from the mobile
          // sheet must not also scroll the page it was pressed on.
          resetScroll: false,
        })
      }
      if (memoryEntries.length > 0) core.resetMemory()
      if (!core.anyPersisted) return
      // Reset means UNSET, not "write the fallback": `codec.fallback` is the RESOLVED value, so a
      // thunk (`() => todayIso()`) would be pinned into the mirror by the very act of resetting and
      // read back tomorrow as a choice nobody made. Deleting the key lets `resolve` fall through to
      // the live fallback — which is what `resetMemory` above has always done for the memory lane.
      const record = core.readRecord()
      const next: Record<string, unknown> = {}
      let dropped = false
      for (const [name, value] of Object.entries(record)) {
        if (persistedNames.has(name)) {
          dropped = true
          continue
        }
        next[name] = value
      }
      if (dropped) setRecord(next)
    }
  }

  const store: SearchStore<S> = {
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
  }

  return store
}
