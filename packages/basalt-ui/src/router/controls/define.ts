/**
 * `defineControls`: one store of typed fields over the URL (global and page scope) and the device
 * and memory lanes (`url: false`). The URL is the truth for a URL field; its validated search is
 * always complete, and a default never reaches the URL (the strip middleware removes it).
 *
 * Route ownership is the brand on `validateSearch` (`./brand`), read off the matched routes: a page
 * store's write from a route that does not run it is refused, and a global store mounted anywhere
 * but the root route is refused in development.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { stripSearchParams, useRouter, useSearch } from '@tanstack/react-router'
import { persisted } from '../../core/persisted'
import type { ControlHandle } from '../../core/ports'
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
import { orderMiddlewares } from './middleware'
import { attachWidgets, resetWidgetOwnersForTests } from './widgets'
import type {
  Overrides,
  StoreIo,
  ValidWidgets,
  WidgetHandles,
  WidgetSearch,
  WidgetStore,
  WidgetsInput,
} from './widgets'

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
export type FieldHandle<V, K extends CodecKind = CodecKind, S = Raw> = Omit<
  ControlHandle<V>,
  'kind' | 'options'
> & {
  readonly kind: K
  readonly options: readonly FieldOption<Member<V>>[]
  /** The field spec's codec, the same object. */
  readonly codec: Codec<V>
  readonly fallback: V
  readonly history: History
  /** False for a device or memory field. */
  readonly url: boolean
  /** The URL params the field owns (none off the URL). */
  readonly params: readonly string[]
  readonly bounds?: NumberBounds | undefined
  link(value: V): LinkWrite<S>
}

export type RangeHandle<P extends string, W extends string, S> = FieldHandle<
  RangeValue<P>,
  'range',
  S
> & {
  /**
   * The API-facing window: `{ window: preset }` for a preset, `{ from, to }` for a custom range or a
   * preset declared with a `window` resolver (resolved now, never stale).
   */
  toWindow(value: RangeValue<P>): { window: Exclude<P, W> } | { from: string; to: string }
}

export type HandleOf<Key extends string, X> =
  X extends RangeSpec<infer P, infer C, RangeParams, infer W, boolean>
    ? RangeHandle<RangePresets<P, C>, W, ParamsOf<Key, X>>
    : X extends FieldSpec<infer V, infer K>
      ? FieldHandle<V, K, ParamsOf<Key, X>>
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
   * Page stores only: cards bound to a scalar handle (a global or a page field). A widget inherits
   * the handle's value and writes only its own `w.<widget>.<field>` key; at most two fields each.
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
  /** The store's URL params, resolved; stable while they do not change. */
  useValues(): SearchOf<F>
  /** How many fields differ from their fallback: the `n` of `Filters (n)`. */
  useActiveCount(): number
  /** Unsets every field (one navigate for the URL fields); never writes a fallback. */
  useReset(): () => void
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

// ---------------------------------------------------------------------------- ownership

/** Param to owning store, process-wide: a global's params are exclusive. */
const owners = new Map<string, { id: string; scope: Scope }>()

function claimParams(id: string, scope: Scope, params: readonly string[]): void {
  const seen = new Set<string>()
  for (const param of params) {
    if (param.startsWith('w.')) {
      throw new Error(`basalt-ui: controls "${id}": "w." is a reserved param prefix ("${param}")`)
    }
    if (seen.has(param)) {
      throw new Error(`basalt-ui: controls "${id}": two fields own the param "${param}"`)
    }
    seen.add(param)
    // Page stores may share a name on different routes (argo's `window`, `from`, `to`); the brand
    // keeps their writes apart. A global's param is everywhere, so it is exclusive.
    const owner = owners.get(param)
    if (owner && owner.id !== id && (owner.scope === 'global' || scope === 'global')) {
      throw new Error(
        `basalt-ui: controls "${id}": the param "${param}" is already owned by "${owner.id}" ` +
          `(${owner.scope}); a global store's params are its own on every route`,
      )
    }
  }
  // A redefinition under the same id (HMR, a test) replaces its own claims.
  for (const [param, owner] of owners) if (owner.id === id) owners.delete(param)
  for (const param of params) owners.set(param, { id, scope })
}

/**
 * @internal Tests only. Bun runs every test file in one module registry, so a global defined by one
 * file would own its params in the next; a test file that defines throwaway stores resets first.
 */
