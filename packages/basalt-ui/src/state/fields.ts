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
import { useSyncExternalStore } from 'react'
import { createPersistedState, readPersistedValue, writePersistedValue } from './persisted'

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
  /** Put the field in the URL search. `false` = the mirror-only lane (per-chart selects, compact). */
  url?: boolean
  /**
   * Mirror the field in localStorage. `false` = the URL-only lane (pagination, one-shot filters);
   * with `url: false` as well, the MEMORY-only lane — shared across every mount of the store for
   * the session, gone on reload, never in localStorage. `createLocalStore` ignores `url`, so
   * `persist: false` alone lands a field there.
   */
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

/**
 * A field's fallback: the value, or a THUNK evaluated at read time (`field.string({ fallback: () =>
 * todayIso() })`). A thunk is re-evaluated on every read while nothing is written, and is never
 * itself persisted — a write stores the value the control produced, like any other.
 *
 * The LOCAL and MEMORY lanes only. `createSearchStore` throws at definition for a thunk on a
 * URL-lane field: `validateSearch` would evaluate it on every navigation and pin the result into the
 * URL, so a deep link would carry a value nobody chose.
 */
export type FieldFallback<T> = T | (() => T)

/** Resolves a per-preset window at call time. Returns ISO dates — what `toWindow` hands an API. */
export type RangeWindow = (now: Date) => { from: string; to: string }

/**
 * Per-preset window resolvers for a range field. A preset WITH one resolves through `toWindow()` to
 * `{ from, to }`; a preset without keeps `{ window: preset }` — which is what lets a derived preset
 * (`3m`, `ytd`) live in the same field as a server-understood one (`7d`) instead of forcing a
 * hand-rolled `presetToParams` beside the store.
 */
export type RangeWindows<P extends string> = Partial<Record<P, RangeWindow>>

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
  readonly fallback: FieldFallback<T>
  readonly lane: Ln
}

export type MultiField<T extends string = string, Ln extends ResolvedLane = ResolvedLane> = {
  readonly kind: 'multi'
  readonly values: readonly T[]
  readonly fallback: FieldFallback<readonly T[]>
  readonly lane: Ln
}

export type RangeField<
  P extends string = string,
  C extends boolean = boolean,
  Pm extends RangeParams = RangeParams,
  Ln extends ResolvedLane = ResolvedLane,
  W extends string = never,
> = {
  readonly kind: 'range'
  /** The declared presets — `'custom'` is NOT one of them, it is `custom: true`'s consequence. */
  readonly presets: readonly P[]
  readonly fallback: FieldFallback<RangeValue<P>>
  /** `true` → the preset `'custom'` plus `from`/`to` ISO dates are legal values. */
  readonly custom: C
  readonly params: Pm
  /**
   * The declared window resolvers, keyed by preset — `W` is exactly the presets that HAVE one, so
   * `toWindow`'s return type can drop them from its `{ window }` branch and an API param type
   * accepts the result with no cast.
   *
   * `W` defaults to `never` (`window: {}`), which is what keeps every `RangeField<P>` assignable to
   * the widened `AnyField` a control's props take: a narrower resolver map is assignable to `{}`,
   * and a widened handle's `toWindow` then excludes nothing rather than everything.
   */
  readonly window: RangeWindows<W>
  readonly lane: Ln
}

/**
 * The preset union a range field's VALUES range over: the declared presets, plus `'custom'` unless
 * the field opted out.
 *
 * `C` widened to `boolean` (a bare `RangeField<P>`) keeps `'custom'` — but a PROP typed that way
 * accepts only a custom-capable handle, because the handle's setter is contravariant in the value:
 * `field.range` without `custom: true` hands out a `RangeField<P, false>`, whose setter refuses a
 * `'custom'` preset. A wrapper that must take any range handle is generic over the flag
 * (`<P extends string, C extends boolean>` + `FieldHandle<RangeField<P, C>>`); one that only ever
 * takes the preset-only shape pins `RangeField<P, false>`.
 */
export type RangePresets<P, C> = (P & string) | (C extends false ? never : 'custom')

export type NumberField<Ln extends ResolvedLane = ResolvedLane> = {
  readonly kind: 'number'
  readonly fallback: FieldFallback<number>
  readonly min: number | undefined
  readonly max: number | undefined
  readonly int: boolean
  readonly lane: Ln
}

