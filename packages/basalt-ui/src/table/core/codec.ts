/**
 * The URL grammar of the table state, v1 (docs/v3/concepts/data-table.md section 6). Frozen per
 * major, so it holds only what a consumer backs. `tableCodec(schema)` is a composite codec in the
 * structural shape `field.composite` takes, so a route carries a table as one field.
 *
 * | Param            | Example                         | Rule                                         |
 * |-|-|-|
 * | `q`              | `q=acme`                        | free text                                    |
 * | `f.<col>`        | `f.state=todo,done`             | text or enum column; `\,` and `\\` escape    |
 * | `sort`           | `sort=at.desc`                  | one entry; a direction suffix always written |
 * | `page`, `size`   | `page=2&size=50`                | 1-based                                      |
 * | prefix           | `prefix: 'b'` gives `b.sort`    | a second table on a page                     |
 *
 * Law:
 * - Normalise, never reject. Anything the grammar cannot read is dropped (unknown or unfilterable
 *   columns, a page of `abc`, empty values) and the rest is kept. Unknown ids warn in development.
 * - Defaults are absent. A default sort that the user cleared is the empty `sort=`.
 * - A value is a string. The router JSON-parses `?f.id=123` to a number and `?q=true` to a boolean;
 *   a scalar of any of those forms decodes to the string it prints as. Values are never revived:
 *   `2025-01-15T00:00:00Z` stays the text it is (a date filter is text, not a `Date`).
 * - The operator comes from the column's kind, never from the URL, so a one-value `anyOf` filter
 *   is still `anyOf` after a reload.
 * - `display` is not in the URL (it is a device lane); a decoded state carries an empty one.
 * - `encode` is complete: every owned param is a key, `undefined` for an absent one, because the
 *   router only unsets a param written as `undefined`.
 */
import type { FilterModel, TableRequest, TableState } from '../contract'
import { usableValues } from './filters'
import type { FilterOp } from './filters'
import { createState, sameRequest } from './state'
import { KIND_DEFAULTS } from './kinds-spec'
import type { TableSchema } from './kinds-codec'

export type Raw = Record<string, unknown>

/** Structurally a router `CompositeCodec<TableState>`; this module imports nothing from the router. */
export type TableCodec = {
  readonly kind: 'composite'
  readonly fallback: TableState
  params(key: string): readonly string[]
  decode(key: string, search: Raw): TableState | undefined
  encode(key: string, value: TableState): Raw
  equals(a: TableState, b: TableState): boolean
}

export type TableCodecOptions = {
  /** Receives a development warning (an unknown column id in the URL). @default console.warn */
  warn?: (message: string) => void
}

/** Pages are capped so a hand-typed `size=999999` cannot ask a server for everything. */
export const MAX_PAGE_SIZE = 1000

/** The operator of a column's kind, `null` for a kind that has no `f.<col>` in v1. */
export function filterOpOf(kind: string): FilterOp | null {
  if (kind === 'entity' || kind === 'text') return 'contains'
  if (kind === 'status') return 'anyOf'
  return null
}

const sortable = (kind: string): boolean =>
  Object.hasOwn(KIND_DEFAULTS, kind) &&
  KIND_DEFAULTS[kind as keyof typeof KIND_DEFAULTS].sort !== null

// ---- Scalars and lists --------------------------------------------------------------------

/** A raw value as the string it prints as; `undefined` for anything that is not a scalar. */
function scalar(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw)
  if (typeof raw === 'boolean' || typeof raw === 'bigint') return String(raw)
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw.toISOString()
  return undefined
}

/** A non-negative integer in any scalar form (`3`, `'3'`); anything else is `undefined`. */
function wholeNumber(raw: unknown): number | undefined {
  const text = scalar(raw)?.trim()
  return text !== undefined && /^\d+$/.test(text) ? Number(text) : undefined
}

const escapeValue = (value: string): string => value.replace(/[\\,]/g, '\\$&')

