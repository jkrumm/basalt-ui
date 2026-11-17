/**
 * Widget scope: a card's own state on a page store. A widget field is BOUND to a scalar handle (a
 * global, or a page field) and inherits its value, or OWNS its choice: a scalar `field.*` spec with
 * its own fallback and nothing inherited. Setting it writes only the page's own
 * `w.<widget>.<field>` URL key, so a widget can never change a global. The effective value follows
 * `override > inherited > fallback` (`./precedence`), an override equal to the inherited value still
 * pins, and `clear()` unsets the key (explicit `undefined`, never a delete). Widget keys are
 * scalar kinds only (`enum`, `string`, `number`, `boolean`), at most two fields per widget, and the
 * `w.` prefix is reserved.
 */
import type { ControlHandle } from '../../core/ports'
import { BRAND, brandedValidator, extendValidator } from './brand'
import type { ControlsValidator, Scope } from './brand'
import type { Codec, Raw } from './codec'
import { optionsOf } from './field'
import type { FieldOption, FieldSpec } from './field'
import type { LinkWrite, LooseRouter, UnionToIntersection } from './define'
import { resolveWidget } from './precedence'

export type ScalarKind = 'enum' | 'string' | 'number' | 'boolean'

/** What a widget field binds to: any scalar URL handle. A multi or range handle is a type error. */
export type WidgetSource = {
  readonly kind: ScalarKind
  readonly key: string
  readonly use: () => readonly [unknown, (value: never) => void]
}

/** A widget field that owns its choice: a scalar URL field spec, its fallback the only default. */
export type OwnWidgetField = FieldSpec<unknown, ScalarKind, true>

/** What `widgets` takes per field: a handle to inherit from, or a spec the card owns. */
export type WidgetField = WidgetSource | OwnWidgetField

export type WidgetsInput = Readonly<Record<string, Readonly<Record<string, WidgetField>>>>

type ValueOf<H extends WidgetField> = H extends WidgetSource
  ? ReturnType<H['use']>[0]
  : H extends FieldSpec<infer V, ScalarKind, true>
    ? V
    : never

type LastOf<U> =
  UnionToIntersection<U extends unknown ? (arg: U) => void : never> extends (arg: infer L) => void
    ? L
    : never

/** `true` when the key union has at most two members. */
type AtMostTwo<K> = [Exclude<K, LastOf<K> | LastOf<Exclude<K, LastOf<K>>>>] extends [never]
  ? true
  : false

/** Intersected with the config's `widgets`: a widget with three fields becomes `never`. */
export type ValidWidgets<W> = {
  [I in keyof W]: AtMostTwo<keyof W[I]> extends true ? unknown : never
}

type WidgetLink<I extends string, F extends string, V> = { [k in `w.${I}.${F}`]: V }

/**
 * A widget field's handle: the frozen `ControlHandle` over the effective value, where `key` is the
 * URL key `w.<widget>.<field>` and `isDefault` means "no override". `scope: 'widget'` keeps a
 * global handle from standing in for one.
 */
export type WidgetHandle<V, K extends ScalarKind = ScalarKind, S = Raw> = Omit<
  ControlHandle<V>,
  'kind' | 'options'
> & {
  readonly scope: 'widget'
  readonly kind: K
  readonly options: readonly FieldOption<V & string>[]
  readonly widget: string
  readonly field: string
  readonly codec: Codec<V>
  /** The bound handle's fallback, or the owned field's own. */
  readonly fallback: V
  readonly history: 'replace'
  readonly url: true
  readonly params: readonly [string]
  link(value: V): LinkWrite<S>
}

export type WidgetHandles<W> = {
  readonly [I in keyof W & string]: {
    readonly [F in keyof W[I] & string]: W[I][F] extends WidgetField
      ? WidgetHandle<ValueOf<W[I][F]>, W[I][F]['kind'], WidgetLink<I, F, ValueOf<W[I][F]>>>
      : never
  }
}

/** The optional `w.<widget>.<field>` keys a page route's search carries. */
export type WidgetSearch<W> = UnionToIntersection<
  {
    [I in keyof W & string]: {
      [F in keyof W[I] & string]: W[I][F] extends WidgetField
        ? { [k in `w.${I}.${F}`]?: ValueOf<W[I][F]> }
        : never
    }[keyof W[I] & string]
  }[keyof W & string]
>

/** What `useOverrides()` reports: the live `w.` keys, the widgets they belong to, the exit. */
export type Overrides = {
  readonly keys: readonly string[]
  readonly widgets: readonly string[]
  /** Unsets every `w.` key of the store in one navigate; globals and page fields are untouched. */
  clearAll(): void
}

// ------------------------------------------------------------------------------- runtime