export type BooleanField<Ln extends ResolvedLane = ResolvedLane> = {
  readonly kind: 'boolean'
  readonly fallback: FieldFallback<boolean>
  readonly lane: Ln
}

export type StringField<Ln extends ResolvedLane = ResolvedLane> = {
  readonly kind: 'string'
  readonly fallback: FieldFallback<string>
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

/**
 * The second, optional argument of a `FieldHandle` setter.
 *
 * @example field.tab.use()[1]('overview', { patch: { detailDate: undefined } })
 */
export type FieldSetOptions = {
  /**
   * Extra search params merged into the SAME navigate as the field's own write — the URL lane only
   * (a local/memory-lane write has no navigate to merge into, and ignores this). For keys the STORE
   * DOES NOT OWN: clearing a sibling param the page put there (`{ detailDate: undefined }`) used to
   * need a second `navigate` beside the setter, which either lost the field's write or produced two
   * history entries. The field's own params always win, so a `patch` cannot corrupt the value being
   * set.
   *
   * A key ANOTHER field of the same store owns is refused — it would reach the URL while the
   * mirror kept the old value, so the next paramless visit and every `linkSearch` link disagree
   * with the page the write happened on. `createSearchStore` throws in dev and logs in production;
   * write that field through its own setter instead.
   *
   * A write from a route that does not validate the field persists only (A1) and drops the patch
   * with it — there is no navigate to merge into. Dev warns once per field.
   */
  readonly patch?: Record<string, unknown>
}

/** One option of an enum / multi / range field, labelled through `store.labels()`. */
export type FieldOption = { value: string; label: string }

/** `toWindow` exists on a range handle and nowhere else — it is not an optional convenience. */
type RangeHandleExtras<F> = F extends {
  kind: 'range'
  presets: readonly (infer P)[]
  custom: infer C
  window: RangeWindows<infer W>
}
  ? {
      /**
       * The API-facing projection of a range value: a preset becomes `{ window }`, a custom range
       * becomes `{ from, to }`. Replaces every hand-rolled `presetToParams`.
       *
       * A preset declared with a `window` resolver (`field.range({ window: { '3m': ... } })`)
       * becomes `{ from, to }` too — the resolver runs at CALL time with the current `Date`, so a
       * derived window (`3m`, `ytd`) is never stale and never leaves the store.
       *
       * Those presets are EXCLUDED from the `{ window }` branch, so the result assigns to an API
       * param type that only knows the server-understood windows with no cast — which is the half
       * that lets a consumer delete the switch rather than move it. A `custom: true` field keeps
       * `'custom'` in the union: a custom preset with no dates resolves to `{ window: 'custom' }`,
       * so that one still needs a guard before it reaches such a type.
       */
      readonly toWindow: (
        v: RangeValue<RangePresets<P, C>>,
      ) => { window: Exclude<RangePresets<P, C>, W> } | { from: string; to: string }
    }
  : { readonly toWindow?: undefined }

/**
 * A number handle's declared bounds, republished from the field — `RangeHandleExtras`' shape for the
 * numeric kind, and there for the same reason: a control cannot ask the field descriptor anything,
 * it only ever sees the handle.
 *
 * The codec has always CLAMPED to these on write, so before this the only way a `NumberFilter` could
 * learn its own limits was for the call site to pass them a second time — a second answer to a
 * question the field already owns, and one that silently stops matching the moment the field moves.
 * With them on the handle the input can bound its own stepper, which turns the clamp from a
 * correction the user watches happen into a value they cannot type in the first place.
 *
 * `int` is the third member because it is the same class of fact: it decides the stepper's grain
 * (`step` 1, decimals refused), and the codec already rejects a non-integer for that field.
 */
type NumberHandleExtras<F> = F extends { kind: 'number' }
  ? {
      /** The field's `min`, or `undefined` when it declared none. Clamped on write regardless. */
      readonly min: number | undefined
      /** The field's `max`, or `undefined` when it declared none. Clamped on write regardless. */
      readonly max: number | undefined
      /** `field.number({ int: true })` — a non-integer is refused by the codec, not rounded. */
      readonly int: boolean
    }
  : { readonly min?: undefined; readonly max?: undefined; readonly int?: undefined }

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
  use(): readonly [FieldValue<F>, (next: FieldValue<F>, opts?: FieldSetOptions) => void]
  /**
   * UNSET the field — what a control's reset calls, and deliberately not `set(fallback)`. The
   * persist lane DELETES the field's key from the mirror, the memory lane drops its value, and the
   * URL lane navigates back to the fallback params (plus dropping the mirror key under it).
   *
   * Writing the fallback instead pins it: a THUNK fallback (`() => todayIso()`) resolves at the
   * moment of the reset, so a reader who pressed `Reset all` today was handed today's date
   * tomorrow, with the field counted as active in `Filters (n)`. Unsetting lets the fallback keep
   * resolving, which is what `FieldFallback`'s contract says it does.
   *
   * Callable outside render (an event handler is the only realistic caller); on the URL lane it
   * navigates through the last render of `use()`, so a handle that no mount has read clears the
   * mirror only.
   */
  clear(): void
  isDefault(v: FieldValue<F>): boolean
} & RangeHandleExtras<F> &
  NumberHandleExtras<F>

