/**
 * `createSearchStore` — the resolution law, per field kind, without a router.
 *
 * The router half (what `use()` reads, when a write navigates) lives in
 * `search-store.router.test.tsx`; this file pins the parts that run outside React: the codecs,
 * the lanes, `validateSearch`/`linkSearch`/`readStored`, and the option labels.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { field } from '../state'
import { createSearchStore, resetHydrationForTests } from './search-store'

/** Writes the store's envelope directly — one entry per store, `{ fieldName: value }`. */
function persist(key: string, record: Record<string, unknown>, version = 1): void {
  localStorage.setItem(`basalt:${key}`, JSON.stringify({ v: version, value: record }))
}

let warn: ReturnType<typeof spyOn<Console, 'warn'>>

beforeEach(() => {
  localStorage.clear()
  warn = spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  warn.mockRestore()
})

describe('field kinds — encode / decode / invalid → fallback', () => {
  test('enum: a valid URL value wins, an invalid one falls through to storage, then the fallback', () => {
    const store = createSearchStore({
      key: 'k-enum',
      fields: { range: field.enum(['1d', '7d', '30d'], '30d') },
    })
    expect(store.validateSearch({ range: '7d' })).toEqual({ range: '7d' })

    persist('k-enum', { range: '1d' })
    expect(store.validateSearch({})).toEqual({ range: '1d' })
    expect(store.validateSearch({ range: 'bogus' })).toEqual({ range: '1d' })

    localStorage.clear()
    expect(store.validateSearch({ range: 'bogus' })).toEqual({ range: '30d' })
  })

  test('multi: allowlisted, deduped, re-sorted into declaration order — and empty IS a value', () => {
    const store = createSearchStore({
      key: 'k-multi',
      fields: { tags: field.multi(['api', 'design', 'guide'], ['guide']) },
    })
    expect(store.validateSearch({ tags: ['design', 'api', 'api', 'nope'] })).toEqual({
      tags: ['api', 'design'],
    })
    // The deprecated wrapper treats `[]` as "absent"; the new store does not — a cleared
    // selection is a selection.
    expect(store.validateSearch({ tags: [] })).toEqual({ tags: [] })
    expect(store.validateSearch({ tags: 'api' })).toEqual({ tags: ['guide'] })
    expect(store.validateSearch({})).toEqual({ tags: ['guide'] })
  })

  test('range: three params, a preset, and a custom window of two ISO dates', () => {
    const store = createSearchStore({
      key: 'k-range',
      fields: { range: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }) },
    })
    expect(store.validateSearch({ range: '7d' })).toEqual({
      range: '7d',
      from: undefined,
      to: undefined,
    })
    expect(store.validateSearch({ range: 'custom', from: '2026-01-01', to: '2026-02-01' })).toEqual(
      { range: 'custom', from: '2026-01-01', to: '2026-02-01' },
    )
    // custom without both dates is not a value — it falls through to the fallback.
    expect(store.validateSearch({ range: 'custom', from: '2026-01-01' })).toEqual({
      range: '30d',
      from: undefined,
      to: undefined,
    })
    expect(store.validateSearch({ range: 'custom', from: 'yesterday', to: 'today' })).toEqual({
      range: '30d',
      from: undefined,
      to: undefined,
    })
  })

  test('range: `custom: false` rejects the custom preset outright', () => {
    const store = createSearchStore({
      key: 'k-range-nocustom',
      fields: { range: field.range({ presets: ['7d', '30d'], fallback: '7d' }) },
    })
    expect(store.validateSearch({ range: 'custom', from: '2026-01-01', to: '2026-02-01' })).toEqual(
      {
        range: '7d',
        from: undefined,
        to: undefined,
      },
    )
  })

  test('range: `params` renames all three params, so an existing deep link keeps its shape', () => {
    const store = createSearchStore({
      key: 'k-range-params',
      fields: {
        range: field.range({
          presets: ['7d', '30d'],
          fallback: '30d',
          custom: true,
          params: { preset: 'window', from: 'start', to: 'end' },
        }),
      },
    })
    expect(store.validateSearch({ window: '7d' })).toEqual({
      window: '7d',
      start: undefined,
      end: undefined,
    })
    expect(
      store.validateSearch({ window: 'custom', start: '2026-03-01', end: '2026-03-31' }),
    ).toEqual({ window: 'custom', start: '2026-03-01', end: '2026-03-31' })
  })

  test('range: two range fields sharing default `from`/`to` throws at definition, not at read time', () => {
    // Every `field.range` defaults `from`/`to` to those literal param names, so a second range
    // field in the same store would otherwise clobber the first one's dates on every
    // `validateSearch` — silently, since `flatten` just `Object.assign`s each entry's `toSearch`
    // over the last. Caught once, at store definition, instead of shipping a lost custom window.
    expect(() =>
      createSearchStore({
        key: 'k-range-collision',
        fields: {
          a: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }),
          b: field.range({ presets: ['7d', '30d'], fallback: '7d', custom: true }),
        },
      }),
    ).toThrow(/fields 'a' and 'b' both own the URL param 'from'/)
  })

  test("range: renaming one field's `params` clears the collision", () => {
    const store = createSearchStore({
      key: 'k-range-no-collision',
      fields: {
        a: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }),
        b: field.range({
          presets: ['7d', '30d'],
          fallback: '7d',
          custom: true,
          params: { preset: 'bWindow', from: 'bFrom', to: 'bTo' },
        }),
      },
    })
    expect(
      store.validateSearch({ a: 'custom', from: '2026-01-01', to: '2026-02-01', bWindow: '7d' }),
    ).toEqual({
      a: 'custom',
      from: '2026-01-01',
      to: '2026-02-01',
      bWindow: '7d',
      bFrom: undefined,
      bTo: undefined,
    })
  })

  test('number: coerces a numeric string, clamps to min/max, rejects a non-integer when int', () => {
    const store = createSearchStore({
      key: 'k-number',
      fields: { min: field.number({ fallback: 10, min: 0, max: 100, int: true }) },
    })
    expect(store.validateSearch({ min: 42 })).toEqual({ min: 42 })
    expect(store.validateSearch({ min: '42' })).toEqual({ min: 42 })
    expect(store.validateSearch({ min: 500 })).toEqual({ min: 100 })
    expect(store.validateSearch({ min: -5 })).toEqual({ min: 0 })
    expect(store.validateSearch({ min: 4.2 })).toEqual({ min: 10 })
    expect(store.validateSearch({ min: 'lots' })).toEqual({ min: 10 })
  })

  test("number: rejects '', whitespace, and hex rather than coercing them to a number", () => {
    // `Number('')`/`Number(' ')` are `0` and `Number('0x10')` is `16` — none of those strings is
    // one the codec's own `toSearch` would ever write, so a blank/hand-edited `?min=` link must
    // fall through to the fallback instead of silently becoming `0` (or `16`).
    const store = createSearchStore({
      key: 'k-number-blank',
      fields: { min: field.number({ fallback: 10 }) },
    })
    expect(store.validateSearch({ min: '' })).toEqual({ min: 10 })
    expect(store.validateSearch({ min: ' ' })).toEqual({ min: 10 })
    expect(store.validateSearch({ min: '0x10' })).toEqual({ min: 10 })
    expect(store.validateSearch({ min: '1e3' })).toEqual({ min: 10 })
    expect(store.validateSearch({ min: '42' })).toEqual({ min: 42 })
  })

  test('boolean: takes a real boolean and the two string forms a hand-typed URL carries', () => {
    const store = createSearchStore({
      key: 'k-boolean',
      fields: { compact: field.boolean(false) },
    })
    expect(store.validateSearch({ compact: true })).toEqual({ compact: true })
    expect(store.validateSearch({ compact: 'true' })).toEqual({ compact: true })
    expect(store.validateSearch({ compact: 'false' })).toEqual({ compact: false })
    expect(store.validateSearch({ compact: 'yes' })).toEqual({ compact: false })
  })

  test('string: truncates past `max`, rejects a non-string, keeps the empty string', () => {
    const store = createSearchStore({
      key: 'k-string',
      fields: { q: field.string({ max: 4 }) },
    })
    expect(store.validateSearch({ q: 'abc' })).toEqual({ q: 'abc' })
    expect(store.validateSearch({ q: 'abcdefg' })).toEqual({ q: 'abcd' })
    expect(store.validateSearch({ q: '' })).toEqual({ q: '' })
    expect(store.validateSearch({ q: 7 })).toEqual({ q: '' })
  })

  test('a stale envelope version discards the whole mirror', () => {
    const store = createSearchStore({
      key: 'k-version',
      fields: { range: field.enum(['1d', '7d'], '7d') },
      version: 2,
    })
    persist('k-version', { range: '1d' }, 1)
    expect(store.validateSearch({})).toEqual({ range: '7d' })
    expect(store.readStored()).toEqual({})
  })
})

