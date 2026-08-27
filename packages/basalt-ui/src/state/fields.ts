/**
 * The store field vocabulary — `field.*`, its codecs, the `FieldHandle` contract every basalt
 * control binds to, and `createLocalStore`, the router-free lane.
 *
 * The router-coupled `createSearchStore` lives in `../router-tanstack/search-store` and is built on
 * the same `createStoreCore` below, so both factories resolve a value the same way:
 * URL ⊳ localStorage ⊳ fallback (C4). Ground truth: `docs/CONTROLS-SPEC.md` §4.
 *
 * Published through the `basalt-ui/state` barrel (`../state.ts`) — never imported directly by a
 * consumer.
 */
import { createPersistedState, readPersistedValue } from './persisted'

// ── Store fields — the vocabulary both store factories share ──────────────────────────────────

/**
 * Which lanes a field lives on, declared ONCE at definition (C4).
 *
 * `url` is the truth; `persist` is the localStorage mirror UNDER it. `history` picks the entry a
 * write creates. Declare the lane inline (`field.boolean(false, { url: false })`) — a lane held in
 * a widened variable still behaves correctly at runtime, but the TYPE-level lane filter that keeps
 * a local-only field out of `validateSearch` can only narrow a literal.
 *
 * @default `{ url: true, persist: true, history: 'replace' }`
 */
export type FieldLane = {
  /** Put the field in the URL search. `false` = the local-only lane (per-chart selects, compact). */
  url?: boolean
  /** Mirror the field in localStorage. `false` = the URL-only lane (pagination, one-shot filters). */
  persist?: boolean
  /** History entry a write creates. @default 'replace' */
  history?: 'push' | 'replace'
}

/** A `FieldLane` with every default applied — what a field descriptor actually carries. */
export type ResolvedLane = { url: boolean; persist: boolean; history: 'push' | 'replace' }

/** Lane defaults at the type level. Only an inline (const-inferred) lane object narrows. */
export type ResolveLane<L> = {
  url: L extends { url: false } ? false : true
  persist: L extends { persist: false } ? false : true
  history: L extends { history: 'push' } ? 'push' : 'replace'
}

/** The value of a range field: one preset, plus two ISO dates when the preset is `'custom'`. */
export type RangeValue<P extends string> = {
  preset: P
  from?: string | undefined
  to?: string | undefined
}

/** Renamed URL params for a range field. Defaults: the field's own name, `from`, `to`. */
export type RangeParams = { preset?: string; from?: string; to?: string }

export type EnumField<T extends string = string, Ln extends ResolvedLane = ResolvedLane> = {
  readonly kind: 'enum'
  readonly values: readonly T[]
  readonly fallback: T
  readonly lane: Ln
}

export type MultiField<T extends string = string, Ln extends ResolvedLane = ResolvedLane> = {
  readonly kind: 'multi'
  readonly values: readonly T[]
  readonly fallback: readonly T[]
  readonly lane: Ln
}

export type RangeField<
  P extends string = string,
  C extends boolean = boolean,
  Pm extends RangeParams = RangeParams,
  Ln extends ResolvedLane = ResolvedLane,
> = {
  readonly kind: 'range'
  /** The declared presets — `'custom'` is NOT one of them, it is `custom: true`'s consequence. */
  readonly presets: readonly P[]
  readonly fallback: RangeValue<P>
  /** `true` → the preset `'custom'` plus `from`/`to` ISO dates are legal values. */
  readonly custom: C
  readonly params: Pm
  readonly lane: Ln
}

/**
 * The preset union a range field's VALUES range over: the declared presets, plus `'custom'` unless
 * the field opted out. `C` widened to `boolean` (a `RangeField<P>` in a control's props) keeps
 * `'custom'`, so a widened handle can still carry a custom window.
 */
export type RangePresets<P, C> = (P & string) | (C extends false ? never : 'custom')

export type NumberField<Ln extends ResolvedLane = ResolvedLane> = {
  readonly kind: 'number'
  readonly fallback: number
  readonly min: number | undefined
  readonly max: number | undefined
  readonly int: boolean
  readonly lane: Ln
}