// ── field.* — declarative field builders ──────────────────────────────────────────────────────

/**
 * `field.range`'s options. `C` is the `custom` flag, pinned per overload — never inferred; `W` is
 * inferred from `window`'s KEYS (constrained to the declared presets, so a typo is still an error
 * here) and is what carries the resolved presets into `toWindow`'s return type.
 */
type RangeOptions<P extends string, C extends boolean, Pm extends RangeParams, W extends P> = {
  presets: readonly P[]
  fallback: FieldFallback<NoInfer<P>>
  custom?: C
  params?: Pm
  /** Per-preset window resolvers — the presets `toWindow()` answers with `{ from, to }`. */
  window?: RangeWindows<W>
}

/**
 * A time window: THREE URL params (preset + `from` + `to`, each renamable through `params`), so a
 * consumer's existing deep links and loaders keep their shape. `custom: true` additionally
 * allows the preset `'custom'` with two ISO dates. `window` resolves a DERIVED preset (`3m`, `ytd`)
 * to `{ from, to }` through `toWindow()` while it stays one preset in the URL.
 *
 * A second `field.range` in the same store — or a second range store composed into the same
 * route's `validateSearch` — MUST rename `from`/`to` via `params`: every range defaults to the
 * literal param names `'from'`/`'to'`, and two fields silently sharing them makes the later one's
 * `toSearch` overwrite the earlier one's dates. `createStoreCore` throws at definition for the
 * in-store case; the cross-store case is not detectable by either store alone.
 *
 * THREE overloads, one per `custom` shape, because a single `custom?: C` signature is inferred
 * against `AnyField` when the call sits inline in `createSearchStore({ fields })` — the contextual
 * return type wins, `C` widens to `boolean`, and every value type gains a `'custom'` preset the
 * field never allowed. Overloads have no `C` to widen: an omitted or `false` flag picks the first,
 * a literal `true` the second, and a value typed `boolean` the third (widened, as declared).
 */
function rangeField<
  const P extends string,
  const Pm extends RangeParams = RangeParams,
  const L extends FieldLane = FieldLane,
  const W extends P = never,
>(o: RangeOptions<P, false, Pm, W>, lane?: L): RangeField<P, false, Pm, ResolveLane<L>, W>
function rangeField<
  const P extends string,
  const Pm extends RangeParams = RangeParams,
  const L extends FieldLane = FieldLane,
  const W extends P = never,
>(o: RangeOptions<P, true, Pm, W>, lane?: L): RangeField<P, true, Pm, ResolveLane<L>, W>
function rangeField<
  const P extends string,
  const Pm extends RangeParams = RangeParams,
  const L extends FieldLane = FieldLane,
  const W extends P = never,
