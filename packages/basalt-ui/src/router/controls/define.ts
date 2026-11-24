/**
 * `defineControls`: one store of typed fields over the URL (global and page scope) and the device
 * and memory lanes (`url: false`). The URL is the truth for a URL field; its validated search is
 * always complete, and a default never reaches the URL (the strip middleware removes it), except
 * a push enum's fallback once chosen (`?section=general`): `useIsSet()` reads it until `clear()`.
 *
 * Route ownership is the brand on `validateSearch` (`./brand`): a page store's write from a route
 * that does not run it is refused, and a global store off the root route is refused in development.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { useRouter, useRouterState, useSearch } from '@tanstack/react-router'
import { persisted } from '../../core/persisted'
import type { ControlHandle, ControlsSlot } from '../../core/ports'
import { batching, clearTogether, onBatchEnd } from '../../core/write-batch'
import { brandOf, brandedValidator, extendValidator } from './brand'
import type { ControlsValidator, Scope, StandardSchemaV1 } from './brand'
import { writableRange } from './codec'
import type { Codec, CodecKind, NumberBounds, Raw, RangeParams, RangeValue } from './codec'
import type {
  AnyFieldSpec,
  FieldOption,
  FieldSpec,
  History,
  RangePresets,
  RangeSpec,
  RangeWindow,
} from './field'
import { labelOf, optionsOf } from './field'
import { hrefHook } from './href'
import type { ValuesOf, WindowOf } from './values'
import { KEEP_KEY, chosenStrip, orderMiddlewares } from './middleware'
import { assertNoConflict, assertNoUrlThunk, claimParams } from './ownership'
import { attachWidgets } from './widgets'
import type {
  Overrides,
  StoreIo,
  ValidWidgets,
  WidgetHandles,
  WidgetSearch,
  WidgetStore,
  WidgetsInput,
} from './widgets'

export { resetControlsOwnersForTests } from './ownership'

// ---------------------------------------------------------------------------- type plumbing

export type UnionToIntersection<U> = (U extends unknown ? (arg: U) => void : never) extends (
  arg: infer I,
) => void
  ? I
  : never

type Flatten<T> = { [K in keyof T]: T[K] } & {}

type NameOr<Pm, K extends keyof RangeParams, D extends string> = Pm extends {
  readonly [k in K]: infer N extends string
}
  ? N
  : D

type RangeSearch<Key extends string, P extends string, C extends boolean, Pm> = {
  [k in NameOr<Pm, 'preset', Key>]: RangePresets<P, C>
} & { [k in NameOr<Pm, 'from', 'from'>]?: string | undefined } & {
  [k in NameOr<Pm, 'to', 'to'>]?: string | undefined
}

/** The params one field adds to the route's search; none for a `url: false` field. */
export type ParamsOf<Key extends string, X> = X extends { readonly lane: { readonly url: false } }
  ? {}
  : X extends RangeSpec<infer P, infer C, infer Pm, string, boolean>
    ? RangeSearch<Key, P, C, Pm>
    : X extends FieldSpec<infer V>
      ? { [k in Key]: V }
      : never

/** A store's complete validated search: every URL param, defaults included. */
export type SearchOf<F> = Flatten<
  UnionToIntersection<{ [K in keyof F & string]: ParamsOf<K, F[K]> }[keyof F & string]>
>

type Member<V> = V extends readonly (infer M)[] ? M : V extends RangeValue<infer P> ? P : V

/**
 * The type of `search.middlewares` entries. A route's middleware array is typed by its FULL search
 * (its own validator plus every parent's), which a store cannot know, and the parameter is
 * contravariant, so a middleware typed by the store's own search would not be assignable under a
 * global (spike S1). This shape is assignable on any route.
 */
export type AnyMiddleware = (context: unknown) => never

/** Props for a typed `Link` that writes one field: `<Link to="/x" {...h.link(v)} />`. */
export type LinkWrite<S> = { search: S; replace: boolean; resetScroll: false }

/**
 * A field's handle: the frozen `ControlHandle` (`use`, `useSource`, `clear`, `isDefault`) plus the
 * definition a renderer or a link needs. `options` lists members (a multi's `value` is one member).
 */