export type BooleanField<Ln extends ResolvedLane = ResolvedLane> = {
  readonly kind: 'boolean'
  readonly fallback: boolean
  readonly lane: Ln
}

export type StringField<Ln extends ResolvedLane = ResolvedLane> = {
  readonly kind: 'string'
  readonly fallback: string
  readonly max: number | undefined
  readonly lane: Ln
}

/** Every field kind, widened — the constraint a store's `fields` map satisfies. */
export type AnyField =
  | EnumField
  | MultiField
  | RangeField
  | NumberField
  | BooleanField
  | StringField

/** The value `use()` reads and writes for one field. Range fields deal in `RangeValue`. */
export type FieldValue<F extends AnyField> = F extends {
  kind: 'enum'
  values: readonly (infer T)[]
}
  ? T
  : F extends { kind: 'multi'; values: readonly (infer T)[] }
    ? readonly T[]
    : F extends { kind: 'range'; presets: readonly (infer P)[]; custom: infer C }
      ? RangeValue<RangePresets<P, C>>
      : F extends { kind: 'number' }
        ? number
        : F extends { kind: 'boolean' }
          ? boolean
          : F extends { kind: 'string' }
            ? string
            : never

/** One option of an enum / multi / range field, labelled through `store.labels()`. */
export type FieldOption = { value: string; label: string }

/** `toWindow` exists on a range handle and nowhere else — it is not an optional convenience. */
type RangeHandleExtras<F> = F extends {
  kind: 'range'
  presets: readonly (infer P)[]
  custom: infer C
}
  ? {
      /**
       * The API-facing projection of a range value: a preset becomes `{ window }`, a custom range
       * becomes `{ from, to }`. Replaces every hand-rolled `presetToParams`.
       */
      readonly toWindow: (
        v: RangeValue<RangePresets<P, C>>,
      ) => { window: RangePresets<P, C> } | { from: string; to: string }
    }
  : { readonly toWindow?: undefined }

/**
 * The binding every basalt control takes instead of `value`/`onChange` (C2). One field, both lanes,
 * one resolution law. Handed out by `createSearchStore().field.<name>` /
 * `createLocalStore().field.<name>`; never constructed by hand.
 */
export type FieldHandle<F extends AnyField> = {
  readonly kind: F['kind']
  readonly fallback: FieldValue<F>
  /** enum / multi / range options, labelled by `labels()`. Empty for the other kinds. */
  readonly options: readonly FieldOption[]
  /**
   * Read + write. Reads the URL when the field is on the URL lane (`useSearch({ strict: false })`,
   * so a control renders on a sibling or child route with no `from`), else localStorage, else the
   * fallback. Writes navigate when the matched route validates the param, then persist.
   */
  use(): readonly [FieldValue<F>, (next: FieldValue<F>) => void]
  isDefault(v: FieldValue<F>): boolean
} & RangeHandleExtras<F>

// ── field.* — declarative field builders ──────────────────────────────────────────────────────

/**
 * The field vocabulary. Every builder returns plain declarative data — no closures, no router, no
 * storage — which is what lets one field definition drive `createSearchStore` (URL + storage) and
 * `createLocalStore` (storage only) without a second description of the same param.
 *
 * @example
 * const store = createSearchStore({
 *   key: 'analytics',
 *   fields: {
 *     range: field.range({ presets: ['7d', '30d', '90d'], fallback: '30d', custom: true }),
 *     compare: field.enum(['none', 'previous'], 'none'),
 *     channels: field.multi(CHANNELS, []),
 *     minDuration: field.number({ fallback: 0, min: 0 }, { persist: false }),
 *     compact: field.boolean(false, { url: false }),
 *   },
 * })
 */
