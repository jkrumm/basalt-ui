/**
 * Throwaway prototype of the `./router` controls half (controls-url-state.md sections 3, 4, 5),
 * rebuilt for spike 626. Not the implementation: ctl-2 re-implements `defineControls`.
 *
 * What it is: field codecs (enum, string, number, boolean, multi, range), a branded Standard
 * Schema validator, `[strip, retain]` middlewares, handles that write through `router.navigate`.
 */
import { retainSearchParams, stripSearchParams, useRouter, useSearch } from '@tanstack/react-router'
import type { AnyRouter } from '@tanstack/react-router'

type Raw = Record<string, unknown>

// ---------------------------------------------------------------- brand and Standard Schema

/** Present on every validator a store produced; `extend()` keeps it, a hand wrapper loses it. */
export const BRAND = Symbol.for('basalt.controls.validator')

export type Scope = 'global' | 'page'
export type Kind = 'enum' | 'multi' | 'string' | 'number' | 'boolean' | 'range'
export type HistoryMode = 'replace' | 'push'

export interface Branded<Id extends string = string, Scp extends Scope = Scope> {
  readonly [BRAND]: { readonly id: Id; readonly scope: Scp }
}

export interface StandardSchemaV1<I = unknown, O = I> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (
      value: unknown,
    ) =>
      | { readonly value: O; readonly issues?: undefined }
      | { readonly issues: readonly { readonly message: string }[] }
      | Promise<
          | { readonly value: O; readonly issues?: undefined }
          | { readonly issues: readonly { readonly message: string }[] }
        >
    readonly types?: { readonly input: I; readonly output: O } | undefined
  }
}

/** A Standard Schema whose `types.input` is the PARTIAL search, so `Link` needs no key. */
export interface ControlsValidator<Id extends string, Scp extends Scope, In, Out> extends Branded<
  Id,
  Scp
> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: 'basalt'
    readonly validate: (value: unknown) => { readonly value: Out; readonly issues?: undefined }
    readonly types: { readonly input: In; readonly output: Out }
  }
}

export const brandOf = (validator: unknown): Branded[typeof BRAND] | undefined => {
  if (typeof validator !== 'object' && typeof validator !== 'function') return undefined
  if (validator === null) return undefined
  return (validator as Partial<Branded>)[BRAND]
}

// ---------------------------------------------------------------------------------- codecs

const NUMERIC_RE = /^-?\d+(\.\d+)?$/
const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/

const isScalar = (raw: unknown): raw is string | number | boolean =>
  typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'

