import { describe, expect, test } from 'bun:test'
import {
  aggregateBrowser,
  aggregateServer,
  analyzeStream,
  clsOf,
  foldBrowserRun,
  summaryRows,
} from './ssr'
import type { BrowserRaw, BrowserRun, Chunk } from './ssr'
import { SECTION_KEYS } from './ssr-fixture/contract'
import type { SectionKey } from './ssr-fixture/contract'
import { medianOrNull } from './perf-util'
import type { Throttle } from './perf-util'

const chunk = (ms: number, text: string): Chunk => ({ ms, text, bytes: text.length })
const times = (v: number | null): Record<SectionKey, number | null> =>
  Object.fromEntries(SECTION_KEYS.map((k) => [k, v])) as Record<SectionKey, number | null>

describe('analyzeStream', () => {
  const stream = [
    chunk(2, '<html><div data-ssr-shell><div data-ssr-fallback="kpis">'),
    chunk(155, '<div hidden id="S:1"><div data-ssr-ready="kpis"></div></div>'),
    chunk(305, '<div data-ssr-ready="trend"></div><div data-ssr-ready="mix"></div>'),
    chunk(610, '<div data-ssr-ready="table"></div></html>'),
  ]

  test('shell flush is the first chunk with the shell; each section its own first chunk', () => {
    const stats = analyzeStream(stream)
    expect(stats).toMatchObject({
      chunks: 4,
      firstChunkMs: 2,
      shellMs: 2,
      totalMs: 610,
      sectionMs: { kpis: 155, trend: 305, mix: 305, table: 610 },
    })
  })

  test('a section that never arrives is null, a missing shell is null', () => {
    const stats = analyzeStream([chunk(5, 'plain'), chunk(9, '<div data-ssr-ready="kpis">')])
    expect(stats.shellMs).toBeNull()
    expect(stats.sectionMs).toEqual({ kpis: 9, trend: null, mix: null, table: null })
  })

  test('a marker split across two reads counts at the chunk that completes it', () => {
    const stats = analyzeStream([
      chunk(2, '<div data-ssr-sh'),
      chunk(9, 'ell><div data-ssr-ready="kp'),
      chunk(20, 'is"></div>'),
    ])
    expect(stats.shellMs).toBe(9)
    expect(stats.sectionMs.kpis).toBe(20)
  })

  test('the first occurrence wins when a marker repeats', () => {
    const stats = analyzeStream([
      chunk(1, 'data-ssr-ready="mix"'),
      chunk(5, 'data-ssr-ready="mix" data-ssr-shell'),
      chunk(8, 'data-ssr-shell'),
    ])
    expect(stats.sectionMs.mix).toBe(1)
    expect(stats.shellMs).toBe(5)
  })

  test('a buffered document is ONE chunk: shell and every section at the same time', () => {
    const only = chunk(600, stream.map((c) => c.text).join(''))
    const stats = analyzeStream([only])
    expect(stats.chunks).toBe(1)
    expect(new Set([stats.shellMs, ...Object.values(stats.sectionMs)])).toEqual(new Set([600]))
  })

  test('an empty stream reports NaN times, not a made-up zero', () => {
    const stats = analyzeStream([])
    expect(stats.firstChunkMs).toBeNaN()
    expect(stats.totalMs).toBeNaN()
    expect(stats.chunks).toBe(0)
  })
})

describe('clsOf', () => {
  test('sums shifts, skips those right after input', () => {
    expect(
      clsOf([
        { value: 0.1, hadRecentInput: false },
        { value: 0.25, hadRecentInput: true },
        { value: 0.05, hadRecentInput: false },
      ]),
    ).toBeCloseTo(0.15)
  })
  test('no shifts is 0', () => expect(clsOf([])).toBe(0))
})

describe('medianOrNull', () => {
  test('median of the present values', () => expect(medianOrNull([3, null, 1, 2])).toBe(2))
  test('all-null is null, never NaN', () => expect(medianOrNull([null, null])).toBeNull())
  test('respects digits', () => expect(medianOrNull([0.12345], 4)).toBe(0.1235))
})

const raw = (over: Partial<BrowserRaw> = {}): BrowserRaw => ({
  ttfb: 3.14,
  fcp: 100.04,
  shellMs: 8.2,
  arrived: times(150),
  revealed: times(400),
  shifts: [{ value: 0.01234567, hadRecentInput: false }],
  hydrateStart: 650,
  hydrateEnd: 670.5,
  errors: ['boom\nstack', 'again'],
  ...over,
})