export function resetControlsOwnersForTests(): void {
  owners.clear()
  resetWidgetOwnersForTests()
}

function assertNoUrlThunk(id: string, fields: Record<string, AnyFieldSpec>): void {
  for (const [name, spec] of Object.entries(fields)) {
    if (!spec.lane.url || typeof spec.fallback !== 'function') continue
    throw new Error(
      `basalt-ui: controls "${id}": field "${name}" has a thunk fallback on the URL. ` +
        'validateSearch would evaluate it on every navigation and pin the result into links. ' +
        'Pass a value, or move the field off the URL ({ url: false }).',
    )
  }
}

// ---------------------------------------------------------------------- device and memory

/** A record of field values off the URL. The server and hydration render read the empty record. */
type LocalLane = {
  snapshot(): Raw
  write(name: string, value: unknown): void
  unset(names: readonly string[]): void
  subscribe(cb: () => void): () => void
}

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
 * unsets (explicit `undefined`), `link(v)` spreads into a typed `Link`; `resets` unsets sibling
 * params in the same navigate. Defaults stay out of the URL while the validated search is
 * complete. A global's params are exclusive (a second store naming one throws at definition), a
 * page store refuses a write from a route that does not run it, and a global mounted below the
 * root throws in development. `retain: [keys]` on a page store keeps those params across the
 * subtree of the layout route that mounts it; `widgets: { card: { field: handle } }` binds a card to a
 * scalar handle (a global or page field): it inherits the value and writes only its own
 * `w.<card>.<field>` key (`store.widget`, `store.useOverrides()`; see `docs/widgets.md`).
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
  ): void => {
    assertGlobalsOnRoot(router)
    if (scope === 'page' && !runsStore(router, id)) {
      throw new Error(
        `basalt-ui: controls "${id}": a write from a route that does not run the store. Mount ` +
          `${id}.validateSearch (or ${id}.extend(...)) on this route or a parent layout route.`,
      )
    }
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

  const optionsOf = (entry: Entry): readonly FieldOption<never>[] =>
    entry.spec.values.map((value) => ({
      value: value as never,
      label: entry.spec.labelMap?.[value] ?? value,
    }))

  const handleFor = (entry: Entry): FieldHandle<unknown> => {
    const { spec, codec, name } = entry
    const history = spec.lane.history
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
          commit(router, codec.encode(name, next), history)
        },
      ]
    }
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
      options: optionsOf(entry),
      codec,
      get fallback() {
        return fallbackOf(entry)
      },
      history,
      url: spec.lane.url,
      params: entry.params,
      bounds: spec.bounds,
      use: spec.lane.url ? useUrlField : useLocalField,
      useSource: () => ({ source: 'own', inherited: undefined }),
      clear: () => {
        if (!spec.lane.url) {
          laneOf(entry).unset([name])
          return
        }
        for (const router of mounts.keys()) {
          // Judged where the reader is now: a router whose matches do not run a page store is left alone.
          if (scope === 'page' && !runsStore(router, id)) continue
          commit(router, unsetPatch(entry), 'replace')
        }
      },
      get isDefault() {
        return codec.equals(current(), fallbackOf(entry))
      },
      link: (value) => ({
        search: codec.encode(name, value),
        replace: history !== 'push',
        resetScroll: false,
      }),
    }
    if (spec.kind === 'range') handle.toWindow = toWindowFor(spec as unknown as RangeSpecLike)
    return handle
  }

  const field = Object.fromEntries(entries.map((entry) => [entry.name, handleFor(entry)]))

  const projectUrl = (search: Raw): Raw => parse(search)

  const useValues = (): Search => {
    useLend(useLooseRouter())
    return useSelectedSearch({
      strict: false,
      select: projectUrl,
      structuralSharing: true,
    }) as Search
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

  const useReset = (): (() => void) => {
    const router = useLooseRouter()
    useLend(router)
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

  const strip = stripSearchParams(defaults as never) as unknown as AnyMiddleware

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
  (spec: RangeSpecLike) =>
  (value: RangeValue): { window: string } | { from: string; to: string } => {
    if (value.preset === 'custom' && value.from !== undefined && value.to !== undefined) {
      return { from: value.from, to: value.to }
    }
    const resolve = Object.hasOwn(spec.windows, value.preset)
      ? spec.windows[value.preset]
      : undefined
    return resolve ? resolve(new Date()) : { window: value.preset }
  }