export const field = {
  /** A closed string enum — a tab, a compare mode, a single-select filter. */
  enum<const T extends string, const L extends FieldLane = FieldLane>(
    values: readonly T[],
    fallback: NoInfer<T>,
    lane?: L,
  ): EnumField<T, ResolveLane<L>> {
    return { kind: 'enum', values, fallback, lane: resolveLane(lane) as ResolveLane<L> }
  },

  /** An any-of set over the same closed enum. Decoding is deduped and canonically re-sorted. */
  multi<const T extends string, const L extends FieldLane = FieldLane>(
    values: readonly T[],
    fallback: readonly NoInfer<T>[] = [],
    lane?: L,
  ): MultiField<T, ResolveLane<L>> {
    return { kind: 'multi', values, fallback, lane: resolveLane(lane) as ResolveLane<L> }
  },

  /**
   * A time window: THREE URL params (preset + `from` + `to`, each renamable through `params`), so a
   * consumer's existing deep links and loaders keep their shape. `custom: true` additionally
   * allows the preset `'custom'` with two ISO dates.
   */
  range<
    const P extends string,
    const C extends boolean = false,
    const Pm extends RangeParams = RangeParams,
    const L extends FieldLane = FieldLane,
  >(
    o: { presets: readonly P[]; fallback: NoInfer<P>; custom?: C; params?: Pm },
    lane?: L,
  ): RangeField<P, C, Pm, ResolveLane<L>> {
    return {
      kind: 'range',
      presets: o.presets,
      fallback: { preset: o.fallback },
      // The only cast left, and it is narrow: `C` is inferred from this very literal, so the
      // runtime boolean IS `C` — `?? false` is what the compiler cannot see through.
      custom: (o.custom ?? false) as C,
      params: (o.params ?? {}) as Pm,
      lane: resolveLane(lane) as ResolveLane<L>,
    }
  },

  /** A number — pagination, a threshold. Out-of-range input clamps to `min`/`max`. */
  number<const L extends FieldLane = FieldLane>(
    o: { fallback: number; min?: number; max?: number; int?: boolean },
    lane?: L,
  ): NumberField<ResolveLane<L>> {
    return {
      kind: 'number',
      fallback: o.fallback,
      min: o.min,
      max: o.max,
      int: o.int === true,
      lane: resolveLane(lane) as ResolveLane<L>,
    }
  },

  /** A toggle. Accepts `true`/`false` and the strings `'true'`/`'false'` from a hand-typed URL. */
  boolean<const L extends FieldLane = FieldLane>(
    fallback: boolean,
    lane?: L,
  ): BooleanField<ResolveLane<L>> {
    return { kind: 'boolean', fallback, lane: resolveLane(lane) as ResolveLane<L> }
  },

  /** Free text — a search box. Defaults to `history: 'replace'` like every other field. */
  string<const L extends FieldLane = FieldLane>(
    o?: { fallback?: string; max?: number },
    lane?: L,
  ): StringField<ResolveLane<L>> {
    return {
      kind: 'string',
      fallback: o?.fallback ?? '',
      max: o?.max,
      lane: resolveLane(lane) as ResolveLane<L>,
    }
  },
}

function resolveLane(lane: FieldLane | undefined): ResolvedLane {
  return {
    url: lane?.url !== false,
    persist: lane?.persist !== false,
    history: lane?.history === 'push' ? 'push' : 'replace',
  }
}

// ── Flat search shapes — what a route's search actually holds ──────────────────────────────────

type UnionToIntersection<U> = (U extends unknown ? (x: U) => void : never) extends (
  x: infer I,
) => void
  ? I
  : never

type Prettify<T> = { [K in keyof T]: T[K] } & {}

type RangeParamName<Pm, K extends keyof RangeParams, D extends string> =
  Pm extends Record<K, infer N> ? (N extends string ? N : D) : D

/** The param entries ONE field owns. A range field owns three; every other kind owns one. */
type FieldSearch<K extends string, F extends AnyField> = F extends {
  kind: 'range'
  presets: readonly (infer P)[]
  custom: infer C
  params: infer Pm
}
  ? { [Q in RangeParamName<Pm, 'preset', K>]: RangePresets<P, C> } & {
      [Q in RangeParamName<Pm, 'from', 'from'>]?: string | undefined
    } & { [Q in RangeParamName<Pm, 'to', 'to'>]?: string | undefined }
  : { [Q in K]: FieldValue<F> }

type FieldNames<S> = keyof S & string