>(o: RangeOptions<P, boolean, Pm, W>, lane?: L): RangeField<P, boolean, Pm, ResolveLane<L>, W>
function rangeField(
  o: RangeOptions<string, boolean, RangeParams, string>,
  lane?: FieldLane,
): RangeField<string, boolean, RangeParams, ResolvedLane, string> {
  const { fallback } = o
  return {
    kind: 'range',
    presets: o.presets,
    // A thunk fallback stays a thunk — wrapped so the lazy value is read at the same moment every
    // other lane reads one, not once here at definition.
    fallback:
      typeof fallback === 'function' ? () => ({ preset: fallback() }) : { preset: fallback },
    custom: o.custom ?? false,
    params: o.params ?? {},
    window: o.window ?? {},
    lane: resolveLane(lane),
  }
}

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
    fallback: FieldFallback<NoInfer<T>>,
    lane?: L,
  ): EnumField<T, ResolveLane<L>> {
    return { kind: 'enum', values, fallback, lane: resolveLane(lane) as ResolveLane<L> }
  },

  /** An any-of set over the same closed enum. Decoding is deduped and canonically re-sorted. */
  multi<const T extends string, const L extends FieldLane = FieldLane>(
    values: readonly T[],
    fallback: FieldFallback<readonly NoInfer<T>[]> = [],
    lane?: L,
  ): MultiField<T, ResolveLane<L>> {
    return { kind: 'multi', values, fallback, lane: resolveLane(lane) as ResolveLane<L> }
  },

  range: rangeField,

  /** A number — pagination, a threshold. Out-of-range input clamps to `min`/`max`. */
  number<const L extends FieldLane = FieldLane>(
    o: { fallback: FieldFallback<number>; min?: number; max?: number; int?: boolean },
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
    fallback: FieldFallback<boolean>,
    lane?: L,
  ): BooleanField<ResolveLane<L>> {
    return { kind: 'boolean', fallback, lane: resolveLane(lane) as ResolveLane<L> }
  },

  /** Free text — a search box. Defaults to `history: 'replace'` like every other field. */
  string<const L extends FieldLane = FieldLane>(
    o?: { fallback?: FieldFallback<string>; max?: number },
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
  /**
   * The fallback, ALREADY resolved — a getter, because `field.*({ fallback: () => … })` is a thunk
   * that must run at read time and re-run while nothing is written. Every call site reads it as a
   * plain value, which is why the laziness is invisible past this line.
   */
  readonly fallback: unknown
  /** Range only: the per-preset window resolvers `toWindow` answers a derived preset through. */
  readonly windows?: RangeWindows<string>
  /**
   * Number only: the declared bounds and grain the codec clamps to, republished so `handle` can put
   * them on the handle. The codec is the only thing that reads the field descriptor, so a control
   * that needs a limit has to be handed it from here — see {@link NumberHandleExtras}.
   */
  readonly bounds?: {
    readonly min: number | undefined
    readonly max: number | undefined
    readonly int: boolean
  }
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

/**
 * Resolve a possibly-lazy fallback. `typeof === 'function'` is an exact discriminator here: no field
 * kind has a function as a legal VALUE, so a function can only ever be the thunk form.
 */
function resolveFallback(raw: unknown): unknown {
  return typeof raw === 'function' ? (raw as () => unknown)() : raw
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?)?$/

function isIsoDate(raw: unknown): raw is string {
  return typeof raw === 'string' && ISO_DATE_RE.test(raw) && !Number.isNaN(Date.parse(raw))
}

/**
 * A plain decimal — no blank/whitespace, no hex, no exponent. `Number('')`/`Number(' ')` are `0`
 * and `Number('0x10')` is `16`, so a bare `Number(raw)` coercion silently manufactures a value the
 * codec itself would never have written (`toSearch` never emits `''` or a hex literal) — a
 * hand-edited or blank-linked `?count=` must fall through to the fallback, not become `0`.
 */
const NUMERIC_RE = /^-?\d+(\.\d+)?$/

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
        get fallback() {
          return resolveFallback(f.fallback)
        },
        windows: f.window,
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
        const parsed =
          typeof raw === 'number'
            ? raw
            : typeof raw === 'string' && NUMERIC_RE.test(raw)
              ? Number(raw)
              : NaN
        if (!Number.isFinite(parsed)) return null
        if (f.int && !Number.isInteger(parsed)) return null
        let value = parsed
        if (f.min !== undefined && value < f.min) value = f.min
        if (f.max !== undefined && value > f.max) value = f.max
        return value
      }
      // The same three values the clamp above reads, handed on so the CONTROL can bound its input
      // rather than watch the clamp correct it after the fact. Threaded THROUGH `single` rather
      // than spread onto its result: `fallback` is a getter, and a spread would evaluate it once
      // here and freeze a thunk fallback at definition.
      return single(name, f, decode, { bounds: { min: f.min, max: f.max, int: f.int } })
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

/**
 * Codec shell for every kind that owns exactly one URL param.
 *
 * NEVER spread the returned object: `fallback` is a GETTER over a possibly-lazy fallback, and an
 * object spread evaluates it once and copies the result as a plain value — which froze the number
 * kind's thunk fallback at store definition for one minor. Anything a kind needs to add goes
 * through `extra`.
 */