export type FieldHandle<
  V,
  K extends CodecKind = CodecKind,
  S = Raw,
  H extends History = History,
> = Omit<ControlHandle<V>, 'kind' | 'options'> & {
  readonly kind: K
  readonly options: readonly FieldOption<Member<V>>[]
  /** The field spec's codec, the same object. */
  readonly codec: Codec<V>
  readonly fallback: V
  readonly history: H
  /** False for a device or memory field. */
  readonly url: boolean
  /** The URL params the field owns (none off the URL). */
  readonly params: readonly string[]
  readonly bounds?: NumberBounds | undefined
  link(value: V): LinkWrite<S>
  /** A hook: each value's `link` href, built by the router (`./href`); what `InnerNav` draws. */
  useHref(): (value: V) => string
  /**
   * Writes what a click on `link(value)` writes: a push enum keeps its fallback in the URL
   * (`?section=general`, read by `useIsSet()`), where `use()`'s setter unsets it (a view tab back on
   * its default). What `InnerNav` calls.
   */
  choose(value: V): void
  /** The label `.labels()` declared for a member, else the member itself. */
  label(value: Member<V>): string
  /** Chosen: the URL param is present (a push enum keeps its written fallback) or the device or memory value is held. */
  useIsSet(): boolean
}

export type RangeHandle<
  P extends string,
  W extends string,
  S,
  H extends History = History,
> = FieldHandle<RangeValue<P>, 'range', S, H> & {
  /**
   * The API-facing window: `{ window: preset }` for a preset, `{ from, to }` for a custom range or a
   * preset declared with a `window` resolver (resolved now, never stale). A `custom` value without
   * both dates reads as the field's fallback, as the URL codec reads it, so `window` is never
   * `'custom'`.
   */
  toWindow(value: RangeValue<P>): WindowOf<Exclude<P, W | 'custom'>>
}

export type HandleOf<Key extends string, X> =
  X extends RangeSpec<infer P, infer C, RangeParams, infer W, boolean, infer H>
    ? RangeHandle<RangePresets<P, C>, W, ParamsOf<Key, X>, H>
    : X extends FieldSpec<infer V, infer K, boolean, infer H>
      ? FieldHandle<V, K, ParamsOf<Key, X>, H>
      : never

export type DefineControlsConfig<Id extends string, Scp extends Scope, F, W = {}> = {
  /** App-unique; the device lane stores under `basalt:<id>`. */
  readonly id: Id
  /** `global` mounts on the root route only; `page` on a page or a layout route. */
  readonly scope: Scp
  /** The fields; each key is the field's URL param (a range's preset param). */
  readonly fields: F
  /**
   * Params unset in the same navigate as any URL write of this store: `['page']` on a list, so a
   * narrowed filter lands on the first page and Back restores both together.
   */
  readonly resets?: readonly string[]
  /**
   * Page stores only: URL params kept across navigations inside the subtree of the layout route
   * that mounts the store, and dropped on leaving it. A global retains all of its params.
   */
  readonly retain?: readonly string[]
  /**
   * Page stores only: cards bound to a scalar handle, or owning a scalar `field.*` spec. A widget
   * inherits the handle's value, writes only its own `w.<widget>.<field>` key; two fields each.
   */
  readonly widgets?: W & ValidWidgets<W>
}