/** What a store lends the widget layer, so no router access is duplicated here. */
export type StoreIo = {
  /** The router, lent to `clear()` for as long as the caller is mounted. */
  useRouter(): LooseRouter
  useSelect<T>(select: (search: Raw) => T, structuralSharing: boolean): T
  /** One navigate that writes `patch` (never resets sibling params), judged against the route. */
  write(router: LooseRouter, patch: Raw): void
  /** Unsets `keys` on every mounted router that runs the store. */
  unset(keys: readonly string[]): void
  /** The raw search of a mounted router, or empty. */
  currentSearch(): Raw
  liveSearch(router: LooseRouter): Raw
}

export type WidgetContext = {
  readonly id: string
  readonly scope: Scope
  readonly widgets: WidgetsInput | undefined
  readonly io: StoreIo
}

/** The store as ctl-3 sees it: the parts it replaces or extends. */
export type WidgetStore = {
  validateSearch: ControlsValidator<string, Scope, unknown, unknown>
  extend: (schema: never) => unknown
  widget?: unknown
  useOverrides?: () => Overrides
}

type RuntimeSource = WidgetSource & {
  readonly url?: boolean
  readonly codec: Codec<unknown>
  readonly options?: readonly FieldOption<unknown>[]
  readonly fallback: unknown
}

type Binding = {
  readonly widget: string
  readonly field: string
  readonly key: string
  readonly source: RuntimeSource
}

const SEGMENT_RE = /^[A-Za-z0-9_-]+$/
const SCALARS: readonly string[] = ['enum', 'string', 'number', 'boolean']
const MAX_FIELDS = 2

/**
 * Widget id to the stores that declare it. Two page stores on sibling routes may each declare `trend`:
 * the `w.trend.<field>` key lives in each page's own URL. A clash is two stores mounted at once, and
 * `assertNoWidgetClash` raises it from the store's mount (a throw at definition blanks every route).
 */
const widgetOwners = new Map<string, Set<string>>()

/**
 * Dev: throws when a widget id this store declares is also declared by a store whose route is
 * matched with it (`runs(otherId)`): both would write one `w.` key.
 */
export function assertNoWidgetClash(id: string, runs: (otherId: string) => boolean): void {
  if (process.env.NODE_ENV === 'production') return
  for (const [widget, owners] of widgetOwners) {
    if (!owners.has(id)) continue
    for (const other of owners) {
      if (other === id || !runs(other)) continue
      throw new Error(
        `basalt-ui: controls "${id}": widget id "${widget}" is also declared by "${other}", ` +
          `and both stores are mounted at once, so both write "w.${widget}.<field>". ` +
          'Rename the widget in one of them; ids may repeat only across stores on sibling routes.',
      )
    }
  }
}

/** @internal Tests only; see `resetControlsOwnersForTests`. */
export function resetWidgetOwnersForTests(): void {
  widgetOwners.clear()
}

const noInherited = (): readonly [unknown, () => void] => [undefined, () => {}]

/** A bound handle as it is; an owned spec as a source with its own key, no inherited value and its own options. */
function runtimeSource(declared: WidgetField, key: string): RuntimeSource | undefined {
  if ('use' in declared) return declared as RuntimeSource
  const own = declared as OwnWidgetField
  if (own.lane?.url !== true || typeof own.fallback === 'function') return undefined
  return {
    kind: own.kind,
    key,
    use: noInherited,
    url: true,
    codec: own.codec,
    options: optionsOf(own),
    fallback: own.fallback,
  }
}

function bindingsOf(ctx: WidgetContext): Binding[] {
  const out: Binding[] = []
  const fail = (message: string): never => {
    throw new Error(`basalt-ui: controls "${ctx.id}": ${message}`)
  }
  if (ctx.widgets === undefined) return out
  if (ctx.scope !== 'page') fail('widgets belong on a page store, not a global')
  for (const [widget, fields] of Object.entries(ctx.widgets)) {
    if (!SEGMENT_RE.test(widget)) fail(`widget id "${widget}" is not a plain identifier`)
    const names = Object.keys(fields)
    if (names.length > MAX_FIELDS) fail(`widget "${widget}" has more than ${MAX_FIELDS} fields`)
    for (const field of names) {
      const declared = fields[field] as WidgetField | undefined
      if (!SEGMENT_RE.test(field))
        fail(`widget field "${widget}.${field}" is not a plain identifier`)
      const key = `w.${widget}.${field}`
      const source = declared === undefined ? undefined : runtimeSource(declared, key)
      if (source === undefined || !SCALARS.includes(source.kind) || source.url === false) {
        fail(
          `widget field "${widget}.${field}" must bind a scalar URL handle or own a scalar URL field`,
        )
      }
      out.push({ widget, field, key, source: source as RuntimeSource })
    }
  }
  // A redefinition under the same id (HMR, a test) replaces its own claims.
  for (const [widget, owners] of widgetOwners) {
    owners.delete(ctx.id)
    if (owners.size === 0) widgetOwners.delete(widget)
  }
  for (const widget of new Set(out.map((b) => b.widget))) {
    const owners = widgetOwners.get(widget) ?? new Set<string>()
    owners.add(ctx.id)
    widgetOwners.set(widget, owners)
  }
  return out
}

