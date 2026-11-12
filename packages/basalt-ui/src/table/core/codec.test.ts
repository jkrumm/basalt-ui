/**
 * The URL grammar v1: `parse(serialize(s)) = s` over generated states, golden URLs, and the named
 * fixtures of the concept's proof section (tablecn #1257 and #1268, the Bazza Date case).
 */
import { describe, expect, test } from 'bun:test'
import { MAX_PAGE_SIZE, normalizeState, tableCodec } from './codec'
import type { Raw } from './codec'
import { codec } from './kinds-codec'
import { createState } from './state'
import type { FilterModel, TableState } from '../contract'

const schema = codec(
  { payee: 'entity', note: 'text', state: 'status', amount: 'money', at: 'date', trend: 'spark' },
  { defaults: { sort: [{ id: 'at', desc: true }] } },
)
const warnings: string[] = []
const url = tableCodec(schema, { warn: (m) => warnings.push(m) })

const FILTERABLE = ['payee', 'note', 'state'] as const
const OPS = { payee: 'contains', note: 'contains', state: 'anyOf' } as const

/** Mulberry32: a seeded generator, so a failing state reproduces from its seed. */
function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const POOL = [
  'a',
  'todo',
  'a,b',
  ',',
  ',,',
  'a\\',
  '\\,',
  '\\\\',
  '007',
  '1e3',
  '123',
  '-0',
  'true',
  'null',
  '2025-01-15',
  '2025-01-15T00:00:00.000Z',
  ' spaced ',
  'ünï€',
  '[1,2]',
  '{"a":1}',
  '%20',
  'a&b=c',
  'x.desc',
  'f.state',
  '',
]
const ALPHABET = 'ab,\\. 09-'

function pickString(rand: () => number): string {
  if (rand() < 0.6) return POOL[Math.floor(rand() * POOL.length)] as string
  let out = ''
  for (let i = Math.floor(rand() * 6); i > 0; i--)
    out += ALPHABET[Math.floor(rand() * ALPHABET.length)]
  return out
}

function generate(rand: () => number): TableState {
  const filters: FilterModel[] = []
  for (const id of FILTERABLE) {
    if (rand() < 0.5) continue
    const values = Array.from({ length: Math.floor(rand() * 4) }, () => pickString(rand))
    filters.push({ id, op: OPS[id], values })
  }
  const sortIds = ['payee', 'amount', 'at']
  const sort =
    rand() < 0.3
      ? []
      : [{ id: sortIds[Math.floor(rand() * sortIds.length)] as string, desc: rand() < 0.5 }]
  const state = createState(schema.defaults)
  return {
    ...state,
    request: {
      q: rand() < 0.4 ? '' : pickString(rand),
      filters,
      sort,
      page: 1 + Math.floor(rand() * rand() * 40),
      pageSize: rand() < 0.5 ? 25 : 1 + Math.floor(rand() * 200),
    },
  }
}

/** A state already in normal form: what the property says round-trips as itself. */
const isCanonical = (s: TableState): boolean =>
  JSON.stringify(normalizeState(schema, s)) === JSON.stringify(s)

/** What TanStack Router's default `stringifySearch` and `parseSearch` do to a value. */
function throughRouter(raw: Raw): Raw {
  const out: Raw = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue
    let text: string
    if (typeof v === 'string') {
      let quote = false
      try {
        quote = typeof JSON.parse(v) !== 'string'
      } catch {
        // not JSON: the router prints it raw
      }
      text = quote ? JSON.stringify(v) : v
    } else {
      text = JSON.stringify(v)
    }
    try {
      out[k] = JSON.parse(text)
    } catch {
      out[k] = text
    }
  }
  return out
}

const decode = (raw: Raw): TableState | undefined => url.decode('table', raw)
const encode = (s: TableState): Raw => url.encode('table', s)
const line = (raw: Raw): string =>
  Object.entries(raw)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join('&')

describe('table codec: round trip', () => {
  test('parse(serialize(s)) = normal form of s, over 3000 generated states', () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const s = generate(rng(seed))
      const back = decode(encode(s)) ?? url.fallback
      expect({ seed, state: back }).toEqual({ seed, state: normalizeState(schema, s) })
    }
  })

  test('parse(serialize(s)) = s for canonical states', () => {
    let seen = 0
    for (let seed = 1; seed <= 3000; seed++) {
      const s = generate(rng(seed))
      if (!isCanonical(s)) continue
      seen++
      expect({ seed, state: decode(encode(s)) ?? url.fallback }).toEqual({ seed, state: s })
    }
    expect(seen).toBeGreaterThan(100)
  })

  test('it survives the router: JSON-parsed numbers, booleans and quoted strings', () => {
    for (let seed = 1; seed <= 3000; seed++) {
      const s = generate(rng(seed + 10_000))
      if (JSON.stringify(s).includes('\\"')) continue
      const back = decode(throughRouter(encode(s))) ?? url.fallback
      expect({ seed, state: back }).toEqual({ seed, state: normalizeState(schema, s) })
    }
  })

  test('the empty state is an empty URL, and an empty URL is the fallback', () => {
    expect(line(encode(url.fallback))).toBe('')
    expect(decode({})).toBeUndefined()
    expect(decode({ page: undefined })).toBeUndefined()
  })

  test('normalising is idempotent', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const once = normalizeState(schema, generate(rng(seed)))
      expect(normalizeState(schema, once)).toEqual(once)
    }
  })
})