type UrlFieldNames<S> = {
  [K in FieldNames<S>]: S[K] extends { lane: { url: false } } ? never : K
}[FieldNames<S>]

/** The search object of a store's URL-lane fields — `validateSearch`'s return, flat. */
export type SearchValues<S extends Record<string, AnyField>> = Prettify<
  UnionToIntersection<{ [K in UrlFieldNames<S>]: FieldSearch<K, S[K]> }[UrlFieldNames<S>]>
>

/** The same flat shape over EVERY field, both lanes — what `readStored()` can return. */
export type StoredValues<S extends Record<string, AnyField>> = Prettify<
  UnionToIntersection<{ [K in FieldNames<S>]: FieldSearch<K, S[K]> }[FieldNames<S>]>
>

// ── Field codecs — one place that knows how a kind crosses the URL / storage boundary ──────────

/**
 * Everything a store needs to move one field between the URL, localStorage and a control.
 *
 * @internal Reachable on `basalt-ui/state` only because `./router-tanstack`'s store is built on it
 * — the two store factories are the public API, not this seam.
 */
export type FieldCodec = {
  readonly kind: AnyField['kind']
  readonly lane: ResolvedLane
  /** Every URL param this field owns. */
  readonly params: readonly string[]
  /**
   * The param whose PRESENCE in the current search means "the matched route validates this field".
   * A store's `validateSearch` always returns it, so a route that ran it has the key; a foreign
   * route does not, and a write there persists only (A1).
   */
  readonly primary: string
  readonly fallback: unknown
  /**
   * Validate a STORED (or caller-supplied) value. `null` = unusable.
   *
   * Deliberately a different function from `fromSearch` for one kind: the deprecated multi store
   * reads an empty URL array as "absent", and reusing that rule on the storage side would turn a
   * deliberately CLEARED filter into a miss and resurrect the fallback on upgrade.
   */
  decode(raw: unknown): unknown
  /** Pull the field out of a router search object. `null` = absent or invalid. */
  fromSearch(search: Record<string, unknown>): unknown
  /** The param entries a write puts on the URL. `undefined` values clear a stale param. */
  toSearch(value: unknown): Record<string, unknown>
  equals(a: unknown, b: unknown): boolean
  /** Option values in declaration order — enum, multi and range only. */
  readonly optionValues: readonly string[]
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?)?$/

function isIsoDate(raw: unknown): raw is string {
  return typeof raw === 'string' && ISO_DATE_RE.test(raw) && !Number.isNaN(Date.parse(raw))
}

/** Module-scoped because it closes over nothing — `true`/`false`, or the two string forms. */
function decodeBoolean(raw: unknown): unknown {
  if (typeof raw === 'boolean') return raw
  if (raw === 'true') return true
  if (raw === 'false') return false
  return null
}

function sameList(a: unknown, b: unknown): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  return a.length === b.length && a.every((entry, i) => entry === b[i])
}

/**
 * Build the codec for one field. `legacyMultiEmpty` restores the DEPRECATED multi-store's rule that
 * an EMPTY url array means "absent, fall through to storage" — the deprecated wrapper's contract,
 * never the new store's, where an empty selection is a value like any other.
 *
 * @internal — see `FieldCodec`.
 */
