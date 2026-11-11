/**
 * The field vocabulary of `defineControls`. Every builder returns plain declarative data plus its
 * codec; no router, no storage. Lanes are declared once, here: a URL field (`url` omitted or true)
 * takes `history`; a device field (`url: false`) takes `persist` (default true, `basalt:<store id>`)
 * and may have a thunk fallback, which a URL field may not (`defineControls` throws).
 */
import { booleanCodec, enumCodec, multiCodec, numberCodec, rangeCodec, stringCodec } from './codec'
import type { Codec, CodecKind, NumberBounds, RangeParams, RangeValue } from './codec'

export type History = 'replace' | 'push'

/** Lane options. `persist` exists on `url: false` fields only (URL-field persist was removed). */
export type LaneOptions =
  | { readonly url?: true; readonly history?: History }
  | { readonly url: false; readonly persist?: boolean }

export type ResolvedLane = {
  readonly url: boolean
  readonly persist: boolean
  readonly history: History
}

/** A value, or a thunk resolved per read: `url: false` fields only. */
export type Fallback<V> = V | (() => V)

/** Whether a lane option set keeps the field on the URL. */
export type UrlOf<L> = L extends { readonly url: false } ? false : true

/** One option of an enum, multi or range field; labels come from `.labels()`. */
export type FieldOption<V = string> = { readonly value: V; readonly label: string }

/**
 * A field definition. `U` is whether it lives in the URL, `S` the params it adds to the route's
 * search, keyed later by the field's name (see `ParamsOf` in `define`).
 */
export interface FieldSpec<V, K extends CodecKind = CodecKind, U extends boolean = boolean> {
  readonly kind: K
  /** Shared with the handle by reference; never spread. */
  readonly codec: Codec<V>
  readonly fallback: Fallback<V>
  readonly lane: ResolvedLane & { readonly url: U }
  /** The closed values behind `options` (enum, multi, range); empty for the open kinds. */
  readonly values: readonly string[]
  readonly labelMap: Readonly<Record<string, string>> | undefined
  /** `number` only: the clamp and grain a stepper or slider bound to the field uses. */
  readonly bounds?: NumberBounds | undefined
}

/** A field with closed values: `.labels({ value: 'Label' })` names its options at definition. */
export type Labelled<X> = X & {
  labels(map: Readonly<Record<string, string>>): Labelled<X>
}

export interface RangeSpec<
  P extends string,
  C extends boolean,
  Pm extends RangeParams,
  W extends string,
  U extends boolean,
> extends FieldSpec<RangeValue<RangePresets<P, C>>, 'range', U> {
  readonly presets: readonly P[]
  readonly custom: C
  readonly params: Pm
  readonly windows: RangeWindows<W>
}

/** The presets a range value ranges over: the declared ones, plus `'custom'` when allowed. */
export type RangePresets<P extends string, C extends boolean> =
  | P
  | (C extends false ? never : 'custom')

/** Resolves a derived preset (`3m`, `ytd`) to ISO days at call time. */
export type RangeWindow = (now: Date) => { readonly from: string; readonly to: string }
export type RangeWindows<W extends string> = Partial<Record<W, RangeWindow>>

export type RangeOptions<P extends string, C extends boolean, Pm extends RangeParams, W> = {
  readonly presets: readonly P[]
  readonly fallback: NoInfer<P>
  /** `true` allows the preset `'custom'` with `from` and `to` ISO days. */
  readonly custom?: C
  /** Renamed params: `{ preset: 'window' }` writes `?window=7d`. */
  readonly params?: Pm
  /** Presets `toWindow()` resolves to `{ from, to }` at call time. */
  readonly window?: { readonly [k in W & string]: RangeWindow }
}

/** A table's or a composite control's state carried by an app codec (data-table E2). */
export type CompositeCodec<V> = Codec<V> & { readonly fallback: V }

const resolveLane = (lane: LaneOptions | undefined): ResolvedLane => {
  const local = lane?.url === false
  return {
    url: !local,
    persist: local && (lane as { persist?: boolean }).persist !== false,
    history:
      !local && (lane as { history?: History } | undefined)?.history === 'push'
        ? 'push'
        : 'replace',
  }
}

/** `persist` on a URL field is a 2.x shape the v3 lanes dropped; refused rather than ignored. */
const assertLane = (lane: object | undefined): void => {
  if (lane === undefined || (lane as { url?: unknown }).url === false) return
  if ('persist' in lane) {
    throw new Error(
      'basalt-ui: `persist` is a `url: false` lane option; a URL field is remembered by its link, ' +
        'not by storage (concept 4.5). Drop `persist`, or move the field off the URL.',
    )
  }
}

function spec<V, K extends CodecKind, U extends boolean>(
  kind: K,
  codec: Codec<V>,
  fallback: Fallback<V>,
  lane: LaneOptions | undefined,
  extra: {
    values?: readonly string[]
    bounds?: NumberBounds
    labelMap?: Record<string, string>
  } = {},
): FieldSpec<V, K, U> {
  assertLane(lane)
  return {
    kind,
    codec,
    fallback,
    lane: resolveLane(lane) as ResolvedLane & { url: U },
    values: extra.values ?? [],
    labelMap: extra.labelMap,
    bounds: extra.bounds,
  }
}

