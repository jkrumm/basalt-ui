/** The default Date x labels follow the tick step and never repeat on one axis (ledger row 137). */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { defineFormat } from '../format'
import { resetFormatDefaults } from '../format/shared'
import { compileCartesian, dateTicks } from './compile'
import { dateTickFormat } from './date-tick-format'
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
  opts: { formatX?: (d: Date) => string; width?: number; band?: boolean } = {},
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
    ...(opts.band && { band: true }),
    ...(opts.formatX && { formatX: opts.formatX }),
  }).chart({ width: opts.width ?? 800, height: 240, defaultTheme: {} as never })
  const { values, format } = (spec.scales['x'] as unknown as Axis).axis.ticks
  return values.map((t) => format(t))
}

const unique = (xs: string[]): boolean => new Set(xs).size === xs.length
const noAdjacentRepeat = (xs: string[]): boolean => xs.every((x, i) => x !== xs[i - 1])

// The day labels read the page locale: pin one, or the runtime's decides the expected strings.
beforeEach(() => defineFormat({ locale: 'en-GB' }))
afterEach(resetFormatDefaults)

/** The en-GB day label of October `d`, as this runtime's ICU spells it. */
const oct = (d: number): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    Date.UTC(2026, 9, d),
  )
const jan = (d: number): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    Date.UTC(2026, 0, d),
  )
const at = (d: number, h = 0): Date => new Date(Date.UTC(2026, 9, d, h))
const read = (ticks: Date[]): string[] => ticks.map(dateTickFormat(ticks))

describe('dateTickFormat', () => {
  test('48 h at 6 h steps: HH:MM, the day on the midnight tick; a recurring clock is fine', () => {
    const ticks = [12, 18, 24, 30, 36, 42, 48, 54, 60].map((h) => at(17, h))
    expect(read(ticks)).toEqual([
      '12:00',
      '18:00',
      oct(18),
      '06:00',
      '12:00',
      '18:00',
      oct(19),
      '06:00',
      '12:00',
    ])
  })

  test('7 days at 12 h steps: midnight ticks carry the day, noons repeat behind them', () => {
    const ticks = Array.from({ length: 15 }, (_, i) => at(17, i * 12))
    const out = read(ticks)
    expect(out.filter((l) => l === '12:00').length).toBe(7)
    expect(out.filter((l) => /^\d{1,2} \p{L}+$/u.test(l)).length).toBe(8)
  })

  test('36 h with no midnight tick: the first tick of each day carries the date', () => {
    const ticks = [6, 18, 30, 42].map((h) => at(17, h))
    expect(read(ticks)).toEqual([`${oct(17)} 06:00`, '18:00', `${oct(18)} 06:00`, '18:00'])
  })

  test('a single day reads plain HH:MM', () => {
    expect(read([at(17, 6), at(17, 12), at(17, 18)])).toEqual(['06:00', '12:00', '18:00'])
  })

  test('days read the day and month', () => {
    expect(read([at(17), at(18), at(19)])).toEqual([oct(17), oct(18), oct(19)])
  })

  test('months repeat across years only behind a January year label', () => {
    const q = (y: number, m: number): Date => new Date(Date.UTC(y, m, 1))
    expect(read([q(2025, 0), q(2025, 3), q(2025, 6), q(2026, 0), q(2026, 3)])).toEqual([
      '2025',
      'Apr',
      'Jul',
      '2026',
      'Apr',
    ])
    // No January between the two Aprils: widen.
    expect(read([q(2025, 3), q(2025, 9), q(2026, 3)])).toEqual(['Apr 2025', 'Oct 2025', 'Apr 2026'])
  })

  test("the time scale's own ticks for a 48 h domain read hours with the day on midnight", () => {
    const ticks = dateTicks([at(17, 12), at(19, 12)], 6, 3_600_000)
    expect(read(ticks)).toEqual([
      '12:00',
      '18:00',
      oct(18),
      '06:00',
      '12:00',
      '18:00',
      oct(19),
      '06:00',
      '12:00',
    ])
  })

  test('one tick takes the span its instant implies', () => {
    expect(read([at(17)])).toEqual([oct(17)])
    expect(read([at(17, 6)])).toEqual(['06:00'])
    expect(read([new Date(Date.UTC(2026, 0, 1))])).toEqual([jan(1)])
  })

  test('month-scale ticks that share a month fall to day labels, never repeating', () => {
    const ticks = [new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 0, 31))]
    expect(read(ticks)).toEqual([jan(1), jan(31)])
  })

  test('sub-minute ticks widen to the second', () => {
    const t = (s: number): Date => new Date(Date.UTC(2026, 9, 17, 6, 0, s))
    expect(read([t(0), t(15), t(30)])).toEqual([
      `${oct(17)} 06:00:00`,
      `${oct(17)} 06:00:15`,
      `${oct(17)} 06:00:30`,
    ])
  })

  test('sub-second ticks widen to the millisecond', () => {
    const t = (ms: number): Date => new Date(Date.UTC(2026, 9, 17, 6, 0, 0, ms))
    expect(read([t(0), t(250), t(500)])).toEqual([
      `${oct(17)} 06:00:00.000`,
      `${oct(17)} 06:00:00.250`,
      `${oct(17)} 06:00:00.500`,
    ])
  })

  test('a Date outside the tick set reads as plain day', () => {
    const ticks = [at(17), at(18)]
    expect(dateTickFormat(ticks)(at(20, 5))).toBe(oct(20))
  })
})