export function resolveFieldCodec(
  name: string,
  f: AnyField,
  opts?: { legacyMultiEmpty?: boolean },
): FieldCodec {
  switch (f.kind) {
    case 'enum': {
      const allowed = new Set<string>(f.values)
      const decode = (raw: unknown): unknown =>
        typeof raw === 'string' && allowed.has(raw) ? raw : null
      return single(name, f, decode, { optionValues: f.values })
    }
    case 'multi': {
      const present = new Set<string>(f.values)
      const decode = (raw: unknown): unknown => {
        if (!Array.isArray(raw)) return null
        const picked = new Set<string>()
        for (const entry of raw) {
          if (typeof entry === 'string' && present.has(entry)) picked.add(entry)
        }
        return f.values.filter((value) => picked.has(value))
      }
      // The legacy empty-array rule is a URL rule ONLY. A stored `[]` is what "I cleared every
      // filter" looks like, and the deprecated store has always read it back as `[]`.
      const decodeUrl =
        opts?.legacyMultiEmpty === true
          ? (raw: unknown): unknown => {
              const value = decode(raw)
              return Array.isArray(value) && value.length === 0 ? null : value
            }
          : decode
      return single(name, f, decode, {
        optionValues: f.values,
        equals: sameList,
        decodeUrl,
      })
    }
    case 'range': {
      const presetParam = f.params.preset ?? name
      const fromParam = f.params.from ?? 'from'
      const toParam = f.params.to ?? 'to'
      const allowed = new Set<string>(f.presets)
      const decode = (raw: unknown): unknown => {
        if (typeof raw !== 'object' || raw === null) return null
        const value = raw as { preset?: unknown; from?: unknown; to?: unknown }
        if (typeof value.preset !== 'string') return null
        if (value.preset === 'custom') {
          if (!f.custom || !isIsoDate(value.from) || !isIsoDate(value.to)) return null
          return { preset: 'custom', from: value.from, to: value.to }
        }
        return allowed.has(value.preset) ? { preset: value.preset } : null
      }
      return {
        kind: 'range',
        lane: f.lane,
        params: [presetParam, fromParam, toParam],
        primary: presetParam,
        fallback: f.fallback,
        decode,
        fromSearch: (search) =>
          decode({
            preset: search[presetParam],
            from: search[fromParam],
            to: search[toParam],
          }),
        toSearch: (value) => {
          const range = value as RangeValue<string>
          return {
            [presetParam]: range.preset,
            [fromParam]: range.from,
            [toParam]: range.to,
          }
        },
        equals: (a, b) => {
          const x = a as RangeValue<string> | null
          const y = b as RangeValue<string> | null
          if (x === null || y === null) return x === y
          return x.preset === y.preset && x.from === y.from && x.to === y.to
        },
        optionValues: f.custom ? [...f.presets, 'custom'] : f.presets,
      }
    }
    case 'number': {
      const decode = (raw: unknown): unknown => {
        const parsed = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
        if (!Number.isFinite(parsed)) return null
        if (f.int && !Number.isInteger(parsed)) return null
        let value = parsed
        if (f.min !== undefined && value < f.min) value = f.min
        if (f.max !== undefined && value > f.max) value = f.max
        return value
      }
      return single(name, f, decode)
    }
    case 'boolean': {
      return single(name, f, decodeBoolean)
    }
    case 'string': {
      const decode = (raw: unknown): unknown => {
        if (typeof raw !== 'string') return null
        return f.max !== undefined && raw.length > f.max ? raw.slice(0, f.max) : raw
      }
      return single(name, f, decode)
    }
    default: {
      throw new Error('basalt-ui: createSearchStore received a field of an unknown kind')
    }
  }
}

/** Codec shell for every kind that owns exactly one URL param. */
function single(
  name: string,
  f: AnyField,
  decode: (raw: unknown) => unknown,
  extra?: {
    optionValues?: readonly string[]
    equals?: (a: unknown, b: unknown) => boolean
    /** URL-side decoder when it differs from the storage-side one (multi, legacy layout only). */
    decodeUrl?: (raw: unknown) => unknown
  },
): FieldCodec {
  const decodeUrl = extra?.decodeUrl ?? decode
  return {
    kind: f.kind,
    lane: f.lane,
    params: [name],
    primary: name,
    fallback: f.fallback,
    decode,
    fromSearch: (search) => decodeUrl(search[name]),
    toSearch: (value) => ({ [name]: value }),
    equals: extra?.equals ?? ((a, b) => a === b),
    optionValues: extra?.optionValues ?? [],
  }
}

// ── Store core — the half `createSearchStore` and `createLocalStore` share ─────────────────────

type StoreRecord = Record<string, unknown>

/** One named field plus its codec, in declaration order. @internal — see `FieldCodec`. */
export type StoreEntry = { readonly name: string; readonly codec: FieldCodec }