/** The decoded override of one binding from a raw or validated search; `undefined` when absent or invalid. */
function overrideOf(binding: Binding, search: Raw): unknown {
  const raw = search[binding.key]
  if (raw === undefined) return undefined
  const { source } = binding
  return source.codec.decode(source.key, { [source.key]: raw })
}

function widgetHandle(binding: Binding, io: StoreIo): WidgetHandle<unknown> {
  const { source, key, widget, field } = binding
  const { codec } = source
  const encode = (value: unknown): Raw => ({ [key]: codec.encode(source.key, value)[source.key] })
  const use = (): [unknown, (value: unknown) => void] => {
    const router = io.useRouter()
    const override = io.useSelect((search) => overrideOf(binding, search), true)
    const [inherited] = source.use()
    return [
      resolveWidget(override, inherited, source.fallback).value,
      (next) => {
        const live = overrideOf(binding, io.liveSearch(router))
        if (live !== undefined && codec.equals(live, next)) return
        io.write(router, encode(next))
      },
    ]
  }
  return {
    scope: 'widget',
    key,
    kind: source.kind,
    options: (source.options ?? []) as WidgetHandle<unknown>['options'],
    widget,
    field,
    codec,
    get fallback() {
      return source.fallback
    },
    history: 'replace',
    url: true,
    params: [key],
    use,
    useSource: () => {
      io.useRouter()
      const override = io.useSelect((search) => overrideOf(binding, search), true)
      const [inherited] = source.use()
      const resolved = resolveWidget(override, inherited, source.fallback)
      return { source: resolved.source, inherited: resolved.inherited }
    },
    clear: () => io.unset([key]),
    get isDefault() {
      return overrideOf(binding, io.currentSearch()) === undefined
    },
    link: (value) => ({ search: encode(value), replace: true, resetScroll: false }),
  }
}

/** `useOverrides()` over the store's bindings. */
function overridesFor(bindings: readonly Binding[], io: StoreIo): () => Overrides {
  const allKeys = bindings.map((binding) => binding.key)
  const widgetOf = new Map(bindings.map((binding) => [binding.key, binding.widget]))
  const clearAll = (): void => io.unset(allKeys)
  const none: Overrides = { keys: [], widgets: [], clearAll }
  if (bindings.length === 0) return () => none
  return () => {
    io.useRouter()
    const keys = io.useSelect(
      (search) => bindings.filter((b) => overrideOf(b, search) !== undefined).map((b) => b.key),
      true,
    )
    const widgets = [...new Set(keys.map((k) => widgetOf.get(k) as string))]
    return { keys, widgets, clearAll }
  }
}

/** The widget-aware validator: widget keys that decode are part of the validated search. */
function withWidgetKeys(store: WidgetStore, bindings: readonly Binding[]): void {
  if (bindings.length === 0) return
  const base = store.validateSearch
  const brand = base[BRAND]
  const parseWidgets = (raw: Raw): Raw => {
    const out: Raw = {}
    for (const binding of bindings) {
      const value = overrideOf(binding, raw)
      if (value !== undefined) {
        out[binding.key] = binding.source.codec.encode(binding.source.key, value)[
          binding.source.key
        ]
      }
    }
    return out
  }
  const own = (raw: Raw): Raw => ({
    ...(base['~standard'].validate(raw) as { value: Raw }).value,
    ...parseWidgets(raw),
  })
  const validateSearch = brandedValidator(brand, own)
  store.validateSearch = validateSearch as never
  store.extend = ((schema: Parameters<typeof extendValidator>[1]) =>
    extendValidator(validateSearch as never, schema)) as never
}

/** Attaches `widget` and `useOverrides` to a finished store and widens its validator. */
export function attachWidgets<S extends WidgetStore>(store: S, ctx: WidgetContext): S {
  const bindings = bindingsOf(ctx)
  const widget: Record<string, Record<string, WidgetHandle<unknown>>> = {}
  for (const binding of bindings) {
    ;(widget[binding.widget] ??= {})[binding.field] = widgetHandle(binding, ctx.io)
  }
  withWidgetKeys(store, bindings)
  store.widget = widget
  store.useOverrides = overridesFor(bindings, ctx.io)
  return store
}
