/**
 * Widget scope: a card's own state on a page store. A widget field is BOUND to a scalar handle (a
 * global, or a page field) and inherits its value; setting it writes only the page's own
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
import type { FieldOption } from './field'
import type { LinkWrite, LooseRouter, UnionToIntersection } from './define'
import { resolveWidget } from './precedence'

export type ScalarKind = 'enum' | 'string' | 'number' | 'boolean'

/** What a widget field binds to: any scalar URL handle. A multi or range handle is a type error. */
export type WidgetSource = {
  readonly kind: ScalarKind
  readonly key: string
  readonly use: () => readonly [unknown, (value: never) => void]
}

export type WidgetsInput = Readonly<Record<string, Readonly<Record<string, WidgetSource>>>>

type ValueOf<H extends WidgetSource> = ReturnType<H['use']>[0]

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
  /** The inherited handle's fallback. */
  readonly fallback: V
  readonly history: 'replace'
  readonly url: true
  readonly params: readonly [string]
  link(value: V): LinkWrite<S>
}

export type WidgetHandles<W> = {
  readonly [I in keyof W & string]: {
    readonly [F in keyof W[I] & string]: W[I][F] extends WidgetSource
      ? WidgetHandle<ValueOf<W[I][F]>, W[I][F]['kind'], WidgetLink<I, F, ValueOf<W[I][F]>>>
      : never
  }
}

/** The optional `w.<widget>.<field>` keys a page route's search carries. */
export type WidgetSearch<W> = UnionToIntersection<
  {
    [I in keyof W & string]: {
      [F in keyof W[I] & string]: W[I][F] extends WidgetSource
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

/** Widget id to the store that owns it, process-wide: ids are app-unique (a redefinition replaces). */
const widgetOwners = new Map<string, string>()

/** @internal Tests only; see `resetControlsOwnersForTests`. */
export function resetWidgetOwnersForTests(): void {
  widgetOwners.clear()
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
    const owner = widgetOwners.get(widget)
    if (owner !== undefined && owner !== ctx.id) {
      fail(`widget id "${widget}" is already used by "${owner}"; widget ids are app-unique`)
    }
    const names = Object.keys(fields)
    if (names.length > MAX_FIELDS) fail(`widget "${widget}" has more than ${MAX_FIELDS} fields`)
    for (const field of names) {
      const source = fields[field] as RuntimeSource | undefined
      if (!SEGMENT_RE.test(field))
        fail(`widget field "${widget}.${field}" is not a plain identifier`)
      if (source === undefined || !SCALARS.includes(source.kind) || source.url === false) {
        fail(`widget field "${widget}.${field}" must bind a scalar URL handle`)
      }
      out.push({ widget, field, key: `w.${widget}.${field}`, source: source as RuntimeSource })
    }
  }
  for (const [widget, owner] of widgetOwners) if (owner === ctx.id) widgetOwners.delete(widget)
  for (const widget of new Set(out.map((b) => b.widget))) widgetOwners.set(widget, ctx.id)
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