describe('foldBrowserRun', () => {
  test('rounds, derives hydration duration and CLS, counts errors', () => {
    expect(foldBrowserRun(raw())).toMatchObject({
      ttfbMs: 3.1,
      fcpMs: 100,
      shellMs: 8.2,
      cls: 0.0123,
      hydrateStartMs: 650,
      hydrationMs: 20.5,
      errors: 2,
      errorSamples: ['boom', 'again'],
    })
  })

  test('a missing navigation entry or a non-finite stamp reads null, never NaN', () => {
    const run = foldBrowserRun(
      raw({ ttfb: null, fcp: Number.NaN, shellMs: Number.POSITIVE_INFINITY }),
    )
    expect(run.ttfbMs).toBeNull()
    expect(run.fcpMs).toBeNull()
    expect(run.shellMs).toBeNull()
  })

  test('hydration that never ended has no duration', () => {
    expect(foldBrowserRun(raw({ hydrateEnd: null })).hydrationMs).toBeNull()
  })
})

const run = (over: Partial<BrowserRun> = {}): BrowserRun => ({
  ...foldBrowserRun(raw()),
  ...over,
})

describe('aggregateBrowser', () => {
  test('medians per metric, errors summed, complete counts fully revealed hydrated runs', () => {
    const runs = [
      run({ ttfbMs: 3 }),
      run({ ttfbMs: 5 }),
      run({ ttfbMs: 4, revealedMs: { ...times(400), table: null } }),
      run({ ttfbMs: 100, hydrationMs: null }),
    ]
    const agg = aggregateBrowser(runs)
    expect(agg.ttfbMs).toBe(4.5)
    expect(agg.errors).toBe(8)
    expect(agg.complete).toBe(2)
    expect(agg.runs).toBe(4)
    expect(agg.revealedMs.table).toBe(400)
  })
})

describe('aggregateServer', () => {
  test('medians; chunk and byte counts are whole numbers', () => {
    const a = analyzeStream([chunk(2, 'data-ssr-shell'), chunk(600, 'data-ssr-ready="kpis"')])
    const b = analyzeStream([chunk(4, 'data-ssr-shell'), chunk(700, 'data-ssr-ready="kpis"')])
    const agg = aggregateServer([a, b])
    expect(agg.shellMs).toBe(3)
    expect(agg.sectionMs.kpis).toBe(650)
    expect(agg.sectionMs.table).toBeNull()
    expect(agg.chunks).toBe(2)
  })
})

describe('summaryRows', () => {
  const server = aggregateServer([analyzeStream([chunk(2, 'data-ssr-shell')])])
  const browser = new Map<Throttle, ReturnType<typeof aggregateBrowser>>([
    [1, aggregateBrowser([run()])],
  ])
  const rows = summaryRows(server, browser)
  const get = (metric: string) => rows.find((r) => r.metric === metric)?.value

  test('floors, server and browser rows are present', () => {
    expect(get('floor: table loader delay')).toBe(600)
    expect(get('server: shell flush')).toBe(2)
    expect(get('browser 1x: CLS')).toBe(0.0123)
    expect(get('browser 1x: complete runs')).toBe('1/1')
  })

  test('a metric no run produced is NaN (rendered n/a), not a number', () => {
    expect(get('server: table complete')).toBeNaN()
  })

  test('every metric name is unique', () => {
    expect(new Set(rows.map((r) => r.metric)).size).toBe(rows.length)
  })
})

describe('empty aggregates', () => {
  test('aggregateServer([]) has no numbers, only nulls', () => {
    const agg = aggregateServer([])
    expect(agg.shellMs).toBeNull()
    expect(agg.chunks).toBeNull()
    expect(Object.values(agg.sectionMs).every((v) => v === null)).toBe(true)
  })

  test('aggregateBrowser([]) has nulls, zero errors and zero complete runs', () => {
    const agg = aggregateBrowser([])
    expect(agg).toMatchObject({
      ttfbMs: null,
      cls: null,
      hydrationMs: null,
      errors: 0,
      complete: 0,
      runs: 0,
    })
    expect(Object.values(agg.revealedMs).every((v) => v === null)).toBe(true)
  })
})
