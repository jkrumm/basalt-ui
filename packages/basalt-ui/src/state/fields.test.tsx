/**
 * `createLocalStore` — the router-free lane of the store family.
 *
 * Rendered with NO `RouterProvider` on purpose: the local lane must not touch
 * `@tanstack/react-router`, because that is the whole difference between it and `createSearchStore`
 * (argo's five in-chart `useState` selects, linewatch's compact toggle). A router hook would throw
 * here, so these tests are the proof, not a claim.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { createLocalStore, field } from './fields'

function storedRecord(key: string): Record<string, unknown> | null {
  const raw = localStorage.getItem(`basalt:${key}`)
  if (raw === null) return null
  return (JSON.parse(raw) as { value: Record<string, unknown> }).value
}

function persist(key: string, record: Record<string, unknown>): void {
  localStorage.setItem(`basalt:${key}`, JSON.stringify({ v: 1, value: record }))
}

beforeEach(() => {
  localStorage.clear()
})

describe('createLocalStore', () => {
  test('use() reads the mirror, falls back, and writes with no router in sight', () => {
    const store = createLocalStore({
      key: 'l-metric',
      fields: { metric: field.enum(['load', 'volume'], 'load') },
    })

    const { result } = renderHook(() => store.field.metric.use())
    expect(result.current[0]).toBe('load')

    act(() => {
      result.current[1]('volume')
    })
    expect(result.current[0]).toBe('volume')
    expect(storedRecord('l-metric')).toEqual({ metric: 'volume' })
  })

  test('a pre-existing mirror is read on first render', () => {
    const store = createLocalStore({
      key: 'l-restore',
      fields: { view: field.enum(['chart', 'table'], 'chart') },
    })
    persist('l-restore', { view: 'table' })

    const { result } = renderHook(() => store.field.view.use())
    expect(result.current[0]).toBe('table')
  })

  test('an invalid mirror entry decodes to the fallback rather than through it', () => {
    const store = createLocalStore({
      key: 'l-invalid',
      fields: { view: field.enum(['chart', 'table'], 'chart') },
    })
    persist('l-invalid', { view: 'spreadsheet' })

    const { result } = renderHook(() => store.field.view.use())
    expect(result.current[0]).toBe('chart')
  })

  test('every field kind round-trips through the mirror', () => {
    const store = createLocalStore({
      key: 'l-kinds',
      fields: {
        tags: field.multi(['api', 'design', 'guide']),
        range: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }),
        rows: field.number({ fallback: 10, min: 1, max: 50, int: true }),
        compact: field.boolean(false),
        q: field.string(),
      },
    })

    const tags = renderHook(() => store.field.tags.use())
    act(() => {
      tags.result.current[1](['guide', 'api'])
    })
    // Canonical order is enforced on the way back out, not on the way in.
    expect(store.readStored()['tags']).toEqual(['api', 'guide'])

    const range = renderHook(() => store.field.range.use())
    act(() => {
      range.result.current[1]({ preset: 'custom', from: '2026-01-01', to: '2026-02-01' })
    })
    expect(range.result.current[0]).toEqual({
      preset: 'custom',
      from: '2026-01-01',
      to: '2026-02-01',
    })

    const rows = renderHook(() => store.field.rows.use())
    act(() => {
      rows.result.current[1](25)
    })
    expect(rows.result.current[0]).toBe(25)

    const compact = renderHook(() => store.field.compact.use())
    act(() => {
      compact.result.current[1](true)
    })
    expect(compact.result.current[0]).toBe(true)

    const q = renderHook(() => store.field.q.use())
    act(() => {
      q.result.current[1]('sled')
    })
    expect(q.result.current[0]).toBe('sled')

    // One localStorage entry per store, holding every field.
    expect(storedRecord('l-kinds')).toEqual({
      tags: ['guide', 'api'],
      range: { preset: 'custom', from: '2026-01-01', to: '2026-02-01' },
      rows: 25,
      compact: true,
      q: 'sled',
    })
  })

  test('two fields written in the same tick do not clobber each other', () => {
    const store = createLocalStore({
      key: 'l-concurrent',
      fields: {
        view: field.enum(['chart', 'table'], 'chart'),
        compact: field.boolean(false),
      },
    })

    const view = renderHook(() => store.field.view.use())
    const compact = renderHook(() => store.field.compact.use())

    act(() => {
      view.result.current[1]('table')
      compact.result.current[1](true)
    })

    expect(storedRecord('l-concurrent')).toEqual({ view: 'table', compact: true })
  })

  test('readStored is flat and omits a field that has never been written', () => {
    const store = createLocalStore({
      key: 'l-read',
      fields: {
        view: field.enum(['chart', 'table'], 'chart'),
        compact: field.boolean(false),
      },
    })
    persist('l-read', { view: 'table' })

    expect(store.readStored()).toEqual({ view: 'table' })
  })

  test('handles carry the same contract a search store hands a control', () => {
    const store = createLocalStore({
      key: 'l-handle',
      fields: { view: field.enum(['chart', 'table'], 'chart') },
    }).field.view

    expect(store.kind).toBe('enum')
    expect(store.fallback).toBe('chart')
    expect(store.isDefault('chart')).toBe(true)
    expect(store.options).toEqual([
      { value: 'chart', label: 'chart' },
      { value: 'table', label: 'table' },
    ])
  })
})

/**
 * `persist: false` in a local store has no URL to fall back on, so it is the IN-MEMORY lane rather
 * than a field frozen on its fallback: shared across mounts for the session, gone on reload.
 */
