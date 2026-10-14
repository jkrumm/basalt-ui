import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  FIXTURE,
  keystrokeValues,
  medianOrNull,
  medianOverControl,
  p50OrNull,
  scrollOffsets,
  summaryRows,
} from './table-perf'
import type { RunMetrics } from './table-perf'

const run = (over: Partial<RunMetrics> = {}): RunMetrics => ({
  firstRenderMs: 1000,
  idleFrameP50Ms: 66,
  sortP50Ms: { Name: 2000, MRR: 1900 },
  sortMisses: { Name: 0, MRR: 0 },
  searchP50Ms: 50,
  searchMisses: 0,
  scrollFrameP50Ms: 66,
  scrollFrameP95Ms: 133,
  scrollLongTasks: 0,
  ...over,
})

const valueOf = (rows: ReturnType<typeof summaryRows>, metric: string) =>
  rows.find((r) => r.metric === metric)?.value

describe('table-perf helpers', () => {
  test('keystrokeValues grows the term one character at a time after the prefix', () => {
    expect(keystrokeValues('acct-042', 'acct-')).toEqual(['acct-0', 'acct-04', 'acct-042'])
  })

  test('keystrokeValues rejects a term that does not extend the prefix', () => {
    expect(() => keystrokeValues('acct-', 'acct-')).toThrow()
    expect(() => keystrokeValues('zzz', 'acct-')).toThrow()
  })

  test('scrollOffsets is monotonic, evenly spaced and ends exactly at the bottom', () => {
    expect(scrollOffsets(1000, 4)).toEqual([250, 500, 750, 1000])
    expect(scrollOffsets(7, 3).at(-1)).toBe(7)
  })

  test('scrollOffsets is empty when there is nothing to scroll', () => {
    expect(scrollOffsets(0, 10)).toEqual([])
    expect(scrollOffsets(100, 0)).toEqual([])
  })

  test('p50OrNull and medianOrNull return null, not NaN, for an empty sample', () => {
    expect(p50OrNull([])).toBeNull()
    expect(p50OrNull([3, 1, 2])).toBe(2)
    expect(medianOrNull([null, null])).toBeNull()
    expect(medianOrNull([null, 4, 8])).toBe(6)
  })

  test('over-control is the median of per-run deltas, not a difference of medians', () => {
    // Runs: (100 − 50), (60 − 60), (300 − 100) → deltas 50, 0, 200 → median 50.
    // The difference of medians would be median(100,60,300)=100 − median(50,60,100)=60 = 40.
    const runs = [
      run({ firstRenderMs: 100, idleFrameP50Ms: 50 }),
      run({ firstRenderMs: 60, idleFrameP50Ms: 60 }),
      run({ firstRenderMs: 300, idleFrameP50Ms: 100 }),
    ]
    expect(medianOverControl(runs, (r) => r.firstRenderMs)).toBe(50)
  })

  test('summaryRows reports an all-miss sort as n/a with its miss count, never NaN', () => {
    const rows = summaryRows([
      run({ sortP50Ms: { Name: null, MRR: 1900 }, sortMisses: { Name: 6, MRR: 0 } }),
    ])
    expect(valueOf(rows, 'sort Name p50')).toBe('n/a')
    expect(valueOf(rows, 'sort Name p50 over control')).toBe('n/a')
    expect(valueOf(rows, 'sort Name misses')).toBe(6)
    expect(valueOf(rows, 'sort MRR p50')).toBe(1900)
    expect(JSON.stringify(rows)).not.toContain('null')
  })

  test('summaryRows has stable keys and counts the runs', () => {
    const rows = summaryRows([run(), run()])
    expect(valueOf(rows, 'runs (N)')).toBe(2)
    expect(rows.map((r) => r.metric)).toContain('search keystroke p50 over control')
  })
})

describe('table-perf fixture contract', () => {
  const page = readFileSync(
    join(import.meta.dirname, '../../apps/playground/src/demo/TablePerfPage.tsx'),
    'utf8',
  )
  const route = readFileSync(
    join(import.meta.dirname, '../../apps/playground/src/routes/table-perf.tsx'),
    'utf8',
  )

  test('the route file serves the lane path', () => {
    expect(route).toContain(`createFileRoute('${FIXTURE.route}')`)
  })

  test('the page generates exactly the row count the lane waits for', () => {
    expect(page).toContain(`const ROWS = ${FIXTURE.rows.toLocaleString('en').replace(/,/g, '_')}`)
  })

  test('every sort column the lane clicks is a header on the page', () => {
    for (const header of FIXTURE.sortColumns) expect(page).toContain(`header: '${header}'`)
  })

  test('names are 5-digit padded under the search prefix, so the prefix matches every row', () => {
    expect(page).toContain("padStart(5, '0')")
    expect(FIXTURE.rows).toBeLessThanOrEqual(10_000)
    expect(page).toContain('`acct-${')
    expect(FIXTURE.searchPrefix).toBe('acct-0')
    expect(FIXTURE.searchTerm.startsWith(FIXTURE.searchPrefix)).toBe(true)
  })
})