describe('table codec: golden URLs', () => {
  const state = (patch: Partial<TableState['request']>): TableState => ({
    ...url.fallback,
    request: { ...url.fallback.request, ...patch },
  })

  test.each([
    [{}, ''],
    [{ q: 'acme' }, 'q=acme'],
    [{ sort: [{ id: 'amount', desc: false }] }, 'sort=amount.asc'],
    [{ sort: [{ id: 'at', desc: false }] }, 'sort=at.asc'],
    [{ sort: [] }, 'sort='],
    [{ page: 2, pageSize: 50 }, 'page=2&size=50'],
    [
      { filters: [{ id: 'state', op: 'anyOf' as const, values: ['todo', 'done'] }] },
      'f.state=todo,done',
    ],
    [{ filters: [{ id: 'payee', op: 'contains' as const, values: ['a,b'] }] }, 'f.payee=a\\,b'],
    [
      {
        q: 'x',
        sort: [{ id: 'payee', desc: true }],
        page: 3,
        filters: [{ id: 'note', op: 'contains' as const, values: ['n'] }],
      },
      'q=x&sort=payee.desc&page=3&f.note=n',
    ],
  ])('%j gives %s', (patch, expected) => {
    expect(line(encode(state(patch)))).toBe(expected)
  })

  test('a prefix names every param, so a second table can sit on the page', () => {
    const second = tableCodec(codec({ state: 'status' }, { prefix: 'b' }), { warn: () => {} })
    const s = second.fallback
    const raw = second.encode('table', {
      ...s,
      request: {
        ...s.request,
        q: 'x',
        page: 2,
        filters: [{ id: 'state', op: 'anyOf', values: ['a'] }],
      },
    })
    expect(line(raw)).toBe('b.q=x&b.page=2&b.f.state=a')
    expect(second.params('table')).toEqual(['b.q', 'b.sort', 'b.page', 'b.size', 'b.f.state'])
    expect(second.decode('table', { 'b.page': '2', page: '9' })?.request.page).toBe(2)
  })

  test('the owner of every param is listed, so a second table without a prefix collides loudly', () => {
    expect(url.params('table')).toEqual([
      'q',
      'sort',
      'page',
      'size',
      'f.payee',
      'f.note',
      'f.state',
    ])
  })
})

describe('table codec: normalise, never reject', () => {
  test.each([
    [{ page: 'abc' }, 1],
    [{ page: '0' }, 1],
    [{ page: -4 }, 1],
    [{ page: '2.5' }, 1],
    [{ page: 3 }, 3],
    [{ page: '3' }, 3],
  ])('page %j reads as %d', (raw, expected) => {
    expect(decode({ q: 'x', ...raw })?.request.page).toBe(expected)
  })

  test('size is capped and a bad size falls back', () => {
    expect(decode({ size: '999999' })?.request.pageSize).toBe(MAX_PAGE_SIZE)
    expect(decode({ size: 'x' })?.request.pageSize).toBe(25)
    expect(decode({ size: '0' })?.request.pageSize).toBe(25)
  })

  test('unknown and unfilterable columns are pruned and warned, the rest is kept', () => {
    warnings.length = 0
    const s = decode({ 'f.ghost': 'x', 'f.amount': '1', 'f.state': 'todo', sort: 'ghost.desc' })
    expect(s?.request.filters).toEqual([{ id: 'state', op: 'anyOf', values: ['todo'] }])
    expect(s?.request.sort).toEqual([{ id: 'at', desc: true }])
    expect(warnings.join('\n')).toContain('f.ghost')
    expect(warnings.join('\n')).toContain('f.amount')
    expect(warnings.join('\n')).toContain('"ghost"')
  })

  test('a column that cannot sort is not a sort', () => {
    expect(decode({ q: 'x', sort: 'trend.asc' })?.request.sort).toEqual([{ id: 'at', desc: true }])
  })

  test('an id that looks like a direction suffix still round-trips', () => {
    const odd = tableCodec(codec({ 'x.desc': 'number' }), { warn: () => {} })
    const s = {
      ...odd.fallback,
      request: { ...odd.fallback.request, sort: [{ id: 'x.desc', desc: false }] },
    }
    expect(odd.decode('t', odd.encode('t', s))?.request.sort).toEqual([
      { id: 'x.desc', desc: false },
    ])
  })

  test('the operator comes from the kind, never from the state or the URL', () => {
    const s = {
      ...url.fallback,
      request: {
        ...url.fallback.request,
        filters: [{ id: 'state', op: 'contains' as const, values: ['todo'] }],
      },
    }
    expect(decode(encode(s))?.request.filters[0]?.op).toBe('anyOf')
  })

  test('display is not in the URL', () => {
    const s = { ...url.fallback, display: { visibility: { note: false } } }
    expect(Object.keys(encode(s)).some((k) => k.includes('visib'))).toBe(false)
    expect(decode({ q: 'x' })?.display).toEqual({ visibility: {} })
  })

  test('equals ignores display and non-canonical spellings', () => {
    const a = { ...url.fallback, display: { visibility: { note: false } } }
    expect(url.equals(a, url.fallback)).toBe(true)
    const b = { ...url.fallback, request: { ...url.fallback.request, page: 2 } }
    expect(url.equals(b, url.fallback)).toBe(false)
  })

  test('defaults the grammar cannot express are refused at definition', () => {
    expect(() => tableCodec(codec({ state: 'status' }, { defaults: { q: 'x' } }))).toThrow(/"q"/)
    expect(() =>
      tableCodec(
        codec(
          { state: 'status' },
          { defaults: { filters: [{ id: 'state', op: 'anyOf', values: ['a'] }] } },
        ),
      ),
    ).toThrow(/"filters"/)
    // a default equal to the fallback is no default
    expect(() =>
      tableCodec(codec({ state: 'status' }, { defaults: { filters: [], q: '', page: 1 } })),
    ).not.toThrow()
  })
})

