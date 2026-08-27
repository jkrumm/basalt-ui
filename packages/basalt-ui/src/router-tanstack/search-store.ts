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
import { useNavigate, useSearch } from '@tanstack/react-router'
import { createStoreCore } from '../state'
import type {
  AnyField,
  FieldHandle,
  FieldSetOptions,
  FieldWrite,
  SearchValues,
  StoreEntry,
  StoredValues,
} from '../state'

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
  /**
   * Returns every field to its fallback: one navigate, one storage write. The mirror is UNSET
   * rather than written — see `FieldHandle.clear()` for why writing the fallback pins a thunk.
   */
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
 * Dev-only, once per param: a `patch` named a search param ANOTHER field of the same store owns.
 * The navigate would put it in the URL while the store's own write path never touched the mirror,
 * so the next paramless visit and every `linkSearch` link resolve the OLD value — the URL and the
 * mirror disagree from that click on, and nothing looks broken until a reader shares a link.
 *
 * Thrown in dev rather than warned: the call is a mistake with a one-line fix (write the other
 * field through its own setter), and the damage is silent. Production keeps the write — a thrown
 * error there would take a page down over a stale param — and logs it once.
 */
function patchOwnsFieldMessage(input: {
  key: string
  name: string
  owner: string
  param: string
}): string {
  const { key, name, owner, param } = input
  return (
    `basalt-ui: createSearchStore('${key}'): set('${name}', …, { patch }) carries \`${param}\`, ` +
    `which this store's field '${owner}' owns — the URL would take it while the localStorage ` +
    'mirror kept the old value, so the next paramless visit and every `linkSearch` link disagree ' +
    `with the page the write happened on. Write it through \`field.${owner}.use()[1]\` instead; ` +
    'a `patch` is for keys the store does NOT own.'
  )
}

/**
 * Dev-only, once per field: a patched write from a route that does not validate the field. The
 * write persists (A1), but the patch has no navigate to merge into and is dropped — the one case
 * where half of a two-part write silently disappears.
 */
function warnPatchDropped(input: { key: string; name: string; param: string }): void {
  const { key, name, param } = input
  // oxlint-disable-next-line no-console -- a dev-time wiring warning has no other channel
  console.warn(
    `[basalt-ui] createSearchStore('${key}'): wrote field '${name}' with a \`patch\` from a route ` +
      `that does not validate \`${param}\` — the field's value persisted (A1), but the patch was ` +
      'DROPPED: there is no navigate to merge it into. Render the control on the route wired to ' +
      '`validateSearch`, or apply that sibling param on the route that owns it. (dev only)',
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

/** The memory-only lane: neither the URL nor the mirror, so the value lives in the store's own
 * session-scoped external store (`StoreCore.memoryUse`) — the lane `createLocalStore` also uses. */
function isMemoryLane(entry: StoreEntry): boolean {
  return !entry.codec.lane.url && !entry.codec.lane.persist
}

/**
 * The store, plus the one knob the deprecated wrappers need: `legacyValueField` keeps the
 * enum-only stores' single-value storage layout so an already-persisted selection still resolves.
 * Not exported from the barrel — `createSearchStore` is the public door.
 */
export function buildSearchStore<const S extends Record<string, AnyField>>(
  o: CreateSearchStoreOptions<S> & { legacyValueField?: string },
): InternalSearchStore<S> {
  assertNoLazyUrlFallback(o.key, o.fields)
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
  const patchDroppedWarned = new Set<string>()
  const patchOwnerLogged = new Set<string>()

  /** Every URL param this store owns, mapped to the field that owns it — what a `patch` may not name. */
  const paramOwners = new Map<string, string>()
  for (const entry of core.urlEntries) {
    for (const param of entry.codec.params) paramOwners.set(param, entry.name)
  }
  const persistedNames = new Set(
    core.entries.filter((entry) => entry.codec.lane.persist).map((entry) => entry.name),
  )

  /**
   * The URL lane's `clear()` needs a `navigate`, which only exists inside a render. Each render of
   * `urlUse` therefore leaves the navigate its mount would use here, keyed by field — so `clear()`
   * from an event handler on that mount navigates exactly as its setter would, and a field no mount
   * has read falls back to clearing the mirror alone.
   */
  const urlClear = new Map<string, () => void>()

  const assertPatchNotOwned = (entry: StoreEntry, patch: Record<string, unknown>): void => {
    for (const param of Object.keys(patch)) {
      const owner = paramOwners.get(param)
      // The field's OWN params are harmless: its `toSearch` is spread after the patch and wins.
      if (owner === undefined || entry.codec.params.includes(param)) continue
      const message = patchOwnsFieldMessage({ key: o.key, name: entry.name, owner, param })
      if (process.env['NODE_ENV'] !== 'production') throw new Error(message)
      if (patchOwnerLogged.has(param)) continue
      patchOwnerLogged.add(param)
      // oxlint-disable-next-line no-console -- production keeps the write; the log is the record
      console.error(message)
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

  const urlUse = (entry: StoreEntry) => (): readonly [unknown, FieldWrite] => {
    const search = useCurrentSearch()
    const navigate = useNavigate()
    const [record, setRecord] = core.usePersistedRecord()
    markReaderWired()
    const value = core.resolve(entry, search, record)
    // The matched route validates this field iff its primary param is present (see the module
    // header). A foreign route gets the persist-only lane.
    const validated = Object.hasOwn(search, entry.codec.primary)
    urlClear.set(entry.name, () => {
      if (!validated) return
      navigate({
        to: '.',
        search: (prev: Record<string, unknown>) => ({
          ...prev,
          ...entry.codec.toSearch(entry.codec.fallback),
        }),
        replace: true,
        resetScroll: false,
      })
    })

    return [
      value,
      (next: unknown, opts?: FieldSetOptions) => {
        const patch = opts?.patch
        if (patch !== undefined && Object.keys(patch).length > 0) {
          assertPatchNotOwned(entry, patch)
          if (
            !validated &&
            !patchDroppedWarned.has(entry.name) &&
            process.env['NODE_ENV'] !== 'production'
          ) {
            patchDroppedWarned.add(entry.name)
            warnPatchDropped({ key: o.key, name: entry.name, param: entry.codec.primary })
          }
        }
        if (validated) {
          navigate({
            to: '.',
            // `patch` FIRST, the field's own params last: a patch is for keys the store does not
            // own (clearing a sibling `detailDate` with `undefined`), so it must never be able to
            // overwrite the value this very call is setting.
            search: (prev: Record<string, unknown>) => ({
              ...prev,
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
   * navigate back to the fallback params through the last render of `use()`.
   */
  const clearFor = (entry: StoreEntry) => (): void => {
    if (entry.codec.lane.persist) core.clearField(entry.name)
    else if (!entry.codec.lane.url) core.clearMemory(entry.name)
    if (!entry.codec.lane.url) return
    const clearUrl = urlClear.get(entry.name)
    if (clearUrl !== undefined) clearUrl()
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
          search: (prev: Record<string, unknown>) => ({ ...prev, ...patch }),
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