describe('lanes', () => {
  test('a `url: false` field never appears in validateSearch or linkSearch', () => {
    const store = createSearchStore({
      key: 'k-lane-local',
      fields: {
        range: field.enum(['1d', '7d'], '7d'),
        compact: field.boolean(false, { url: false }),
      },
    })
    persist('k-lane-local', { compact: true })
    expect(store.validateSearch({})).toEqual({ range: '7d' })
    expect(store.linkSearch()).toEqual({ range: '7d' })
    // …but it IS stored, and readStored covers both lanes.
    expect(store.readStored()).toEqual({ compact: true })
  })

  test('a `persist: false` field ignores the mirror even when one exists', () => {
    const store = createSearchStore({
      key: 'k-lane-url',
      fields: { page: field.number({ fallback: 1 }, { persist: false }) },
    })
    persist('k-lane-url', { page: 9 })
    expect(store.validateSearch({})).toEqual({ page: 1 })
    expect(store.linkSearch()).toEqual({ page: 1 })
    expect(store.readStored()).toEqual({ page: 9 })
  })
})

describe('linkSearch', () => {
  test('is read at CALL time, so a definition held by reference never goes stale', () => {
    const store = createSearchStore({
      key: 'k-link',
      fields: { range: field.enum(['1d', '7d', '30d'], '30d') },
    })
    expect(store.linkSearch()).toEqual({ range: '30d' })

    persist('k-link', { range: '7d' })
    expect(store.linkSearch()).toEqual({ range: '7d' })
  })

  test('is ONE function identity, so `search: store.linkSearch` in defineNav stays stable', () => {
    const store = createSearchStore({
      key: 'k-link-identity',
      fields: { range: field.enum(['1d', '7d'], '7d') },
    })
    expect(store.linkSearch).toBe(store.linkSearch)
    expect(store.validateSearch).toBe(store.validateSearch)
  })

  test('overlays the stored values of every URL-lane field onto the fallbacks', () => {
    const store = createSearchStore({
      key: 'k-link-multi',
      fields: {
        range: field.enum(['1d', '7d'], '7d'),
        compare: field.enum(['none', 'previous'], 'none'),
      },
    })
    persist('k-link-multi', { compare: 'previous' })
    expect(store.linkSearch()).toEqual({ range: '7d', compare: 'previous' })
  })
})