describe('table codec: named fixtures', () => {
  // tablecn #1257: a filter operator was lost on reload. Here the operator is the kind's, so a
  // single-value enum filter stays `anyOf` and a text filter stays `contains`.
  test('#1257 the operator survives a reload', () => {
    const s: TableState = {
      ...url.fallback,
      request: {
        ...url.fallback.request,
        filters: [
          { id: 'payee', op: 'contains', values: ['acme'] },
          { id: 'state', op: 'anyOf', values: ['todo'] },
        ],
      },
    }
    expect(decode(throughRouter(encode(s)))?.request.filters).toEqual(s.request.filters)
  })

  // tablecn #1268: the router parses `?f.payee=456&page=3&q=true` into numbers and booleans, and
  // the nuqs adapter crashed on them. Every scalar form decodes to the text it prints as.
  test('#1268 router-parsed numbers and booleans decode as text, without a crash', () => {
    const s = decode({ page: 3, q: 123, 'f.payee': 456, 'f.state': true, size: 50 })
    expect(s?.request).toEqual({
      q: '123',
      filters: [
        { id: 'payee', op: 'contains', values: ['456'] },
        { id: 'state', op: 'anyOf', values: ['true'] },
      ],
      sort: [{ id: 'at', desc: true }],
      page: 3,
      pageSize: 50,
    })
    expect(decode({ q: 'x', 'f.state': ['a', 'b,c'] })?.request.filters[0]?.values).toEqual([
      'a',
      'b,c',
    ])
    expect(decode({ q: null, 'f.state': { a: 1 }, sort: [1] })?.request.q).toBe('')
  })

  // Bazza data-table-filter revived date strings into `Date` objects on read, so a reload changed
  // the value's type. Here a value is text before and after, and a revived `Date` is stored as
  // the ISO text it prints as.
  test('Bazza Date: a date-looking value stays text and never becomes a Date', () => {
    const values = ['2025-01-15', '2025-01-15T00:00:00.000Z', '2025-01-15T10:30:00+02:00']
    const s: TableState = {
      ...url.fallback,
      request: { ...url.fallback.request, filters: [{ id: 'note', op: 'contains', values }] },
    }
    const back = decode(throughRouter(encode(s)))
    expect(back?.request.filters[0]?.values).toEqual(values)
    expect(back?.request.filters[0]?.values.every((v) => typeof v === 'string')).toBe(true)
    const revived = decode({ 'f.note': new Date('2025-01-15T00:00:00.000Z') })
    expect(revived?.request.filters[0]?.values).toEqual(['2025-01-15T00:00:00.000Z'])
  })

  test('numeric-looking and reserved-looking strings keep their spelling', () => {
    const values = ['007', '1e3', '0x10', '-0', 'true', 'null', '1,5']
    const s: TableState = {
      ...url.fallback,
      request: {
        ...url.fallback.request,
        q: '1e3',
        filters: [{ id: 'note', op: 'contains', values }],
      },
    }
    const back = decode(throughRouter(encode(s)))
    expect(back?.request.q).toBe('1e3')
    expect(back?.request.filters[0]?.values).toEqual(values)
  })
})