const isIsoDay = (raw: unknown): raw is string => {
  if (typeof raw !== 'string' || !ISO_DAY_RE.test(raw)) return false
  const date = new Date(`${raw}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(raw)
}

export interface Field<V> {
  readonly kind: Kind
  readonly history: HistoryMode
  readonly fallback: V
  /** Every URL param the field owns. */
  params(key: string): readonly string[]
  /** Param -> default, for the strip middleware. */
  defaults(key: string): Raw
  /** Raw search -> validated, complete values of the owned params (invalid drops to the default). */
  parse(key: string, raw: Raw): Raw
  /** Validated search -> the field's value. */
  read(key: string, search: Raw): V
  /** Value -> native params to write; `undefined` is an explicit unset, `{}` writes nothing. */
  write(key: string, value: V): Raw
}

export interface RangeValue<P extends string = string> {
  readonly preset: P
  readonly from: string
  readonly to: string
}
export type RangeWindow<P extends string = string> =
  | { readonly preset: P }
  | { readonly from: string; readonly to: string }

export interface RangeField<P extends string, FK extends string, TK extends string> extends Field<
  RangeValue<P>
> {
  readonly kind: 'range'
  readonly fromKey: FK
  readonly toKey: TK
  toWindow(value: RangeValue<P>): RangeWindow<P>
}

export interface FieldOptions {
  readonly history?: HistoryMode
}

function scalarField<V>(
  kind: Kind,
  fallback: V,
  decode: (raw: unknown) => V | undefined,
  options: FieldOptions | undefined,
): Field<V> {
  return {
    kind,
    history: options?.history ?? 'replace',
    fallback,
    params: (key) => [key],
    defaults: (key) => ({ [key]: fallback }),
    parse: (key, raw) => ({ [key]: decode(raw[key]) ?? fallback }),
    read: (key, search) => (search[key] === undefined ? fallback : (search[key] as V)),
    write: (key, value) => ({ [key]: value }),
  }
}

const enumField = <const V extends string>(
  values: readonly V[],
  fallback: NoInfer<V>,
  options?: FieldOptions & { aliases?: Readonly<Record<string, NoInfer<V>>> },
): Field<V> =>
  scalarField(
    'enum',
    fallback,
    (raw) => {
      if (!isScalar(raw)) return undefined
      const text = String(raw)
      const aliased =
        options?.aliases && Object.hasOwn(options.aliases, text) ? options.aliases[text] : text
      return values.find((value) => value === aliased)
    },
    options,
  )

const stringField = (fallback = '', options?: FieldOptions & { max?: number }): Field<string> =>
  scalarField(
    'string',
    fallback,
    (raw) => {
      if (!isScalar(raw)) return undefined
      const text = String(raw)
      return options?.max === undefined ? text : text.slice(0, options.max)
    },
    options,
  )

const numberField = (
  fallback: number,
  options?: FieldOptions & { min?: number; max?: number; int?: boolean },
): Field<number> =>
  scalarField(
    'number',
    fallback,
    (raw) => {
      const value =
        typeof raw === 'number'
          ? raw
          : typeof raw === 'string' && NUMERIC_RE.test(raw)
            ? Number(raw)
            : Number.NaN
      if (!Number.isFinite(value)) return undefined
      if (options?.int && !Number.isInteger(value)) return undefined
      return Math.min(options?.max ?? Infinity, Math.max(options?.min ?? -Infinity, value))
    },
    options,
  )

const booleanField = (fallback: boolean, options?: FieldOptions): Field<boolean> =>
  scalarField(
    'boolean',
    fallback,
    (raw) => {
      if (raw === true || raw === 'true' || raw === '1' || raw === 1) return true
      if (raw === false || raw === 'false' || raw === '0' || raw === 0) return false
      return undefined
    },
    options,
  )

/**
 * `multi(values, fallback)`: an array or a comma string decodes to the known members in canonical
 * order. An explicit empty value (`[]`, `''`) is the empty selection, distinct from "absent". When
 * the fallback is the full list, a selection equal to it is stripped and `[]` is written.
 */
const multiField = <const V extends string>(
  values: readonly V[],
  fallback: readonly NoInfer<V>[],
  options?: FieldOptions,
): Field<readonly V[]> => {
  const canonical = (picked: ReadonlySet<string>): V[] => values.filter((v) => picked.has(v))
  const decode = (raw: unknown): readonly V[] | undefined => {
    const parts: unknown[] | undefined = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? raw === ''
          ? []
          : raw.split(',')
        : isScalar(raw)
          ? [raw] // a lone number or boolean: the router coerces `?a=1` and `?a=true`
          : undefined
    if (parts === undefined) return undefined
    if (parts.length === 0) return []
    const known = canonical(new Set(parts.filter(isScalar).map(String)))
    return known.length === 0 ? undefined : known
  }
  return scalarField('multi', canonical(new Set(fallback)), decode, options)
}

const rangeField = <
  const P extends string,
  const FK extends string = 'from',
  const TK extends string = 'to',
>(
  presets: readonly P[],
  fallback: NoInfer<P>,
  options?: FieldOptions & { from?: FK; to?: TK },
): RangeField<P, FK, TK> => {
  const fromKey = (options?.from ?? 'from') as FK
  const toKey = (options?.to ?? 'to') as TK
  const empty = { preset: fallback, from: '', to: '' } satisfies RangeValue<P>
  return {
    kind: 'range',
    history: options?.history ?? 'replace',
    fallback: empty,
    fromKey,
    toKey,
    params: (key) => [key, fromKey, toKey],
    defaults: (key) => ({ [key]: fallback, [fromKey]: '', [toKey]: '' }),
    parse: (key, raw) => {
      const preset = presets.find((p) => p === String(raw[key])) ?? fallback
      const from = raw[fromKey]
      const to = raw[toKey]
      const custom = isIsoDay(from) && isIsoDay(to) && from <= to
      return { [key]: preset, [fromKey]: custom ? from : '', [toKey]: custom ? to : '' }
    },
    read: (key, search) => ({
      preset: (search[key] as P | undefined) ?? fallback,
      from: String(search[fromKey] ?? ''),
      to: String(search[toKey] ?? ''),
    }),
    write: (key, value) => {
      const custom = value.from !== '' || value.to !== ''
      if (!custom) return { [key]: value.preset, [fromKey]: undefined, [toKey]: undefined }
      // 4.11: a custom range writes only when both ends exist and are ordered.
      if (!isIsoDay(value.from) || !isIsoDay(value.to) || value.from > value.to) return {}
      return { [key]: undefined, [fromKey]: value.from, [toKey]: value.to }
    },
    toWindow: (value) =>
      value.from !== '' && value.to !== ''
        ? { from: value.from, to: value.to }
        : { preset: value.preset },
  }
}

export const field = {
  enum: enumField,
  string: stringField,
  number: numberField,
  boolean: booleanField,
  multi: multiField,
  range: rangeField,
}

// ------------------------------------------------------------------------------ type plumbing

type UnionToIntersection<U> = (U extends unknown ? (arg: U) => void : never) extends (
  arg: infer I,
) => void
  ? I
  : never
type Flatten<T> = { [K in keyof T]: T[K] }

type ParamsOf<K extends string, X> =
  X extends RangeField<infer P, infer FK, infer TK>
    ? { [k in K]: P } & { [k in FK]: string } & { [k in TK]: string }
    : X extends Field<infer V>
      ? { [k in K]: V }
      : never

export type SearchOf<F extends Record<string, Field<unknown>>> = Flatten<
  UnionToIntersection<{ [K in keyof F & string]: ParamsOf<K, F[K]> }[keyof F & string]>
>

/**
 * The type seam of `search.middlewares`. A route's middleware array is typed by the route's FULL
 * search (its own validator plus every parent's), which a store cannot know, and the parameter is
 * contravariant, so a middleware typed by the store's own search is not assignable on any route
 * under a global (S1 finding). Router's own `stripSearchParams` solves it with a generic inferred
 * from the contextual type; a property cannot, so the store exposes this assignable-anywhere shape.
 */
export type AnyMiddleware = (context: unknown) => never

export interface Handle<V> {
  readonly key: string
  readonly kind: Kind
  readonly history: HistoryMode
  readonly fallback: V
  get(search: Raw): V
  set(router: AnyRouter, value: V): Promise<void>
  clear(router: AnyRouter): Promise<void>
  /** Props for a typed `Link`: `<Link to="/x" {...h.link(v)} />`. */
  link(value: V): { search: Raw }
  use(): readonly [V, (value: V) => Promise<void>]
}
export interface RangeHandle<P extends string> extends Handle<RangeValue<P>> {
  toWindow(value: RangeValue<P>): RangeWindow<P>
}
type HandleOf<X> =
  X extends RangeField<infer P, string, string>
    ? RangeHandle<P>
    : X extends Field<infer V>
      ? Handle<V>
      : never

export interface Controls<
  Id extends string,
  Scp extends Scope,
  F extends Record<string, Field<unknown>>,
> {
  readonly id: Id
  readonly scope: Scp
  readonly keys: readonly string[]
  readonly validateSearch: ControlsValidator<Id, Scp, Partial<SearchOf<F>>, SearchOf<F>>
  extend<I, O>(
    schema: StandardSchemaV1<I, O>,
  ): ControlsValidator<Id, Scp, Partial<SearchOf<F>> & I, SearchOf<F> & O>
  readonly middlewares: AnyMiddleware[]
  readonly field: { [K in keyof F]: HandleOf<F[K]> }
  useValues(): SearchOf<F>
}

// ------------------------------------------------------------------------------ defineControls

const owners = new Map<string, { id: string; scope: Scope }>()

type LooseNavigate = {
  navigate: (options: { search: (prev: Raw) => Raw; replace: boolean }) => Promise<void>
  history: { flush: () => void }
  state: { matches: readonly { routeId: string }[] }
  routesById: Record<string, { options: { validateSearch?: unknown } }>
}

/** The dev check: a write from a page whose matched routes do not run the store is refused. */
function assertRuns(router: AnyRouter, id: string, scope: Scope): void {
  if (scope === 'global') return
  const loose = router as unknown as LooseNavigate
  const runs = loose.state.matches.some(
    (match) => brandOf(loose.routesById[match.routeId]?.options.validateSearch)?.id === id,
  )
  if (!runs) {
    throw new Error(`controls "${id}": a write from a route that does not run the store`)
  }
}

export function defineControls<
  const Id extends string,
  const Scp extends Scope,
  const F extends Record<string, Field<unknown>>,
>(config: {
  id: Id
  scope: Scp
  fields: F
  /** Params kept across navigations inside the subtree of the route mounting the middlewares. */
  retain?: readonly (keyof SearchOf<F> & string)[]
}): Controls<Id, Scp, F> {
  const { id, scope, fields } = config
  const entries = Object.entries(fields)
  const keys = entries.flatMap(([key, def]) => def.params(key))

  const seen = new Set<string>()
  for (const param of keys) {
    if (param.startsWith('w.')) throw new Error(`controls "${id}": "w." is a reserved prefix`)
    if (seen.has(param)) throw new Error(`controls "${id}": two fields own param "${param}"`)
    seen.add(param)
    // Spike finding: argo's page stores share `window`/`from`/`to` on different routes, so a
    // process-wide "two stores own one param" throw is wrong for page vs page. Only a global's
    // param is exclusive.
    const owner = owners.get(param)
    if (owner && owner.id !== id && (owner.scope === 'global' || scope === 'global')) {
      throw new Error(`controls "${id}": param "${param}" is already owned by "${owner.id}"`)
    }
  }
  for (const param of keys) owners.set(param, { id, scope })

  const defaults: Raw = Object.assign({}, ...entries.map(([key, def]) => def.defaults(key)))
  const brand = { id, scope }

  const parse = (raw: Raw): SearchOf<F> =>
    Object.assign({}, ...entries.map(([key, def]) => def.parse(key, raw))) as SearchOf<F>

  const validate = (value: unknown): { value: SearchOf<F> } => ({
    value: parse(typeof value === 'object' && value !== null ? (value as Raw) : {}),
  })

  type V = ControlsValidator<Id, Scp, Partial<SearchOf<F>>, SearchOf<F>>
  const validateSearch = {
    '~standard': {
      version: 1,
      vendor: 'basalt',
      validate,
      types: undefined as unknown as V['~standard']['types'],
    },
    [BRAND]: brand,
  } satisfies V as V

  const extend: Controls<Id, Scp, F>['extend'] = (schema) => ({
    '~standard': {
      version: 1,
      vendor: 'basalt',
      validate: (value: unknown) => {
        const own = parse(typeof value === 'object' && value !== null ? (value as Raw) : {})
        const foreign = schema['~standard'].validate(value)
        if (foreign instanceof Promise) throw new Error('async validators are not supported')
        if (foreign.issues) throw new Error(foreign.issues.map((issue) => issue.message).join('; '))
        return { value: { ...(foreign.value as object), ...own } as never }
      },
      types: undefined as never,
    },
    [BRAND]: brand,
  })

  // Order is fixed here: [strip, retain]. A global retains all its own params.
  const retained = scope === 'global' ? keys : (config.retain ?? [])
  const middlewares = [
    stripSearchParams(defaults as never),
    ...(retained.length > 0 ? [retainSearchParams([...retained] as never)] : []),
  ] as unknown as AnyMiddleware[]

  const commit = async (router: AnyRouter, patch: Raw, history: HistoryMode): Promise<void> => {
    assertRuns(router, id, scope)
    if (Object.keys(patch).length === 0) return
    const loose = router as unknown as LooseNavigate
    // Explicit `undefined` unsets; `delete` would leave a retained key in place.
    await loose.navigate({ search: (prev) => ({ ...prev, ...patch }), replace: history !== 'push' })
    loose.history.flush()
  }

  const handleFor = (key: string, def: Field<unknown>): Handle<unknown> => {
    const unset = Object.fromEntries(def.params(key).map((param) => [param, undefined]))
    const handle: Handle<unknown> & { toWindow?: unknown } = {
      key,
      kind: def.kind,
      history: def.history,
      fallback: def.fallback,
      get: (search) => def.read(key, search),
      set: (router, value) => commit(router, def.write(key, value), def.history),
      clear: (router) => commit(router, unset, def.history),
      link: (value) => ({ search: def.write(key, value) }),
      use: () => {
        const router = useRouter()
        const search = useSearch({ strict: false }) as Raw
        return [
          def.read(key, search),
          (value) => commit(router, def.write(key, value), def.history),
        ]
      },
    }
    if (def.kind === 'range') handle.toWindow = (def as RangeField<string, string, string>).toWindow
    return handle
  }

  return {
    id,
    scope,
    keys,
    validateSearch,
    extend,
    middlewares,
    field: Object.fromEntries(entries.map(([key, def]) => [key, handleFor(key, def)])) as never,
    useValues: () => {
      const search = useSearch({ strict: false }) as Raw
      return Object.assign(
        {},
        ...entries.map(([key, def]) => def.parse(key, search)),
      ) as SearchOf<F>
    },
  }
}
