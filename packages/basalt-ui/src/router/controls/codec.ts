/**
 * Field codecs: raw search in, native values out. A codec decodes from ANY raw form the router may
 * hand it and never touches the router's own codec (concept 1.3): the default JSON parser turns
 * `?item=123` into a number and `?a=x,y` stays a string, a string-only `parseSearchWith((v) => v)`
 * still sees `128`, `true` and `false` as a number and booleans (Router's `qss` decode), and either
 * may meet a hand-typed URL. Writes emit native values; the app's `stringifySearch` renders them.
 *
 * A codec is shared BY REFERENCE between the field spec and its handle, never spread: a spread
 * would copy a snapshot and two copies of one param's rules could drift.
 */

export type Raw = Record<string, unknown>

export type CodecKind = 'enum' | 'multi' | 'string' | 'number' | 'boolean' | 'range' | 'composite'

/**
 * One field's URL rules. Methods take the field's key because a spec is built before it is placed
 * in a store (`fields: { q: field.string('') }`): the key names the param.
 */
export interface Codec<V> {
  readonly kind: CodecKind
  /** Every URL param the field owns under `key`. */
  params(key: string): readonly string[]
  /** Raw search to the field's value; `undefined` when nothing valid is there. */
  decode(key: string, search: Raw): V | undefined
  /** Value to native params, complete: the validated-search form. */
  encode(key: string, value: V): Raw
  equals(a: V, b: V): boolean
}

/** A plain decimal: no blank, whitespace, hex or exponent (`Number(' ')` is `0`, `Number('0x10')` 16). */
export const NUMERIC_RE = /^-?\d+(\.\d+)?$/

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/

const isScalar = (raw: unknown): raw is string | number | boolean =>
  typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean'

/** A real calendar day: `2025-13-40` matches the pattern and is refused here. */
export const isIsoDay = (raw: unknown): raw is string => {
  if (typeof raw !== 'string' || !ISO_DAY_RE.test(raw)) return false
  const date = new Date(`${raw}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(raw)
}

const same = <V>(a: V, b: V): boolean => Object.is(a, b)

const sameList = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((entry, i) => entry === b[i])

/** The codec of every kind that owns exactly one param, named by the field key. */
function single<V>(
  kind: CodecKind,
  decodeOne: (raw: unknown) => V | undefined,
  equals: (a: V, b: V) => boolean = same,
): Codec<V> {
  return {
    kind,
    params: (key) => [key],
    decode: (key, search) => decodeOne(search[key]),
    encode: (key, value) => ({ [key]: value }),
    equals,
  }
}

/** An alias map is read with `Object.hasOwn`, so `constructor` or `__proto__` never resolve. */
export function enumCodec<V extends string>(
  values: readonly V[],
  aliases: Readonly<Record<string, V>> | undefined,
): Codec<V> {
  return single('enum', (raw) => {
    if (!isScalar(raw)) return undefined
    const text = String(raw)
    const target = aliases !== undefined && Object.hasOwn(aliases, text) ? aliases[text] : text
    return values.find((value) => value === target)
  })
}

export function stringCodec(max: number | undefined): Codec<string> {
  return single('string', (raw) => {
    if (!isScalar(raw)) return undefined
    const text = String(raw)
    return max === undefined ? text : text.slice(0, max)
  })
}

export type NumberBounds = {
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly int: boolean
  readonly step?: number | undefined
}

export function numberCodec(bounds: NumberBounds): Codec<number> {
  return single('number', (raw) => {
    const value =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string' && NUMERIC_RE.test(raw)
          ? Number(raw)
          : Number.NaN
    if (!Number.isFinite(value)) return undefined
    if (bounds.int && !Number.isInteger(value)) return undefined
    return Math.min(bounds.max ?? Infinity, Math.max(bounds.min ?? -Infinity, value))
  })
}

export function booleanCodec(): Codec<boolean> {
  return single('boolean', (raw) => {
    if (raw === true || raw === 'true' || raw === '1' || raw === 1) return true
    if (raw === false || raw === 'false' || raw === '0' || raw === 0) return false
    return undefined
  })
}

/**
 * Any-of over a closed list, decoded to the known members in canonical order. An array, a comma
 * string or a lone scalar all decode (the router turns `?levels=1` into the number `1`). An explicit
 * empty value (`[]`, `''`) is the empty selection, distinct from an absent param; a value naming no
 * known member is invalid and falls back.
 */
export function multiCodec<V extends string>(values: readonly V[]): Codec<readonly V[]> {
  return single(
    'multi',
    (raw) => {
      const parts: readonly unknown[] | undefined = Array.isArray(raw)
        ? raw
        : typeof raw === 'string'
          ? raw === ''
            ? []
            : raw.split(',')
          : isScalar(raw)
            ? [raw]
            : undefined
      if (parts === undefined) return undefined
      if (parts.length === 0) return []
      const picked = new Set(parts.filter(isScalar).map(String))
      const known = values.filter((value) => picked.has(value))
      return known.length === 0 ? undefined : known
    },
    sameList,
  )
}

/** A range value: one preset, plus two ISO days when the preset is `'custom'`. */
export type RangeValue<P extends string = string> = {
  readonly preset: P
  readonly from?: string | undefined
  readonly to?: string | undefined
}

/** Renamed URL params of a range. Defaults: the field key, `from`, `to`. */
export type RangeParams = { readonly preset?: string; readonly from?: string; readonly to?: string }

export type RangeNames = { readonly preset: string; readonly from: string; readonly to: string }

export const rangeNames = (key: string, params: RangeParams): RangeNames => ({
  preset: params.preset ?? key,
  from: params.from ?? 'from',
  to: params.to ?? 'to',
})

const validCustom = (from: unknown, to: unknown): boolean =>
  isIsoDay(from) && isIsoDay(to) && from <= to

/**
 * Three params (`?range=7d`, or `?range=custom&from=2025-01-01&to=2025-01-31`). A custom range is
 * valid only with both ends, real days, in order; anything else decodes as invalid.
 */
export function rangeCodec<P extends string>(o: {
  presets: readonly P[]
  custom: boolean
  params: RangeParams
}): Codec<RangeValue<P | 'custom'>> {
  return {
    kind: 'range',
    params: (key) => Object.values(rangeNames(key, o.params)),
    decode: (key, search) => {
      const names = rangeNames(key, o.params)
      const raw = search[names.preset]
      if (!isScalar(raw)) return undefined
      const preset = String(raw)
      if (preset === 'custom') {
        const from = search[names.from]
        const to = search[names.to]
        if (!o.custom || !validCustom(from, to)) return undefined
        return { preset: 'custom', from: from as string, to: to as string }
      }
      const known = o.presets.find((p) => p === preset)
      return known === undefined ? undefined : { preset: known }
    },
    encode: (key, value) => {
      const names = rangeNames(key, o.params)
      const custom = value.preset === 'custom'
      return {
        [names.preset]: value.preset,
        [names.from]: custom ? value.from : undefined,
        [names.to]: custom ? value.to : undefined,
      }
    },
    equals: (a, b) => a.preset === b.preset && a.from === b.from && a.to === b.to,
  }
}

/** Whether a range value may be written: a preset always, a custom range only when complete. */
export const writableRange = (value: RangeValue): boolean =>
  value.preset !== 'custom' || validCustom(value.from, value.to)