const build = () =>
  createSearchStore({
    key: 'k-server-pure',
    fields: { range: field.enum(['1d', '7d', '30d'], '1d') },
  })

/** Runs `fn` as a server would: no `window` at all. */
function onServer<T>(fn: () => T): T {
  const realWindow = globalThis.window
  // @ts-expect-error -- simulating a server runtime, where `window` does not exist
  globalThis.window = undefined
  try {
    return fn()
  } finally {
    globalThis.window = realWindow
  }
}

describe('validateSearch and linkSearch on the server and a dehydrated page', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, '$_TSR')
    resetHydrationForTests()
  })

  test('are URL ⊳ fallback only — the stored layer never applies without a window', () => {
    const store = build()
    persist('k-server-pure', { range: '30d' })
    expect(store.validateSearch({})).toEqual({ range: '30d' })

    onServer(() => {
      expect(store.validateSearch({})).toEqual({ range: '1d' })
      expect(store.validateSearch({ range: '7d' })).toEqual({ range: '7d' })
      expect(store.linkSearch()).toEqual({ range: '1d' })
    })
  })

  test('are identical to the server while a dehydrated page hydrates', () => {
    const store = build()
    persist('k-server-pure', { range: '30d' })
    Object.assign(window, { $_TSR: {} })

    const hydrating = { search: store.validateSearch({}), link: store.linkSearch() }
    expect(hydrating).toEqual(
      onServer(() => ({ search: store.validateSearch({}), link: store.linkSearch() })),
    )
  })

  test('a composed schema sees the server object while hydrating', () => {
    const store = build()
    persist('k-server-pure', { range: '30d' })
    const parse = (raw: Record<string, unknown>) => ({ ...store.validateSearch(raw) })
    Object.assign(window, { $_TSR: {} })
    expect(parse({})).toEqual(onServer(() => parse({})))
  })
})