function single(
  name: string,
  f: AnyField,
  decode: (raw: unknown) => unknown,
  extra?: {
    optionValues?: readonly string[]
    equals?: (a: unknown, b: unknown) => boolean
    /** URL-side decoder when it differs from the storage-side one (multi, legacy layout only). */
    decodeUrl?: (raw: unknown) => unknown
    /** Number only: the declared bounds and grain, republished onto the handle. */
    bounds?: FieldCodec['bounds']
  },
): FieldCodec {
  const decodeUrl = extra?.decodeUrl ?? decode
  return {
    kind: f.kind,
    lane: f.lane,
    params: [name],
    primary: name,
    get fallback() {
      return resolveFallback(f.fallback)
    },
    ...(extra?.bounds !== undefined && { bounds: extra.bounds }),
    decode,
    fromSearch: (search) => decodeUrl(search[name]),
    toSearch: (value) => ({ [name]: value }),
    equals: extra?.equals ?? ((a, b) => a === b),
    optionValues: extra?.optionValues ?? [],
  }
}

// ── Store core — the half `createSearchStore` and `createLocalStore` share ─────────────────────

type StoreRecord = Record<string, unknown>

/**
 * A field's write, untyped — the shape both factories build and `handle` hands out. `opts` is the
 * public `FieldSetOptions`; only the URL lane can act on it.
 *
 * @internal — see `FieldCodec`.
 */
export type FieldWrite = (next: unknown, opts?: FieldSetOptions) => void

/** One field's `use()`, untyped. @internal — see `FieldCodec`. */
export type FieldUse = () => readonly [unknown, FieldWrite]

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
  /**
   * The IN-MEMORY lane's `use()` for one field — a field with neither the URL nor the mirror.
   * Lives here rather than in either factory because BOTH have such a field: `createLocalStore`'s
   * `persist: false`, and `createSearchStore`'s `{ url: false, persist: false }`.
   */
  memoryUse(entry: StoreEntry): FieldUse
  /** The memory lane's value for one field, resolved — its fallback while nothing was written. */
  readMemoryValue(entry: StoreEntry): unknown
  /** Subscribes to the whole memory lane. The snapshot is a write counter, so it is always stable. */
  useMemoryVersion(): number
  /** Drops every memory value, so the next read resolves to the fallback. What `useReset` calls. */
  resetMemory(): void
  /**
   * Deletes ONE field's key from the localStorage record, so the next read falls through to the
   * live fallback. Not a hook: `FieldHandle.clear()` runs in an event handler, where the persisted
   * setter from `usePersistedRecord()` is not in reach — it writes through the same envelope and
   * wakes the same per-key listeners (`writePersistedValue`).
   */
  clearField(name: string): void
  /** The memory lane's half of the same: drops ONE field's value. */
  clearMemory(name: string): void
  /** Every stored field, flattened into URL-param shape, `undefined` entries dropped. */
  readStoredFlat(): StoreRecord
  handle(entry: StoreEntry, use: FieldUse, clear: () => void): FieldHandle<AnyField>
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

/**
 * The IN-MEMORY lane, one per store: the home of a field that has neither the URL nor the
 * localStorage mirror (`createLocalStore`'s `persist: false`, `createSearchStore`'s
 * `{ url: false, persist: false }`). Session-scoped and SHARED across every mount of that store —
 * two charts binding one field agree, and a remount inside the session still reads the value back —
 * while nothing is written to or read from localStorage.
 *
 * An external store rather than `useState`, for exactly that sharing. The SNAPSHOT is a write
 * counter and never the value: `useSyncExternalStore` requires a referentially stable snapshot, and
 * a counter is stable by construction for every field kind, object values included.
 */