describe('createLocalStore — the in-memory lane', () => {
  test('a persist: false field survives a remount and never touches localStorage', () => {
    const store = createLocalStore({
      key: 'l-memory',
      fields: { zoomed: field.boolean(false, { persist: false }) },
    })

    const first = renderHook(() => store.field.zoomed.use())
    expect(first.result.current[0]).toBe(false)
    act(() => {
      first.result.current[1](true)
    })
    expect(first.result.current[0]).toBe(true)
    first.unmount()

    const second = renderHook(() => store.field.zoomed.use())
    expect(second.result.current[0]).toBe(true)
    expect(localStorage.getItem('basalt:l-memory')).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  test('two live mounts of the same field see one value', () => {
    const store = createLocalStore({
      key: 'l-memory-shared',
      fields: { metric: field.enum(['load', 'volume'], 'load', { persist: false }) },
    })

    const a = renderHook(() => store.field.metric.use())
    const b = renderHook(() => store.field.metric.use())

    act(() => {
      a.result.current[1]('volume')
    })

    expect(b.result.current[0]).toBe('volume')
  })

  test('a mirrored field beside it still persists — the lane is per field', () => {
    const store = createLocalStore({
      key: 'l-memory-mixed',
      fields: {
        view: field.enum(['chart', 'table'], 'chart'),
        zoomed: field.boolean(false, { persist: false }),
      },
    })

    const view = renderHook(() => store.field.view.use())
    const zoomed = renderHook(() => store.field.zoomed.use())
    act(() => {
      view.result.current[1]('table')
      zoomed.result.current[1](true)
    })

    expect(storedRecord('l-memory-mixed')).toEqual({ view: 'table' })
    expect(zoomed.result.current[0]).toBe(true)
  })
})

describe('createLocalStore — labels()', () => {
  test('labels reach field.<name>.options, and the call is chainable', () => {
    const store = createLocalStore({
      key: 'l-labels',
      fields: { metric: field.enum(['load', 'volume'], 'load') },
    }).labels({ metric: { load: 'Training load', volume: 'Total volume' } })

    expect(store.field.metric.options).toEqual([
      { value: 'load', label: 'Training load' },
      { value: 'volume', label: 'Total volume' },
    ])
  })

  test('an unlabelled value falls back to the value itself', () => {
    const store = createLocalStore({
      key: 'l-labels-partial',
      fields: { metric: field.enum(['load', 'volume'], 'load') },
    }).labels({ metric: { load: 'Training load' } })

    expect(store.field.metric.options.map((option) => option.label)).toEqual([
      'Training load',
      'volume',
    ])
  })
})

/**
 * A lazy fallback — `fallback: () => T`. The local store is its home: `createSearchStore` allows it
 * off the URL lane only (a thunk in `validateSearch` would pin a computed value into a deep link),
 * and every lane here is off the URL by construction.
 */
describe('createLocalStore — a lazy fallback', () => {
  test('is not called at definition, resolves at read, and is re-read while nothing is written', () => {
    let calls = 0
    let today = '2026-01-01'
    const store = createLocalStore({
      key: 'l-lazy',
      fields: {
        since: field.string({
          fallback: () => {
            calls += 1
            return today
          },
        }),
      },
    })
    // Definition must not run it: a store is built at module scope, where "now" is meaningless.
    expect(calls).toBe(0)

    const { result } = renderHook(() => store.field.since.use())
    expect(result.current[0]).toBe('2026-01-01')
    expect(calls).toBeGreaterThan(0)

    // The thunk is the value while the field is unset — a later read sees what it returns NOW.
    today = '2026-02-01'
    expect(store.field.since.fallback).toBe('2026-02-01')
    expect(store.field.since.isDefault('2026-02-01')).toBe(true)
    expect(store.field.since.isDefault('2026-01-01')).toBe(false)

    // Nothing was persisted by reading — a fallback is not a value until a write makes it one.
    expect(localStorage.getItem('basalt:l-lazy')).toBeNull()
  })

  test('a write wins over the thunk, and the thunk stops being consulted', () => {
    let calls = 0
    const store = createLocalStore({
      key: 'l-lazy-write',
      fields: {
        rows: field.number({
          fallback: () => {
            calls += 1
            return 10
          },
          min: 1,
        }),
      },
    })

    const { result } = renderHook(() => store.field.rows.use())
    expect(result.current[0]).toBe(10)
    act(() => {
      result.current[1](25)
    })

    const after = calls
    expect(result.current[0]).toBe(25)
    expect(storedRecord('l-lazy-write')).toEqual({ rows: 25 })
    expect(calls).toBe(after)
  })

  test('the memory lane resolves it too — every kind takes the thunk form', () => {
    let preset = '7d'
    let n = 1
    const store = createLocalStore({
      key: 'l-lazy-memory',
      fields: {
        metric: field.enum(['load', 'volume'], () => 'volume', { persist: false }),
        range: field.range({ presets: ['7d', '30d'], fallback: () => preset as '7d' | '30d' }),
        tags: field.multi(['api', 'design'], () => ['design']),
        compact: field.boolean(() => true),
        // The two kinds this test used to omit. `number` builds its codec with an EXTRA member
        // (`bounds`), which is exactly how it once ended up spreading the shell and freezing this
        // fallback at definition — the whole kind list is here so that cannot recur unnoticed.
        count: field.number({ fallback: () => n, min: 0 }),
        label: field.string({ fallback: () => String(n) }),
      },
    })

    const metric = renderHook(() => store.field.metric.use())
    expect(metric.result.current[0]).toBe('volume')
    expect(store.field.range.fallback).toEqual({ preset: '7d' })
    preset = '30d'
    expect(store.field.range.fallback).toEqual({ preset: '30d' })
    expect(store.field.tags.fallback).toEqual(['design'])
    expect(store.field.compact.fallback).toBe(true)
    expect([store.field.count.fallback, store.field.label.fallback]).toEqual([1, '1'])

    // Read at READ time, not at definition: a later read sees what the thunk returns now.
    n = 2
    expect([store.field.count.fallback, store.field.label.fallback]).toEqual([2, '2'])
    const count = renderHook(() => store.field.count.use())
    expect(count.result.current[0]).toBe(2)
  })

  test('clear() unsets the mirror, so the thunk resolves again', () => {
    let today = '2026-08-27'
    const store = createLocalStore({
      key: 'l-lazy-clear',
      fields: {
        since: field.string({ fallback: () => today }),
        metric: field.enum(['load', 'volume'], 'load'),
      },
    })
    persist('l-lazy-clear', { since: '2026-01-01', metric: 'volume' })

    const { result } = renderHook(() => store.field.since.use())
    expect(result.current[0]).toBe('2026-01-01')

    act(() => {
      store.field.since.clear()
    })

    // The KEY is gone — writing the resolved fallback instead would hand a reader '2026-08-27'
    // tomorrow, as a value they never chose. The sibling field is untouched.
    expect(storedRecord('l-lazy-clear')).toEqual({ metric: 'volume' })
    expect(result.current[0]).toBe('2026-08-27')
    today = '2026-08-28'
    expect(store.field.since.fallback).toBe('2026-08-28')
    expect(store.field.since.isDefault('2026-08-28')).toBe(true)
  })

  test('clear() on the memory lane drops that field only', () => {
    const store = createLocalStore({
      key: 'l-clear-memory',
      fields: {
        scratch: field.enum(['a', 'b'], 'a', { persist: false }),
        other: field.enum(['a', 'b'], 'a', { persist: false }),
      },
    })

    const scratch = renderHook(() => store.field.scratch.use())
    const other = renderHook(() => store.field.other.use())
    act(() => {
      scratch.result.current[1]('b')
      other.result.current[1]('b')
    })
    expect([scratch.result.current[0], other.result.current[0]]).toEqual(['b', 'b'])

    act(() => {
      store.field.scratch.clear()
    })
    expect([scratch.result.current[0], other.result.current[0]]).toEqual(['a', 'b'])
    expect(localStorage.getItem('basalt:l-clear-memory')).toBeNull()
  })

  /**
   * `toWindow`'s TYPE, not just its runtime: the presets that declared a resolver are excluded from
   * the `{ window }` branch, so the result assigns to an API param type naming only the
   * server-understood windows. Before that, a consumer replacing its `presetToParams` switch with
   * `toWindow` needed a cast — the workaround moved rather than going away.
   */
  test('toWindow drops the resolved presets from its return TYPE', () => {
    const store = createLocalStore({
      key: 'l-towindow',
      fields: {
        window: field.range({
          presets: ['7d', '30d', '90d', '3m', 'ytd', 'all'],
          fallback: '30d',
          window: {
            '3m': () => ({ from: '2026-06-01', to: '2026-08-27' }),
            ytd: () => ({ from: '2026-01-01', to: '2026-08-27' }),
          },
        }),
      },
    })

    type SummaryParams = { window: '7d' | '30d' | '90d' | 'all' } | { from: string; to: string }

    // The assignment IS the assertion — no cast, which is what a consumer's `resolveWindow` was.
    const resolve = (preset: '7d' | '30d' | '90d' | '3m' | 'ytd' | 'all'): SummaryParams =>
      store.field.window.toWindow({ preset })

    expect(resolve('30d')).toEqual({ window: '30d' })
    expect(resolve('3m')).toEqual({ from: '2026-06-01', to: '2026-08-27' })
    expect(resolve('ytd')).toEqual({ from: '2026-01-01', to: '2026-08-27' })

    // @ts-expect-error `3m` declared a resolver, so it can never come back in the window branch.
    const pinned: { window: '3m' } | { from: string; to: string } = store.field.window.toWindow({
      preset: '3m',
    })
    expect(pinned).toEqual({ from: '2026-06-01', to: '2026-08-27' })
  })
})

/**
 * The number handle's republished bounds (`NumberHandleExtras`). They are on the handle for exactly
 * one reason: a control never sees the field descriptor, so before this the only way a `NumberFilter`
 * could bound its own input was for the call site to pass `min`/`max` a second time — a second answer
 * to a question the field already owns.
 */
describe('createLocalStore — a number handle republishes its bounds', () => {
  test('min, max and int come off the field declaration', () => {
    const store = createLocalStore({
      key: 'l-bounds',
      fields: { nights: field.number({ fallback: 2, min: 1, max: 14, int: true }) },
    })

    expect({
      min: store.field.nights.min,
      max: store.field.nights.max,
      int: store.field.nights.int,
    }).toEqual({ min: 1, max: 14, int: true })
  })

  test('an undeclared bound is undefined, and int defaults to false — never 0/true by accident', () => {
    const store = createLocalStore({
      key: 'l-bounds-open',
      fields: { threshold: field.number({ fallback: 0 }) },
    })

    expect({
      min: store.field.threshold.min,
      max: store.field.threshold.max,
      int: store.field.threshold.int,
    }).toEqual({ min: undefined, max: undefined, int: false })
  })

  // The negative branch of the extras type, asserted at RUNTIME as well: a non-number handle must
  // not grow a `max` off `StringField`'s own `max`, which is the one collision this shape could have.
  test('a non-number handle carries none of the three', () => {
    const store = createLocalStore({
      key: 'l-bounds-other',
      fields: { q: field.string({ max: 40 }), metric: field.enum(['load', 'volume'], 'load') },
    })

    expect([store.field.q.max, store.field.q.min, store.field.q.int]).toEqual([
      undefined,
      undefined,
      undefined,
    ])
    expect(store.field.metric.int).toBeUndefined()
  })

  // The bounds are what the codec was ALREADY clamping to — the handle is a readout of that law,
  // not a second copy of it.
  test('the value the codec clamps to is the value the handle reports', () => {
    const store = createLocalStore({
      key: 'l-bounds-clamp',
      fields: { nights: field.number({ fallback: 2, min: 1, max: 14, int: true }) },
    })
    persist('l-bounds-clamp', { nights: 99 })

    const { result } = renderHook(() => store.field.nights.use())
    // Both sides in ONE assertion, so the pair has to agree rather than each matching 14 alone —
    // `max` is `number | undefined` on the handle by construction, which is why it is not the
    // `expected` argument.
    expect([result.current[0], store.field.nights.max]).toEqual([14, 14])
  })
})