describe('default date tick labels', () => {
  const oct17 = Date.UTC(2026, 9, 17)

  test('a 48 h hourly series marks the day boundary and never repeats back to back', () => {
    const out = labels(oct17, HOUR, 49)
    expect(noAdjacentRepeat(out)).toBe(true)
    expect(out).toContain(oct(18))
    expect(out.some((l) => /^\d\d:\d\d$/.test(l))).toBe(true)
  })

  test('the 48 h series never repeats back to back at a compact width', () => {
    const out = labels(oct17, HOUR, 49, { width: 390 })
    expect(noAdjacentRepeat(out)).toBe(true)
    expect(out.length).toBeLessThanOrEqual(6)
  })

  test('a band (BandStrip) axis takes the same default', () => {
    const out = labels(oct17, HOUR, 48, { band: true })
    expect(noAdjacentRepeat(out)).toBe(true)
    expect(out).toContain(oct(18))
  })

  test('a 30-day daily series reads the day and month', () => {
    const out = labels(oct17, DAY, 30)
    expect(unique(out)).toBe(true)
    expect(out.every((l) => /^\d{1,2} \p{L}+$/u.test(l))).toBe(true)
  })

  test('a 10-month monthly series reads months with the year on January', () => {
    const out = labels(Date.UTC(2026, 7, 1), 30 * DAY, 10)
    expect(unique(out)).toBe(true)
    expect(out).toContain('2027')
    expect(out.some((l) => /^[A-Z][a-z]{2}$/.test(l))).toBe(true)
  })

  test('a 2-year monthly series carries the year on each January', () => {
    expect(labels(Date.UTC(2025, 0, 1), 30 * DAY, 24)).toEqual([
      '2025',
      'Apr',
      'Jul',
      'Oct',
      '2026',
      'Apr',
      'Jul',
      'Oct',
    ])
  })

  test('a consumer formatX still wins', () => {
    const out = labels(oct17, HOUR, 49, { formatX: (d) => `x${d.getUTCHours()}` })
    expect(out.every((l) => l.startsWith('x'))).toBe(true)
  })
})

describe('the tick label invariant over a sweep of spans', () => {
  // A label is date-bearing (a marker) when it starts with a day and month or is a bare year.
  const isMarker = (l: string): boolean => /^(\d{1,2} \p{L}+|\d{4}$)/u.test(l)
  const STEPS_MS = [
    250,
    1_000,
    15_000,
    60_000,
    300_000,
    HOUR,
    6 * HOUR,
    12 * HOUR,
    DAY,
    7 * DAY,
    30 * DAY,
    90 * DAY,
    365 * DAY,
  ]
  const STARTS = [Date.UTC(2026, 0, 1), Date.UTC(2026, 9, 17, 6, 13, 7, 250)]
  const COUNTS = [2, 3, 7, 24, 49, 200]

  test('equal labels only ever sit apart behind a marker, and markers are unique', () => {
    let cases = 0
    for (const start of STARTS)
      for (const step of STEPS_MS)
        for (const n of COUNTS) {
          const domain: [Date, Date] = [new Date(start), new Date(start + (n - 1) * step)]
          for (const count of [3, 6]) {
            const ticks = dateTicks(domain, count, step)
            const out = read(ticks)
            const where = `${start}/${step}/${n}/${count}`
            const markers = out.filter(isMarker)
            expect(new Set(markers).size, `markers ${where}: ${out}`).toBe(markers.length)
            out.forEach((l, i) => {
              const j = out.indexOf(l, i + 1)
              if (j < 0) return
              expect(
                out.slice(i + 1, j).some(isMarker),
                `${where}: "${l}" repeats with no marker between: ${out}`,
              ).toBe(true)
            })
            cases += 1
          }
        }
    expect(cases).toBe(STARTS.length * STEPS_MS.length * COUNTS.length * 2)
  })
})
