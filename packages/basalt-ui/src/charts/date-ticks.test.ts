/** The default Date x labels follow the tick step and never repeat on one axis (ledger row 137). */
import { describe, expect, test } from 'bun:test'
import { compileCartesian } from './compile'
import type { ChartSeries } from './types'

type Row = { t: Date; v: number }
const v: ChartSeries<Row> = { key: 'v', label: 'V', color: 'var(--vx-line)', getValue: (d) => d.v }
const HOUR = 3_600_000
const DAY = 24 * HOUR

type Axis = { axis: { ticks: { values: Date[]; format: (d: Date) => string } } }
function labels(
  starts: number,
  step: number,
  n: number,
  opts: { formatX?: (d: Date) => string; width?: number } = {},
): string[] {
  const data: Row[] = Array.from({ length: n }, (_, i) => ({
    t: new Date(starts + i * step),
    v: i,
  }))
  const spec = compileCartesian({
    chartId: 'date-ticks',
    data,
    x: (d) => d.t,
    series: [v],
    marks: () => [],
    ...(opts.formatX && { formatX: opts.formatX }),
  }).chart({ width: opts.width ?? 800, height: 240, defaultTheme: {} as never })
  const { values, format } = (spec.scales['x'] as unknown as Axis).axis.ticks
  return values.map((t) => format(t))
}

const unique = (xs: string[]): boolean => new Set(xs).size === xs.length

describe('default date tick labels', () => {
  const oct17 = Date.UTC(2026, 9, 17)

  test('a 48 h hourly series reads HH:MM and marks the day boundary', () => {
    const out = labels(oct17, HOUR, 49)
    expect(unique(out)).toBe(true)
    expect(out.some((l) => l.includes('18.10'))).toBe(true)
    expect(out.some((l) => l.includes('12:00'))).toBe(true)
  })

  test('the 48 h series stays unique at a compact width', () => {
    const out = labels(oct17, HOUR, 49, { width: 390 })
    expect(unique(out)).toBe(true)
    expect(out.length).toBeLessThanOrEqual(6)
  })

  test('a 30-day daily series reads DD.MM', () => {
    const out = labels(oct17, DAY, 30)
    expect(unique(out)).toBe(true)
    expect(out.every((l) => /^\d\d\.\d\d$/.test(l))).toBe(true)
  })

  test('a 10-month monthly series reads months with the year on January', () => {
    const out = labels(Date.UTC(2026, 7, 1), 30 * DAY, 10)
    expect(unique(out)).toBe(true)
    expect(out).toContain('2027')
    expect(out.some((l) => /^[A-Z][a-z]{2}$/.test(l))).toBe(true)
  })

  test('a 2-year monthly series widens to month + year rather than repeat a month', () => {
    const out = labels(Date.UTC(2025, 0, 1), 30 * DAY, 24)
    expect(unique(out)).toBe(true)
    expect(out.every((l) => /^[A-Z][a-z]{2} 20\d\d$/.test(l))).toBe(true)
  })

  test('a consumer formatX still wins', () => {
    const out = labels(oct17, HOUR, 49, { formatX: (d) => `x${d.getUTCHours()}` })
    expect(out.every((l) => l.startsWith('x'))).toBe(true)
  })
})