function createMemoryLane(): {
  subscribe: (cb: () => void) => () => void
  getVersion: () => number
  resolve: (entry: StoreEntry) => unknown
  write: (name: string, value: unknown) => void
  remove: (name: string) => void
  clear: () => void
} {
  const values = new Map<string, unknown>()
  const listeners = new Set<() => void>()
  let version = 0

  const bump = (): void => {
    version += 1
    for (const cb of listeners) cb()
  }

  return {
    subscribe: (cb) => {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    getVersion: () => version,
    // `undefined` is the only "never written" marker the lane needs: no field kind has `undefined`
    // as a legal value, so it can never collide with a written one.
    resolve: (entry) => {
      const stored = values.get(entry.name)
      return stored === undefined ? entry.codec.fallback : stored
    },
    write: (name, value) => {
      values.set(name, value)
      bump()
    },
    remove: (name) => {
      if (!values.delete(name)) return
      bump()
    },
    clear: () => {
      if (values.size === 0) return
      values.clear()
      bump()
    },
  }
}

/**
 * Two fields sharing a URL param name silently overwrite each other: `flatten` (search-store.ts)
 * and `readStoredFlat` (below) both `Object.assign`/`assignDefined` per entry in declaration order,
 * so a later field's `toSearch` clobbers an earlier one — a second `field.range` in the same store
 * is the ordinary way to hit it, since every range defaults its `from`/`to` params to those literal
 * names. Checked over ALL entries, not just the URL lane: a mirror-only range collides the same way
 * through `readStoredFlat`.
 */
function assertNoParamCollision(key: string, entries: readonly StoreEntry[]): void {
  const owner = new Map<string, string>()
  for (const entry of entries) {
    for (const param of entry.codec.params) {
      const existing = owner.get(param)
      if (existing !== undefined && existing !== entry.name) {
        throw new Error(
          `basalt-ui: createSearchStore('${key}'): fields '${existing}' and '${entry.name}' both ` +
            `own the URL param '${param}' — rename one via field.range({ params: { ... } }).`,
        )
      }
      owner.set(param, entry.name)
    }
  }
}

/** @internal — the seam behind `createSearchStore` and `createLocalStore`. */
export function createStoreCore(o: StoreCoreOptions): StoreCore {
  const version = o.version ?? 1
  const legacy = o.legacyValueField
  const entries: StoreEntry[] = Object.entries(o.fields).map(([name, f]) => ({
    name,
    codec: resolveFieldCodec(name, f, { legacyMultiEmpty: legacy !== undefined }),
  }))
  assertNoParamCollision(o.key, entries)
  const urlEntries = entries.filter((entry) => entry.codec.lane.url)
  const anyPersisted = entries.some((entry) => entry.codec.lane.persist)
  const labels = new Map<string, Record<string, string>>()

  // ONE localStorage entry per store, holding a `{ fieldName: value }` record — so every field of
  // a store costs exactly one hook (`react/rules-of-hooks` forbids a per-field hook in a loop) and
  // `useReset` can write every field in one go.
  const usePersistedRaw = createPersistedState<unknown>({ key: o.key, version, initial: null })
  const memory = createMemoryLane()

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

  const clearField = (name: string): void => {
    const record = readRecord()
    if (!Object.hasOwn(record, name)) return
    const next = { ...record }
    delete next[name]
    writePersistedValue(o.key, version, fromRecord(next))
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

  const handle = (entry: StoreEntry, use: FieldUse, clear: () => void): FieldHandle<AnyField> => {
    const { codec } = entry
    const built: Record<string, unknown> = {
      kind: codec.kind,
      use,
      clear,
      isDefault: (v: unknown) => codec.equals(v, codec.fallback),
    }
    if (codec.kind === 'range') {
      built['toWindow'] = (v: RangeValue<string>) => {
        if (v.preset === 'custom' && v.from !== undefined && v.to !== undefined) {
          return { from: v.from, to: v.to }
        }
        // `Object.hasOwn`, not a bare lookup: a preset named like an Object.prototype member
        // (`toString`) would otherwise resolve to that method and be CALLED.
        const windows = codec.windows
        if (windows !== undefined && Object.hasOwn(windows, v.preset)) {
          const resolver = windows[v.preset]
          if (resolver !== undefined) return resolver(new Date())
        }
        return { window: v.preset }
      }
    }
    if (codec.kind === 'number') {
      // Plain properties, not getters: unlike `options` (relabelled by `labels()` after the handles
      // exist) and `fallback` (possibly a thunk), a field's bounds are fixed at definition.
      const bounds = codec.bounds
      built['min'] = bounds?.min
      built['max'] = bounds?.max
      built['int'] = bounds?.int ?? false
    }
    // GETTERS, not snapshots, and installed with defineProperty rather than declared in the
    // literal: `labels()` runs on the store after the handles exist, and an object spread would
    // evaluate the getter once at spread time and freeze the unlabelled options. `fallback` is a
    // getter for the same class of reason — a lazy fallback is resolved per read, not per handle.
    Object.defineProperty(built, 'options', {
      enumerable: true,
      get: (): readonly FieldOption[] => optionsFor(entry),
    })
    Object.defineProperty(built, 'fallback', {
      enumerable: true,
      get: (): unknown => codec.fallback,
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
    memoryUse(entry) {
      return () => {
        // Subscribing to the VERSION (never to the value) is what re-renders every other mount of
        // this field when one of them writes, with no snapshot-stability trap.
        useSyncExternalStore(memory.subscribe, memory.getVersion, memory.getVersion)
        return [memory.resolve(entry), (next: unknown) => memory.write(entry.name, next)] as const
      }
    },
    readMemoryValue: (entry) => memory.resolve(entry),
    useMemoryVersion: () =>
      useSyncExternalStore(memory.subscribe, memory.getVersion, memory.getVersion),
    resetMemory: () => memory.clear(),
    clearField,
    clearMemory: (name) => memory.remove(name),
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

/** `Pick<SearchStore<S>, 'field' | 'readStored' | 'labels'>` — the same handles, no router. */
export type LocalStore<S extends Record<string, AnyField>> = {
  readonly field: { [K in keyof S]: FieldHandle<S[K]> }
  readStored: () => Partial<StoredValues<S>>
  /**
   * Option labels for enum / multi / range fields — the same chainable contract
   * `createSearchStore` has, so `SelectFilter`/`ViewTabs` read their option labels off a local
   * store too. Call it once, at definition.
   */
  labels: (map: Partial<{ [K in keyof S]: Record<string, string> }>) => LocalStore<S>
}

/**
 * A store with no URL lane and no router import: per-chart selects, a section's view tab, a compact
 * toggle. Same `field.*` vocabulary and the same `FieldHandle` every basalt control binds to, so a
 * control cannot tell the two stores apart — which is the point, and why the local lane is not an
 * excuse to reach for `useState` (C3).
 *
 * A field's `url` lane is ignored here (there is no URL to write); `persist: false` is the
 * IN-MEMORY lane — shared across mounts for the session, gone on reload, never in localStorage.
 * That is the honest home for a value a reader should not be handed back tomorrow (a scratch
 * comparison, a temporary drill-down) without dropping to `useState` and losing the handle.
 *
 * A fallback may be a THUNK (`field.string({ fallback: () => todayIso() })`) — resolved at read
 * time, re-resolved while nothing is written, and never persisted on its own. Every lane here
 * qualifies; `createSearchStore` allows it off the URL lane only, and throws otherwise.
 *
 * @example
 * const chart = createLocalStore({
 *   key: 'momentum-chart',
 *   fields: {
 *     metric: field.enum(['load', 'volume'], 'load'),
 *     zoomed: field.boolean(false, { persist: false }), // in-memory, this session only
 *   },
 * }).labels({ metric: { load: 'Load', volume: 'Volume' } })
 * // <SelectFilter field={chart.field.metric} label="Metric" />
 */
export function createLocalStore<const S extends Record<string, AnyField>>(o: {
  key: string
  fields: S
  version?: number
}): LocalStore<S> {
  const core = createStoreCore({ key: o.key, fields: o.fields, version: o.version })

  const persistedUse = (entry: StoreEntry) => (): readonly [unknown, (next: unknown) => void] => {
    const [record, setRecord] = core.usePersistedRecord()
    return [
      core.resolve(entry, null, record),
      (next: unknown) => core.writeField(setRecord, entry.name, next),
    ] as const
  }

  const field = {} as { [K in keyof S]: FieldHandle<S[K]> }
  for (const entry of core.entries) {
    const persisted = entry.codec.lane.persist
    const use = persisted ? persistedUse(entry) : core.memoryUse(entry)
    const clear = persisted ? () => core.clearField(entry.name) : () => core.clearMemory(entry.name)
    field[entry.name as keyof S] = core.handle(entry, use, clear) as unknown as FieldHandle<
      S[keyof S]
    >
  }

  const store: LocalStore<S> = {
    field,
    readStored: () => core.readStoredFlat() as Partial<StoredValues<S>>,
    labels: (map) => {
      core.setLabels(map as Record<string, Record<string, string> | undefined>)
      return store
    },
  }

  return store
}