export type Controls<Id extends string, Scp extends Scope, F, W = {}> = {
  readonly id: Id
  readonly scope: Scp
  /** Every URL param the store owns. */
  readonly keys: readonly string[]
  /** `createRoute({ validateSearch })`: branded, partial `types.input`, complete output. */
  readonly validateSearch: ControlsValidator<
    Id,
    Scp,
    Partial<SearchOf<F>> & WidgetSearch<W>,
    SearchOf<F> & WidgetSearch<W>
  >
  /** The store's params plus a foreign Standard Schema's; keeps the brand. */
  extend<I, O>(
    schema: StandardSchemaV1<I, O>,
  ): ControlsValidator<
    Id,
    Scp,
    Partial<SearchOf<F>> & WidgetSearch<W> & I,
    SearchOf<F> & WidgetSearch<W> & O
  >
  /** `search: { middlewares }` on the route that mounts the store. */
  readonly middlewares: AnyMiddleware[]
  readonly field: { readonly [K in keyof F & string]: HandleOf<K, F[K]> }
  /** One handle per widget field, by widget id then field. */
  readonly widget: WidgetHandles<W>
  /** The live `w.` keys, their widgets and the reset (`Reset overrides`). */
  useOverrides(): Overrides
  /** Every URL field's value under its key, as its handle's `use()` returns it; stable while they do not change. */
  useValues(): ValuesOf<F>
  /** How many fields differ from their fallback: the `n` of `Filters (n)`. */
  useActiveCount(): number
  /**
   * Unsets every field of the store (one navigate for the URL fields), the view tab and the open
   * record with the filters; never writes a fallback. `useReset({ only: [handle, …] })` unsets just
   * those fields in one navigate and keeps every other param: a Clear filters beside `empty.filtered`.
   */
  useReset(options?: {
    readonly only:
      | readonly { [K in keyof F & string]: HandleOf<K, F[K]> }[keyof F & string][]
      | NamedSlot
  }): () => void
}

// --------------------------------------------------------------------------- router access

type Navigate = (options: {
  to: '.'
  search: (prev: Raw) => Raw
  replace: boolean
  resetScroll: false
}) => Promise<unknown> | void

type LooseRoute = { id: string; options: { validateSearch?: unknown } }

/** The router surface the store reads; typed loosely because a store serves every router. */
export type LooseRouter = {
  navigate: Navigate
  state: { matches: readonly { routeId: string }[]; location: { search: unknown } }
  routesById: Record<string, LooseRoute | undefined>
}

type SelectSearch = <T>(options: {
  strict: false
  select: (search: Raw) => T
  structuralSharing: boolean
}) => T

const useSelectedSearch = useSearch as unknown as SelectSearch
const useLooseRouter = useRouter as unknown as () => LooseRouter

const ROOT_ROUTE_ID = '__root__'

const asRecord = (value: unknown): Raw =>
  typeof value === 'object' && value !== null ? (value as Raw) : {}

/** A failed navigate is reported, never swallowed and never an unhandled rejection. */
function report(error: unknown): void {
  if (typeof reportError === 'function') reportError(error)
  else
    queueMicrotask(() => {
      throw error
    })
}

/**
 * The unsets `clear()` queues inside a `batchWrites` (a `Reset all` presses `clear()` once per field),
 * per router; they leave together as ONE replace when the batch ends. Outside a batch `clear()`
 * navigates at once. Every value is `undefined`, so merging is order-free. Any other write flushes
 * the queue first, so a `set` after a `clear` in the same batch still lands last.
 */
const pendingClears = new Map<LooseRouter, Raw>()

function flushClears(): void {
  for (const [router, patch] of pendingClears) {
    pendingClears.delete(router)
    // One router's failure must not strand the clears queued for the next.
    try {
      const result = router.navigate({
        to: '.',
        search: (prev) => ({ ...prev, ...patch }),
        replace: true,
        resetScroll: false,
      })
      if (result !== undefined) result.catch(report)
    } catch (error) {
      report(error)
    }
  }
}

/** Dev: a global store's validator on any route but the root is a mounting mistake. */
function assertGlobalsOnRoot(router: LooseRouter): void {
  if (process.env.NODE_ENV === 'production') return
  for (const route of Object.values(router.routesById)) {
    const brand = brandOf(route?.options.validateSearch)
    if (route === undefined || brand?.scope !== 'global' || route.id === ROOT_ROUTE_ID) continue
    throw new Error(
      `basalt-ui: controls "${brand.id}" is a global store and mounts on the root route only; ` +
        `route "${route.id}" runs its validateSearch. Use scope: 'page' for a page or layout route.`,
    )
  }
}

/** Whether a matched route runs the store (its validator carries the store's brand). */
const runsStore = (router: LooseRouter, id: string): boolean =>
  router.state.matches.some(
    (match) => brandOf(router.routesById[match.routeId]?.options.validateSearch)?.id === id,
  )