export type StoreCoreOptions = {
  readonly key: string
  readonly fields: Record<string, AnyField>
  readonly version?: number | undefined
  /**
   * Legacy single-value storage layout: the whole envelope value IS this field's value, the shape
   * `createSearchParamStore` has written since 1.0.0. Set ONLY by the deprecated wrappers — a
   * consumer's already-persisted selection has to keep resolving byte-for-byte.
   */
  readonly legacyValueField?: string
}

/**
 * The storage + resolution kernel. Deliberately NOT exported from any barrel: it is the seam
 * between `./state`'s router-free store and `./router-tanstack`'s router-coupled one, and both of
 * those are the public API.
 *
 * @internal — see `FieldCodec`.
 */
export type StoreCore = {
  readonly entries: readonly StoreEntry[]
  readonly urlEntries: readonly StoreEntry[]
  readonly anyPersisted: boolean
  usePersistedRecord(): readonly [StoreRecord, (next: StoreRecord) => void]
  readRecord(): StoreRecord
  setLabels(map: Record<string, Record<string, string> | undefined>): void
  optionsFor(entry: StoreEntry): readonly FieldOption[]
  /** The resolution law, once: URL ⊳ localStorage ⊳ fallback. `search: null` skips the URL lane. */
  resolve(entry: StoreEntry, search: StoreRecord | null, record: StoreRecord): unknown
  writeField(setRecord: (next: StoreRecord) => void, name: string, value: unknown): void
  /** Every stored field, flattened into URL-param shape, `undefined` entries dropped. */
  readStoredFlat(): StoreRecord
  handle(
    entry: StoreEntry,
    use: () => readonly [unknown, (next: unknown) => void],
  ): FieldHandle<AnyField>
}

function isRecord(raw: unknown): raw is StoreRecord {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw)
}

/** Copy `from` onto `into`, dropping `undefined` values (a stored range carries no from/to). */
function assignDefined(into: StoreRecord, from: StoreRecord): void {
  for (const [key, value] of Object.entries(from)) {
    if (value !== undefined) into[key] = value
  }
}

/**
 * The resolution law, in one place: URL ⊳ localStorage ⊳ fallback (C4). `search: null` skips the
 * URL lane — what the local lane and `linkSearch` pass.
 */
function resolveField(entry: StoreEntry, search: StoreRecord | null, record: StoreRecord): unknown {
  const fromUrl = search === null ? null : entry.codec.fromSearch(search)
  if (fromUrl !== null) return fromUrl
  if (entry.codec.lane.persist) {
    const stored = entry.codec.decode(record[entry.name])
    if (stored !== null) return stored
  }
  return entry.codec.fallback
}