/** Adds `.labels()`: a copy with the label map, sharing the same codec object. */
function labelled<X extends { readonly labelMap: Readonly<Record<string, string>> | undefined }>(
  base: X,
): Labelled<X> {
  const out = {
    ...base,
    labels: (map: Readonly<Record<string, string>>) =>
      labelled({ ...base, labelMap: { ...base.labelMap, ...map } }),
  }
  return out as Labelled<X>
}

type EnumOptions<V extends string> = {
  /** Raw strings mapped to a member before decoding: `{ day: '24h' }`, a rename `{ sync: 'storage' }`. */
  readonly aliases?: Readonly<Record<string, NoInfer<V>>>
}

/**
 * Field builders for `defineControls({ fields })`. The key of each field is its URL param.
 *
 * Documented in `docs/define-controls.md`: `docs/field.md` is the `ui/field` primitive's, so this
 * export carries no `@useWhen`/`@neverWhen` and sits in the gen-docs baseline.
 *
 * @example
 * ```ts
 * export const overview = defineControls({
 *   id: 'overview',
 *   scope: 'page',
 *   fields: {
 *     range: field.enum(['1h', '24h', '7d'], '24h', { aliases: { day: '24h' } }).labels({ '24h': 'Last 24 h' }),
 *     regions: field.multi(['eu', 'us', 'ap'], []),
 *     q: field.string('', { max: 120 }),
 *     page: field.number({ fallback: 0, min: 0, int: true }),
 *     compact: field.boolean(false, { url: false }),
 *     window: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }),
 *   },
 * })
 * ```
 */
export const field = {
  /** A closed choice: a tab, a compare mode, a single-select filter. */
  enum<const V extends string, const L extends LaneOptions = {}>(
    values: readonly V[],
    fallback: Fallback<NoInfer<V>>,
    options?: EnumOptions<V> & L,
  ): Labelled<FieldSpec<V, 'enum', UrlOf<L>>> {
    return labelled(
      spec('enum', enumCodec(values, options?.aliases), fallback, options, { values }),
    )
  },

  /** Any-of over a closed list. Empty is "all" unless the fallback is the full list (then `[]` is written). */
  multi<const V extends string, const L extends LaneOptions = {}>(
    values: readonly V[],
    fallback: Fallback<readonly NoInfer<V>[]> = [],
    lane?: L,
  ): Labelled<FieldSpec<readonly V[], 'multi', UrlOf<L>>> {
    const canonical =
      typeof fallback === 'function'
        ? fallback
        : values.filter((value) => (fallback as readonly string[]).includes(value))
    return labelled(spec('multi', multiCodec(values), canonical, lane, { values }))
  },

  /** Free text: a search box. `max` truncates. */
  string<const L extends LaneOptions = {}>(
    fallback: Fallback<string>,
    options?: { readonly max?: number } & L,
  ): FieldSpec<string, 'string', UrlOf<L>> {
    return spec('string', stringCodec(options?.max), fallback, options)
  },

  /** A number. Out-of-range input clamps; `int` refuses a decimal; `step` defaults to 1 for `int`. */
  number<const L extends LaneOptions = {}>(
    o: {
      readonly fallback: Fallback<number>
      readonly min?: number
      readonly max?: number
      readonly int?: boolean
      readonly step?: number
    },
    lane?: L,
  ): Labelled<FieldSpec<number, 'number', UrlOf<L>>> {
    const bounds: NumberBounds = {
      min: o.min,
      max: o.max,
      int: o.int === true,
      step: o.step ?? (o.int === true ? 1 : undefined),
    }
    return labelled(spec('number', numberCodec(bounds), o.fallback, lane, { bounds }))
  },

  /** A toggle. Reads `true`, `'true'`, `'1'`, `1` and their false forms. */
  boolean<const L extends LaneOptions = {}>(
    fallback: Fallback<boolean>,
    lane?: L,
  ): FieldSpec<boolean, 'boolean', UrlOf<L>> {
    return spec('boolean', booleanCodec(), fallback, lane)
  },

  /**
   * A date window over three params. The handle's `toWindow(value)` gives `{ window }` for a preset
   * and `{ from, to }` for a custom range or a preset with a `window` resolver.
   */
  range<
    const P extends string,
    const C extends boolean = false,
    const Pm extends RangeParams = {},
    const W extends P = never,
    const L extends LaneOptions = {},
  >(o: RangeOptions<P, C, Pm, W>, lane?: L): Labelled<RangeSpec<P, C, Pm, W, UrlOf<L>>> {
    const custom = (o.custom ?? false) as C
    const params = (o.params ?? {}) as Pm
    const values = custom ? [...o.presets, 'custom'] : [...o.presets]
    const base = spec<RangeValue<RangePresets<P, C>>, 'range', UrlOf<L>>(
      'range',
      rangeCodec({ presets: o.presets, custom, params }) as Codec<RangeValue<RangePresets<P, C>>>,
      { preset: o.fallback },
      lane,
      { values },
    )
    const windows = (o.window ?? {}) as RangeWindows<W>
    return labelled({ ...base, presets: o.presets, custom, params, windows })
  },

  /** A whole state object (a table's sort, page and filters) carried by an app codec. */
  composite<V, const L extends LaneOptions = {}>(
    codec: CompositeCodec<V>,
    lane?: L,
  ): FieldSpec<V, 'composite', UrlOf<L>> {
    return spec('composite', codec, codec.fallback, lane)
  },
}

/** Any field spec, for constraints. */
export type AnyFieldSpec = FieldSpec<unknown>