/** `a,b\,c` to `['a', 'b,c']`: a backslash escapes the next character, a lone trailing one is literal. */
function splitList(text: string): string[] {
  const out: string[] = []
  let current = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string
    if (ch === '\\' && i + 1 < text.length) {
      current += text[++i]
    } else if (ch === ',') {
      out.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  out.push(current)
  return out
}

/** The value list of a raw param: one escaped string, or an array the router parsed. */
function listOf(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.flatMap((entry) => scalar(entry) ?? [])
  const text = scalar(raw)
  return text === undefined ? [] : splitList(text)
}

const unique = (values: readonly string[]): string[] => [...new Set(values)]

// ---- Normal form --------------------------------------------------------------------------

type Names = { q: string; sort: string; page: string; size: string; filter: (id: string) => string }

function namesOf(prefix: string | undefined): Names {
  const at = (p: string): string => (prefix ? `${prefix}.${p}` : p)
  return {
    q: at('q'),
    sort: at('sort'),
    page: at('page'),
    size: at('size'),
    filter: (id) => at(`f.${id}`),
  }
}

/**
 * The canonical request of a schema: filters in schema order with the kind's operator and
 * deduplicated non-empty values, at most one sort entry on a sortable column, page >= 1, size in
 * 1..`MAX_PAGE_SIZE`. `decode(encode(x))` equals `normalizeState(x)` for every `x`.
 */
export function normalizeState(schema: TableSchema, state: TableState): TableState {
  const r = state.request
  const filters: FilterModel[] = []
  for (const [id, kind] of Object.entries(schema.kinds)) {
    const op = filterOpOf(kind)
    const model = r.filters.findLast((f) => f.id === id)
    if (op === null || model === undefined) continue
    const values = unique(usableValues(model.values))
    if (values.length > 0) filters.push({ id, op, values })
  }
  const first = r.sort.find(
    (s) => Object.hasOwn(schema.kinds, s.id) && sortable(schema.kinds[s.id] as string),
  )
  const page = Number.isFinite(r.page) ? Math.max(1, Math.trunc(r.page)) : 1
  const size = Number.isFinite(r.pageSize) ? Math.trunc(r.pageSize) : 0
  const request: TableRequest = {
    q: r.q,
    filters,
    sort: first === undefined ? [] : [{ id: first.id, desc: first.desc }],
    page,
    pageSize:
      size >= 1
        ? Math.min(size, MAX_PAGE_SIZE)
        : (schema.defaults.pageSize ?? createState().request.pageSize),
  }
  return { ...state, request }
}

const sortText = (s: { id: string; desc: boolean }): string => `${s.id}.${s.desc ? 'desc' : 'asc'}`

// ---- The codec ----------------------------------------------------------------------------

export function tableCodec(schema: TableSchema, options?: TableCodecOptions): TableCodec {
  if (process.env.NODE_ENV !== 'production') {
    for (const key of ['q', 'filters', 'page'] as const) {
      if (
        schema.defaults[key] !== undefined &&
        JSON.stringify(schema.defaults[key]) !== JSON.stringify(createState().request[key])
      ) {
        throw new Error(
          `basalt-ui/table: c.codec default "${key}" is not part of URL grammar v1 (defaults: sort, pageSize)`,
        )
      }
    }
  }
  const warn =
    options?.warn ??
    ((message: string): void => {
      if (process.env.NODE_ENV !== 'production') console.warn(message)
    })
  const names = namesOf(schema.prefix)
  const fallback = normalizeState(schema, createState(schema.defaults))
  const defaultSort = fallback.request.sort
  const filterIds = Object.entries(schema.kinds).flatMap(([id, kind]) =>
    filterOpOf(kind) === null ? [] : [id],
  )
  const owned = [names.q, names.sort, names.page, names.size, ...filterIds.map(names.filter)]

  const decodeSort = (raw: unknown): TableRequest['sort'] | undefined => {
    const text = scalar(raw)
    if (text === undefined) return undefined
    if (text === '') return []
    const match = /^(.*)\.(asc|desc)$/.exec(text)
    const id = match ? (match[1] as string) : text
    if (!Object.hasOwn(schema.kinds, id) || !sortable(schema.kinds[id] as string)) {
      warn(`basalt-ui/table: sort names "${id}", which is not a sortable column of this table`)
      return undefined
    }
    return [{ id, desc: match?.[2] === 'desc' }]
  }

  return {
    kind: 'composite',
    fallback,
    params: () => owned,
    decode(_key, search) {
      if (!owned.some((param) => search[param] !== undefined)) return undefined
      const filters: FilterModel[] = []
      for (const id of filterIds) {
        const op = filterOpOf(schema.kinds[id] as string)
        const values = unique(usableValues(listOf(search[names.filter(id)])))
        if (op !== null && values.length > 0) filters.push({ id, op, values })
      }
      const known = new Set(filterIds.map(names.filter))
      const prefix = names.filter('')
      for (const param of Object.keys(search)) {
        if (param.startsWith(prefix) && !known.has(param) && search[param] !== undefined) {
          warn(`basalt-ui/table: "${param}" is not a filterable column of this table`)
        }
      }
      return normalizeState(schema, {
        ...fallback,
        request: {
          q: scalar(search[names.q]) ?? '',
          filters,
          sort: decodeSort(search[names.sort]) ?? defaultSort,
          page: wholeNumber(search[names.page]) ?? 1,
          pageSize: wholeNumber(search[names.size]) ?? fallback.request.pageSize,
        },
      })
    },
    encode(_key, value) {
      const { request: r } = normalizeState(schema, value)
      const out: Raw = Object.fromEntries(owned.map((param) => [param, undefined]))
      if (r.q !== '') out[names.q] = r.q
      for (const f of r.filters) out[names.filter(f.id)] = f.values.map(escapeValue).join(',')
      const sameSort =
        r.sort.length === defaultSort.length &&
        r.sort.every(
          (s, i) => sortText(s) === sortText(defaultSort[i] as { id: string; desc: boolean }),
        )
      if (!sameSort) out[names.sort] = r.sort[0] === undefined ? '' : sortText(r.sort[0])
      if (r.page !== 1) out[names.page] = r.page
      if (r.pageSize !== fallback.request.pageSize) out[names.size] = r.pageSize
      return out
    },
    equals: (a, b) =>
      sameRequest(normalizeState(schema, a).request, normalizeState(schema, b).request),
  }
}