/** @internal — the seam behind `createSearchStore` and `createLocalStore`. */
export function createStoreCore(o: StoreCoreOptions): StoreCore {
  const version = o.version ?? 1
  const legacy = o.legacyValueField
  const entries: StoreEntry[] = Object.entries(o.fields).map(([name, f]) => ({
    name,
    codec: resolveFieldCodec(name, f, { legacyMultiEmpty: legacy !== undefined }),
  }))
  const urlEntries = entries.filter((entry) => entry.codec.lane.url)
  const anyPersisted = entries.some((entry) => entry.codec.lane.persist)
  const labels = new Map<string, Record<string, string>>()

  // ONE localStorage entry per store, holding a `{ fieldName: value }` record — so every field of
  // a store costs exactly one hook (`react/rules-of-hooks` forbids a per-field hook in a loop) and
  // `useReset` can write every field in one go.
  const usePersistedRaw = createPersistedState<unknown>({ key: o.key, version, initial: null })

  const toRecord = (raw: unknown): StoreRecord => {
    if (legacy !== undefined) return raw === null || raw === undefined ? {} : { [legacy]: raw }
    return isRecord(raw) ? raw : {}
  }
  const fromRecord = (record: StoreRecord): unknown =>
    legacy !== undefined ? (record[legacy] ?? null) : record

  const readRecord = (): StoreRecord => toRecord(readPersistedValue(o.key, version))

  const optionsFor = (entry: StoreEntry): readonly FieldOption[] => {
    const map = labels.get(entry.name)
    return entry.codec.optionValues.map((value) => ({ value, label: map?.[value] ?? value }))
  }

  const writeField = (
    setRecord: (next: StoreRecord) => void,
    name: string,
    value: unknown,
  ): void => {
    // Re-read rather than closing over the render-time record: two fields written in one tick
    // would otherwise clobber each other.
    setRecord({ ...readRecord(), [name]: value })
  }

  const handle = (
    entry: StoreEntry,
    use: () => readonly [unknown, (next: unknown) => void],
  ): FieldHandle<AnyField> => {
    const { codec } = entry
    const built: Record<string, unknown> = {
      kind: codec.kind,
      fallback: codec.fallback,
      use,
      isDefault: (v: unknown) => codec.equals(v, codec.fallback),
    }
    if (codec.kind === 'range') {
      built['toWindow'] = (v: RangeValue<string>) =>
        v.preset === 'custom' && v.from !== undefined && v.to !== undefined
          ? { from: v.from, to: v.to }
          : { window: v.preset }
    }
    // A GETTER, not a snapshot, and installed with defineProperty rather than declared in the
    // literal: `labels()` runs on the store after the handles exist, and an object spread would
    // evaluate the getter once at spread time and freeze the unlabelled options.
    Object.defineProperty(built, 'options', {
      enumerable: true,
      get: (): readonly FieldOption[] => optionsFor(entry),
    })
    return built as unknown as FieldHandle<AnyField>
  }

  return {
    entries,
    urlEntries,
    anyPersisted,
    usePersistedRecord() {
      const [raw, setRaw] = usePersistedRaw()
      return [toRecord(raw), (next: StoreRecord) => setRaw(fromRecord(next))] as const
    },
    readRecord,
    setLabels(map) {
      for (const [name, entry] of Object.entries(map)) {
        if (entry !== undefined) labels.set(name, entry)
      }
    },
    optionsFor,
    resolve: resolveField,
    writeField,
    readStoredFlat() {
      const record = readRecord()
      const out: StoreRecord = {}
      for (const entry of entries) {
        const stored = entry.codec.decode(record[entry.name])
        if (stored !== null) assignDefined(out, entry.codec.toSearch(stored))
      }
      return out
    },
    handle,
  }
}

// ── createLocalStore — the router-free lane ────────────────────────────────────────────────────

/** `Pick<SearchStore<S>, 'field' | 'readStored'>` — the same handles, storage only, no router. */
export type LocalStore<S extends Record<string, AnyField>> = {
  readonly field: { [K in keyof S]: FieldHandle<S[K]> }
  readStored: () => Partial<StoredValues<S>>
}

/**
 * A store with no URL lane and no router import: per-chart selects, a section's view tab, a compact
 * toggle. Same `field.*` vocabulary and the same `FieldHandle` every basalt control binds to, so a
 * control cannot tell the two stores apart — which is the point, and why the local lane is not an
 * excuse to reach for `useState` (C3).
 *
 * A field's `url` lane is ignored here (there is no URL to write); `persist: false` leaves a field
 * on its fallback, which is what it means for a value to have nowhere to live.
 *
 * @example
 * const chart = createLocalStore({
 *   key: 'momentum-chart',
 *   fields: { metric: field.enum(['load', 'volume'], 'load') },
 * })
 * // <SelectFilter field={chart.field.metric} label="Metric" />
 */
export function createLocalStore<const S extends Record<string, AnyField>>(o: {
  key: string
  fields: S
  version?: number
}): LocalStore<S> {
  const core = createStoreCore({ key: o.key, fields: o.fields, version: o.version })

  const field = {} as { [K in keyof S]: FieldHandle<S[K]> }
  for (const entry of core.entries) {
    const handle = core.handle(entry, () => {
      const [record, setRecord] = core.usePersistedRecord()
      const value = core.resolve(entry, null, record)
      return [value, (next: unknown) => core.writeField(setRecord, entry.name, next)] as const
    })
    field[entry.name as keyof S] = handle as unknown as FieldHandle<S[keyof S]>
  }

  return {
    field,
    readStored: () => core.readStoredFlat() as Partial<StoredValues<S>>,
  }
}
