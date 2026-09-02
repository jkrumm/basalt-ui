/**
 * `createSearchStore` — the resolution law, per field kind, without a router.
 *
 * The router half (what `use()` reads, when a write navigates) lives in
 * `search-store.router.test.tsx`; this file pins the parts that run outside React: the codecs,
 * the lanes, `validateSearch`/`linkSearch`/`readStored`, and the option labels.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { field } from '../state'
import { createSearchStore } from './search-store'

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

describe('the pinned-link warning', () => {
  test('fires for a multi field — the fallback comparison is by CONTENT, not identity', () => {
    const store = createSearchStore({
      key: 'k-warn-multi',
      fields: { tags: field.multi(['api', 'design'], ['api']) },
    })
    persist('k-warn-multi', { tags: ['design'] })

    // `['api']` from the URL is a different array object than the fallback — `===` would miss it.
    store.validateSearch({ tags: ['api'] })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('linkSearch')
  })

  test('fires for a range field, whose value is an object', () => {
    const store = createSearchStore({
      key: 'k-warn-range',
      fields: { range: field.range({ presets: ['7d', '30d'], fallback: '30d' }) },
    })
    persist('k-warn-range', { range: { preset: '7d' } })

    store.validateSearch({ range: '30d' })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('range=30d')
  })

  test('stays silent when the URL and the mirror agree, whatever the kind', () => {
    const store = createSearchStore({
      key: 'k-warn-agree',
      fields: { tags: field.multi(['api', 'design'], ['api']) },
    })
    persist('k-warn-agree', { tags: ['api'] })

    store.validateSearch({ tags: ['api'] })
    expect(warn).not.toHaveBeenCalled()
  })

  test('stays silent once any reader is wired — including field.use(), the documented one', () => {
    const store = createSearchStore({
      key: 'k-warn-wired',
      fields: { range: field.enum(['1d', '7d', '30d'], '30d') },
    })
    persist('k-warn-wired', { range: '7d' })

    store.readStored()
    store.validateSearch({ range: '30d' })
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('labels / options', () => {
  test('labels() returns the SAME store, so it chains at the definition site', () => {
    const store = createSearchStore({
      key: 'k-labels',
      fields: { range: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }) },
    })
    expect(store.labels({ range: { '7d': 'Last 7 days' } })).toBe(store)
  })

  test('options derive from the values plus the labels — including a range’s custom preset', () => {
    const store = createSearchStore({
      key: 'k-options',
      fields: {
        range: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }),
        tags: field.multi(['api', 'design']),
        page: field.number({ fallback: 1 }),
      },
    }).labels({ range: { '7d': 'Last 7 days', custom: 'Custom range' } })

    expect(store.field.range.options).toEqual([
      { value: '7d', label: 'Last 7 days' },
      { value: '30d', label: '30d' },
      { value: 'custom', label: 'Custom range' },
    ])
    expect(store.field.tags.options).toEqual([
      { value: 'api', label: 'api' },
      { value: 'design', label: 'design' },
    ])
    expect(store.field.page.options).toEqual([])
  })
})

describe('the handle, outside React', () => {
  test('kind, fallback and isDefault come off the field definition', () => {
    const store = createSearchStore({
      key: 'k-handle',
      fields: {
        range: field.enum(['1d', '7d'], '7d'),
        tags: field.multi(['api', 'design'], ['api']),
      },
    })
    expect(store.field.range.kind).toBe('enum')
    expect(store.field.range.fallback).toBe('7d')
    expect(store.field.range.isDefault('7d')).toBe(true)
    expect(store.field.range.isDefault('1d')).toBe(false)
    // Multi compares by content, not by reference.
    expect(store.field.tags.isDefault(['api'])).toBe(true)
    expect(store.field.tags.isDefault(['design'])).toBe(false)
  })

  test('toWindow projects a preset to `{ window }` and a custom range to `{ from, to }`', () => {
    const store = createSearchStore({
      key: 'k-towindow',
      fields: { range: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }) },
    })
    expect(store.field.range.toWindow({ preset: '7d' })).toEqual({ window: '7d' })
    expect(
      store.field.range.toWindow({ preset: 'custom', from: '2026-01-01', to: '2026-02-01' }),
    ).toEqual({ from: '2026-01-01', to: '2026-02-01' })
    // A custom preset with no dates has nothing to project — it degrades to the preset.
    expect(store.field.range.toWindow({ preset: 'custom' })).toEqual({ window: 'custom' })
  })

  test('a preset declared with a `window` resolver projects to `{ from, to }`', () => {
    // The derived presets three consumers hand-rolled beside the store (`3m`, `ytd`): one preset in
    // the URL, two dates at the API boundary, no `presetToParams` in the page.
    const seen: Date[] = []
    const store = createSearchStore({
      key: 'k-window-resolver',
      fields: {
        range: field.range({
          presets: ['7d', '3m', 'ytd'],
          fallback: '7d',
          custom: true,
          window: {
            '3m': (now) => {
              seen.push(now)
              return { from: iso(addMonths(now, -3)), to: iso(now) }
            },
            ytd: (now) => ({ from: `${now.getUTCFullYear()}-01-01`, to: iso(now) }),
          },
        }),
      },
    })

    const now = new Date()
    expect(store.field.range.toWindow({ preset: '3m' })).toEqual({
      from: iso(addMonths(now, -3)),
      to: iso(now),
    })
    expect(store.field.range.toWindow({ preset: 'ytd' })).toEqual({
      from: `${now.getUTCFullYear()}-01-01`,
      to: iso(now),
    })
    // Resolved at CALL time, with the current date — never captured at definition.
    expect(seen[0] instanceof Date).toBe(true)

    // A preset WITHOUT a resolver is untouched, in the same field.
    expect(store.field.range.toWindow({ preset: '7d' })).toEqual({ window: '7d' })
    // And a custom window still wins over any resolver.
    expect(
      store.field.range.toWindow({ preset: 'custom', from: '2026-03-01', to: '2026-03-14' }),
    ).toEqual({ from: '2026-03-01', to: '2026-03-14' })
  })

  test('a resolver changes nothing about the URL — the preset is still what is stored', () => {
    const store = createSearchStore({
      key: 'k-window-url',
      fields: {
        range: field.range({
          presets: ['7d', '3m'],
          fallback: '7d',
          window: { '3m': () => ({ from: '2026-01-01', to: '2026-04-01' }) },
        }),
      },
    })
    expect(store.validateSearch({ range: '3m' })).toEqual({
      range: '3m',
      from: undefined,
      to: undefined,
    })
    expect(store.field.range.toWindow({ preset: '3m' })).toEqual({
      from: '2026-01-01',
      to: '2026-04-01',
    })
  })

  test('a preset named like an Object.prototype member is not a resolver', () => {
    const store = createSearchStore({
      key: 'k-window-proto',
      fields: { range: field.range({ presets: ['toString', '7d'], fallback: '7d' }) },
    })
    expect(store.field.range.toWindow({ preset: 'toString' })).toEqual({ window: 'toString' })
  })

  test('toWindow exists on a range handle and on no other kind', () => {
    const store = createSearchStore({
      key: 'k-towindow-absent',
      fields: { range: field.enum(['1d', '7d'], '7d') },
    })
    expect(store.field.range.toWindow).toBeUndefined()
  })
})

describe('types', () => {
  test('a fallback outside the values is a compile error, not a widened union', () => {
    const store = createSearchStore({
      key: 'k-types',
      // @ts-expect-error 'c' is not one of the declared values
      fields: { tab: field.enum(['a', 'b'] as const, 'c') },
    })
    // The `@ts-expect-error` above IS the assertion; this keeps the store referenced.
    expect(store.field.tab.kind).toBe('enum')
  })
})

/** UTC `YYYY-MM-DD` — the shape `toWindow` deals in, with no timezone in the answer. */
function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addMonths(d: Date, months: number): Date {
  const next = new Date(d)
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

describe('a lazy fallback and the lanes', () => {
  test('a thunk fallback on the URL lane throws at DEFINITION, naming the two ways out', () => {
    expect(() =>
      createSearchStore({
        key: 'k-lazy-url',
        fields: { since: field.string({ fallback: () => '2026-01-01' }) },
      }),
    ).toThrow(/thunk fallback on the URL lane/)
  })

  test('off the URL lane it resolves per read, in a search store too', () => {
    let today = '2026-01-01'
    const store = createSearchStore({
      key: 'k-lazy-local',
      fields: {
        since: field.string({ fallback: () => today }, { url: false }),
        scratch: field.string({ fallback: () => today }, { url: false, persist: false }),
      },
    })
    expect(store.field.since.fallback).toBe('2026-01-01')
    today = '2026-02-01'
    expect(store.field.since.fallback).toBe('2026-02-01')
    expect(store.field.scratch.fallback).toBe('2026-02-01')
  })
})

describe('field.range — the `custom` flag is inferred, never widened', () => {
  test('an omitted `custom` keeps `custom` out of the value type AND out of the options', () => {
    const store = createSearchStore({
      key: 'k-custom-inference',
      fields: { range: field.range({ presets: ['7d', '30d'], fallback: '30d' }) },
    })
    type Search = ReturnType<typeof store.validateSearch>

    const preset: Search['range'] = '7d'
    // @ts-expect-error 'custom' is NOT a value of a range that never declared `custom: true` —
    // this is the whole bug: written inline in `fields`, `C` used to widen to `boolean` against
    // `AnyField`, and every value type gained a preset the field rejects at runtime.
    const widened: Search['range'] = 'custom'

    expect(preset).toBe('7d')
    // `String(...)` because `widened`'s DECLARED type no longer admits the value it holds — the
    // `@ts-expect-error` above is the assertion, this only keeps the binding used.
    expect(String(widened)).toBe('custom')
    expect(store.field.range.options.map((option) => option.value)).toEqual(['7d', '30d'])
    // The runtime agrees with the type: a `custom` preset does not decode.
    expect(store.validateSearch({ range: 'custom', from: '2026-01-01', to: '2026-02-01' })).toEqual(
      { range: '30d', from: undefined, to: undefined },
    )
  })

  test('`custom: true` still admits it, in the type and in the options', () => {
    const store = createSearchStore({
      key: 'k-custom-true',
      fields: { range: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }) },
    })
    type Search = ReturnType<typeof store.validateSearch>
    const custom: Search['range'] = 'custom'

    expect(custom).toBe('custom')
    expect(store.field.range.options.map((option) => option.value)).toEqual(['7d', '30d', 'custom'])
  })

  test('a `custom` flag held in a widened boolean still builds — it just stays widened', () => {
    const allowCustom: boolean = true
    const store = createSearchStore({
      key: 'k-custom-widened',
      fields: { range: field.range({ presets: ['7d'], fallback: '7d', custom: allowCustom }) },
    })
    type Search = ReturnType<typeof store.validateSearch>
    const custom: Search['range'] = 'custom'

    expect(custom).toBe('custom')
    expect(store.field.range.options.map((option) => option.value)).toEqual(['7d', 'custom'])
  })
})