// ---------------------------------------------------------------------- device and memory

/** A record of field values off the URL. The server and hydration render read the empty record. */
type LocalLane = {
  snapshot(): Raw
  write(name: string, value: unknown): void
  unset(names: readonly string[]): void
  subscribe(cb: () => void): () => void
}
type NamedSlot = ControlsSlot & { readonly handles: readonly { readonly key: string }[] }

const EMPTY_RECORD: Raw = Object.freeze({})
const serverSnapshot = (): Raw => EMPTY_RECORD

const without = (record: Raw, names: readonly string[]): Raw =>
  Object.fromEntries(Object.entries(record).filter(([name]) => !names.includes(name)))

/** Device fields: one `basalt:<id>` envelope `{ v: 1, value: { <field>: value } }`. */
function deviceLane(id: string): LocalLane {
  const device = persisted<Raw>(id, { version: 1, initial: EMPTY_RECORD })
  return {
    snapshot: () => device.get(),
    write: (name, value) => device.set((prev) => ({ ...prev, [name]: value })),
    unset: (names) => device.set((prev) => without(prev, names)),
    subscribe: (cb) => device.subscribe(cb),
  }
}

/** Memory fields: session-scoped, shared by every mount of the store, gone on reload. */
function memoryLane(): LocalLane {
  let values: Raw = EMPTY_RECORD
  const listeners = new Set<() => void>()
  const emit = (next: Raw): void => {
    values = next
    for (const cb of listeners) cb()
  }
  return {
    snapshot: () => values,
    write: (name, value) => emit({ ...values, [name]: value }),
    unset: (names) => emit(without(values, names)),
    subscribe: (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}

const NO_LANE: LocalLane = {
  snapshot: serverSnapshot,
  write: () => {},
  unset: () => {},
  subscribe: () => () => {},
}

const useLaneRecord = (lane: LocalLane): Raw =>
  useSyncExternalStore(lane.subscribe, lane.snapshot, serverSnapshot)

// ---------------------------------------------------------------------------- ctl-3 seams

type SeamContext = {
  readonly id: string
  readonly scope: Scope
  readonly keys: readonly string[]
  readonly defaults: Raw
  readonly retain: readonly string[] | undefined
  readonly widgets: WidgetsInput | undefined
  readonly io: StoreIo
}

/** The middleware array of a store: `[strip, retain]` in that order (`./middleware`). */
function mountMiddlewares(strip: AnyMiddleware, ctx: SeamContext): AnyMiddleware[] {
  return orderMiddlewares(strip, ctx)
}

/** `widget` and `useOverrides` attach to the finished store, and its validator learns the `w.` keys. */
function extendStore(store: WidgetStore, ctx: SeamContext): WidgetStore {
  return attachWidgets(store, ctx)
}

// --------------------------------------------------------------------------- defineControls

type Entry = { name: string; spec: AnyFieldSpec; codec: Codec<unknown>; params: readonly string[] }

/**
 * Defines one store of typed fields: `scope: 'global'` on the root route, `'page'` on a page or a
 * layout route. Fields come from `field`: `enum(values, fallback, { aliases })`, `multi(values,
 * fallback)` (empty is "all" unless the fallback is the full list), `string(fallback, { max })`,
 * `number({ fallback, min, max, int, step })`, `boolean(fallback)`, `range({ presets, fallback,
 * custom, params, window })` with `toWindow(value)`, `composite(codec)`; options labels via
 * `.labels()`. Lanes are declared once: `{ history: 'push' }` on a URL field, `{ url: false,
 * persist }` for a device (`basalt:<id>`) or memory field; only those may take a thunk fallback.
 * Mount `validateSearch` (or `extend(schema)` for foreign params; never a hand wrapper, which loses
 * the brand) with `search: { middlewares }`. A handle's `use()` gives `[value, set]`, `clear()`
 * unsets (explicit `undefined`; a push field unsets as a push, `clear({ replace: true })` or a `batchWrites` reset replaces), `link(v)` spreads into a typed `Link`; `resets` unsets sibling
 * params in the same navigate. Defaults stay out of the URL while the validated search is
 * complete. A global's params are exclusive (a second store naming one throws at definition), a
 * page store refuses a write from a route that does not run it, and a global mounted below the
 * root throws in development. `retain: [keys]` on a page store keeps those params across the
 * subtree of the layout route that mounts it; `widgets: { card: { field: handle } }` binds a card to a
 * scalar handle (a global or page field): it inherits the value and writes only its own
 * `w.<card>.<field>` key (`store.widget`, `store.useOverrides()`; see `docs/widgets.md`).
 * The store reads whole: `useValues()` gives every URL field's value in one call, as its `use()` returns it
 * (a range as its `RangeValue`, so `toWindow(values.opened)` compiles), instead of one `use()` per field; `useActiveCount()` counts the fields that differ from their fallback (the `n` of
 * `Filters (n)`); `useReset()` returns the callback that unsets every field, the view tab and the open
 * record with the filters; `useReset({ only: [list.field.q, list.field.status] })` unsets just those
 * in one navigate and keeps the rest: the Clear filters of a table's or chart card's `empty.filtered`
 * (`FilterSet`'s Reset all is the same call); `only` also takes the `filterSlot([...])` the page draws, so the fields are named once. A push enum set back to its fallback (`ViewTabs` on its
 * default) leaves the URL and still pushes; `InnerNav` keeps the fallback pane via `choose(v)`. A `range` with `window:
 * { '7d': (now) => ({ from, to }) }` makes `toWindow(value)` return `{ from, to }` ISO days for that
 * preset, resolved at call time (a preset without a resolver gives `{ window: preset }`; with every preset resolved the type has no `{ window }` member), so the
 * result goes straight into a query key.
 *
 * @useWhen a page or the whole app has filters, tabs, a range or pagination that belong in the URL or on the device
 * @neverWhen the state is the draft of a form (use a form) or owned by another store (use externalField)
 *
 * @example
 * ```ts
 * export const globals = defineControls({
 *   id: 'globals',
 *   scope: 'global',
 *   fields: { range: field.enum(['1h', '24h', '7d'], '24h', { aliases: { day: '24h' } }) },
 * })
 * export const list = defineControls({
 *   id: 'list',
 *   scope: 'page',
 *   resets: ['page'],
 *   fields: { q: field.string(''), status: field.multi(['open', 'closed'], []) },
 * })
 *
 * createRootRoute({ validateSearch: globals.validateSearch, search: { middlewares: globals.middlewares } })
 * createFileRoute('/list')({
 *   validateSearch: list.extend(z.object({ item: z.string().optional() })),
 *   search: { middlewares: list.middlewares },
 * })
 *
 * const [q, setQ] = list.field.q.use()
 * <Link to="/list" {...list.field.status.link(['open'])} />
 * // beside `empty: { filtered: { reset } }`: clear the filters, keep the view and the open record
 * const reset = list.useReset({ only: [list.field.q, list.field.status] }) // or `{ only: slot }`, the page's filterSlot([...])
 * ```
 */
export function defineControls<
  const Id extends string,
  const Scp extends Scope,
  const F extends Record<string, AnyFieldSpec>,
  const W extends WidgetsInput = {},
>(config: DefineControlsConfig<Id, Scp, F, W>): Controls<Id, Scp, F, W> {
  const { id, scope, fields } = config
  assertNoUrlThunk(id, fields)

  const entries: Entry[] = Object.entries(fields).map(([name, spec]) => ({
    name,
    spec,
    codec: spec.codec as Codec<unknown>,
    params: spec.lane.url ? spec.codec.params(name) : [],
  }))
  const urlEntries = entries.filter((entry) => entry.spec.lane.url)
  const localEntries = entries.filter((entry) => !entry.spec.lane.url)
  const keys = urlEntries.flatMap((entry) => entry.params)
  claimParams(id, scope, keys)

  const resetPatch: Raw = Object.fromEntries((config.resets ?? []).map((p) => [p, undefined]))
  const fallbackOf = (entry: Entry): unknown =>
    typeof entry.spec.fallback === 'function'
      ? (entry.spec.fallback as () => unknown)()
      : entry.spec.fallback

  /** One field from a raw or validated search: invalid or absent falls back. */
  const readUrl = (entry: Entry, search: Raw): unknown =>
    entry.codec.decode(entry.name, search) ?? fallbackOf(entry)

  const parse = (raw: Raw): Raw => {
    const out: Raw = {}
    for (const entry of urlEntries)
      Object.assign(out, entry.codec.encode(entry.name, readUrl(entry, raw)))
    return out
  }

  const defaults = parse({})
  type Search = SearchOf<F>
  const validateSearch = brandedValidator<Id, Scp, Partial<Search>, Search>(
    { id, scope },
    (raw) => parse(raw) as Search,
  )

  const device = localEntries.some((entry) => entry.spec.lane.persist) ? deviceLane(id) : NO_LANE
  const memory = localEntries.some((entry) => !entry.spec.lane.persist) ? memoryLane() : NO_LANE
  const laneOf = (entry: Entry): LocalLane => (entry.spec.lane.persist ? device : memory)

  /** A stored value is re-validated through the codec; a malformed one falls back. */
  const readLocal = (entry: Entry, record: Raw = laneOf(entry).snapshot()): unknown => {
    const stored = record[entry.name]
    if (stored === undefined) return fallbackOf(entry)
    try {
      return (
        entry.codec.decode(entry.name, entry.codec.encode(entry.name, stored)) ?? fallbackOf(entry)
      )
    } catch {
      return fallbackOf(entry)
    }
  }

  // Routers lent by mounted hooks, so `clear()` (an event handler, no hook in reach) navigates.
  const mounts = new Map<LooseRouter, number>()
  const useLend = (router: LooseRouter): void => {
    assertNoConflict(id, (other) => runsStore(router, other))
    useEffect(() => {
      assertGlobalsOnRoot(router)
      mounts.set(router, (mounts.get(router) ?? 0) + 1)
      return () => {
        const left = (mounts.get(router) ?? 1) - 1
        if (left > 0) mounts.set(router, left)
        else mounts.delete(router)
      }
    }, [router])
  }

  /** Every URL write: explicit `undefined` unsets (a `delete` would leave a retained key in place). */
  const commit = (
    router: LooseRouter,
    patch: Raw,
    history: History,
    resets: Raw = resetPatch,
    batch = false,
  ): void => {
    assertGlobalsOnRoot(router)
    if (scope === 'page' && !runsStore(router, id)) {
      throw new Error(
        `basalt-ui: controls "${id}": a write from a route that does not run the store. Mount ` +
          `${id}.validateSearch (or ${id}.extend(...)) on this route or a parent layout route.`,
      )
    }
    if (batch && batching()) {
      onBatchEnd(flushClears)
      pendingClears.set(router, { ...pendingClears.get(router), ...resets, ...patch })
      return
    }
    flushClears()
    const result = router.navigate({
      to: '.',
      search: (prev) => ({ ...prev, ...resets, ...patch }),
      replace: history !== 'push',
      resetScroll: false,
    })
    if (result !== undefined) result.catch(report)
  }

  const unsetPatch = (entry: Entry): Raw =>
    Object.fromEntries(entry.params.map((param) => [param, undefined]))

  const handleFor = (entry: Entry): FieldHandle<unknown> => {
    const { spec, codec, name } = entry
    const history = spec.lane.history
    const choice = history === 'push' && spec.kind === 'enum'
    const inUrl = (search: unknown): boolean =>
      entry.params.some((param) => asRecord(search)[param] !== undefined)
    const atFallback = (value: unknown): boolean => codec.equals(value, fallbackOf(entry))
    /** A choice: a push enum keeps its fallback in the URL (`?section=general`); `link` and `choose` write it. */
    const encodeWrite = (value: unknown): Raw =>
      choice && atFallback(value)
        ? { ...codec.encode(name, value), [KEEP_KEY]: [name] }
        : codec.encode(name, value)
    const useUrlField = (): [unknown, (v: unknown) => void] => {
      const router = useLooseRouter()
      useLend(router)
      const value = useSelectedSearch({
        strict: false,
        select: (search) => readUrl(entry, search),
        structuralSharing: true,
      })
      return [
        value,
        (next) => {
          if (spec.kind === 'range' && !writableRange(next as RangeValue)) return
          // A write of the live value is a no-op: it must not fire `resets` (page back to 1).
          if (codec.equals(next, readUrl(entry, asRecord(router.state.location.search)))) return
          // A push enum back on its fallback unsets its key (`ViewTabs` on its default), still as a push.
          const patch = choice && atFallback(next) ? unsetPatch(entry) : codec.encode(name, next)
          commit(router, patch, history)
        },
      ]
    }
    const useUrlIsSet = (): boolean =>
      useRouterState({ select: (state) => inUrl(state.location.search) })
    const useLocalField = (): [unknown, (v: unknown) => void] => {
      const record = useLaneRecord(laneOf(entry))
      return [readLocal(entry, record), (next) => laneOf(entry).write(name, next)]
    }
    const current = (): unknown => {
      if (!spec.lane.url) return readLocal(entry)
      const [router] = mounts.keys()
      return readUrl(entry, router ? asRecord(router.state.location.search) : {})
    }
    const handle: FieldHandle<unknown> & { toWindow?: unknown } = {
      key: name,
      kind: spec.kind,
      options: optionsOf(spec),
      codec,
      get fallback() {
        return fallbackOf(entry)
      },
      history,
      url: spec.lane.url,
      params: entry.params,
      bounds: spec.bounds,
      use: spec.lane.url ? useUrlField : useLocalField,
      useIsSet: spec.lane.url
        ? useUrlIsSet
        : () => Object.hasOwn(useLaneRecord(laneOf(entry)), name),
      useSource: () => ({ source: 'own', inherited: undefined }),
      clear: (options) => {
        if (!spec.lane.url) {
          laneOf(entry).unset([name])
          return
        }
        for (const router of mounts.keys()) {
          // Judged where the reader is now: a router whose matches do not run a page store is left alone.
          if (scope === 'page' && !runsStore(router, id)) continue
          const lane = options?.replace === true ? 'replace' : history // a push field closes as a push
          commit(router, unsetPatch(entry), lane, resetPatch, true)
        }
      },
      get isDefault() {
        return codec.equals(current(), fallbackOf(entry))
      },
      label: (value) => labelOf(spec, value),
      choose: (value) => {
        if (!spec.lane.url) {
          laneOf(entry).write(name, value)
          return
        }
        for (const router of mounts.keys()) {
          if (scope === 'page' && !runsStore(router, id)) continue
          const search = asRecord(router.state.location.search)
          if (codec.equals(value, readUrl(entry, search)) && (!choice || inUrl(search))) continue
          commit(router, encodeWrite(value), history)
        }
      },
      link: (value) => ({
        search: encodeWrite(value),
        replace: history !== 'push',
        resetScroll: false,
      }),
      useHref: hrefHook(id, name, encodeWrite),
    }
    if (spec.kind === 'range') {
      handle.toWindow = toWindowFor(
        spec as unknown as RangeSpecLike,
        () => fallbackOf(entry) as RangeValue,
      )
    }
    return handle
  }

  const field = Object.fromEntries(entries.map((entry) => [entry.name, handleFor(entry)]))

  const valuesOf = (search: Raw): Record<string, unknown> =>
    Object.fromEntries(urlEntries.map((entry) => [entry.name, readUrl(entry, search)]))

  const useValues = (): ValuesOf<F> => {
    useLend(useLooseRouter())
    return useSelectedSearch({
      strict: false,
      select: valuesOf,
      structuralSharing: true,
    }) as ValuesOf<F>
  }

  const useActiveCount = (): number => {
    useLend(useLooseRouter())
    const records = { device: useLaneRecord(device), memory: useLaneRecord(memory) }
    const urlCount = useSelectedSearch({
      strict: false,
      select: (search) =>
        urlEntries.filter((entry) => !entry.codec.equals(readUrl(entry, search), fallbackOf(entry)))
          .length,
      structuralSharing: false,
    })
    const localCount = localEntries.filter((entry) => {
      const record = entry.spec.lane.persist ? records.device : records.memory
      return !entry.codec.equals(readLocal(entry, record), fallbackOf(entry))
    }).length
    return urlCount + localCount
  }

  const useReset = (options?: {
    readonly only: readonly FieldHandle<never>[] | NamedSlot
  }): (() => void) => {
    const router = useLooseRouter()
    useLend(router)
    const given = options?.only
    if (given !== undefined) {
      const only = ((given as Partial<NamedSlot>).handles ?? given) as readonly FieldHandle<never>[]
      for (const handle of only) {
        if (field[handle.key] !== (handle as unknown)) {
          throw new Error(
            `basalt-ui: controls "${id}": reset names "${handle.key}", not a field of this store`,
          )
        }
      }
      return () => clearTogether(only)
    }
    return () => {
      if (urlEntries.length > 0 && (scope === 'global' || runsStore(router, id))) {
        commit(router, Object.fromEntries(keys.map((param) => [param, undefined])), 'replace')
      }
      const persistedNames = localEntries.filter((e) => e.spec.lane.persist).map((e) => e.name)
      const memoryNames = localEntries.filter((e) => !e.spec.lane.persist).map((e) => e.name)
      if (persistedNames.length > 0) device.unset(persistedNames)
      if (memoryNames.length > 0) memory.unset(memoryNames)
    }
  }

  const strip = chosenStrip({
    defaults,
    choices: urlEntries.filter((e) => e.spec.lane.history === 'push' && e.spec.kind === 'enum'),
    inUrl: (param) => {
      const [router] = mounts.keys()
      if (router) return asRecord(router.state.location.search)[param] !== undefined
      return typeof window !== 'undefined' && new URLSearchParams(location.search).has(param)
    },
  })

  const io: StoreIo = {
    useRouter: () => {
      const router = useLooseRouter()
      useLend(router)
      return router
    },
    useSelect: (select, structuralSharing) =>
      useSelectedSearch({ strict: false, select, structuralSharing }),
    write: (router, patch) => commit(router, patch, 'replace', {}),
    unset: (names) => {
      for (const router of mounts.keys()) {
        // Judged where the reader is now: a router that does not run this page store is left alone.
        if (!runsStore(router, id)) continue
        commit(router, Object.fromEntries(names.map((name) => [name, undefined])), 'replace', {})
      }
    },
    currentSearch: () => {
      const [router] = mounts.keys()
      return router ? asRecord(router.state.location.search) : {}
    },
    liveSearch: (router) => asRecord(router.state.location.search),
  }
  const ctx: SeamContext = {
    id,
    scope,
    keys,
    defaults,
    retain: config.retain,
    widgets: config.widgets as WidgetsInput | undefined,
    io,
  }

  const store = {
    id,
    scope,
    keys,
    validateSearch,
    extend: (schema: StandardSchemaV1<unknown, unknown>) => extendValidator(validateSearch, schema),
    middlewares: mountMiddlewares(strip, ctx),
    field: field as Controls<Id, Scp, F>['field'],
    useValues,
    useActiveCount,
    useReset,
  }
  return extendStore(store as unknown as WidgetStore, ctx) as unknown as Controls<Id, Scp, F, W>
}

// ---------------------------------------------------------------------------------- range

type RangeSpecLike = { readonly windows: Partial<Record<string, RangeWindow>> }

const toWindowFor =
  (spec: RangeSpecLike, fallback: () => RangeValue) =>
  (input: RangeValue): { window: string } | { from: string; to: string } => {
    // The codec decodes an incomplete custom range as the fallback; so does the window.
    const value = input.preset === 'custom' && !writableRange(input) ? fallback() : input
    if (value.preset === 'custom' && value.from !== undefined && value.to !== undefined) {
      return { from: value.from, to: value.to }
    }
    const resolve = Object.hasOwn(spec.windows, value.preset)
      ? spec.windows[value.preset]
      : undefined
    return resolve ? resolve(new Date()) : { window: value.preset }
  }
