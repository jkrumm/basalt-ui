/**
 * Wave 37 round r3, the chart half (argo UPSTREAM § Wave 31): a daily tooltip header keeps its
 * weekday and year under a consumer `formatX`, a sparkline's reference label clears its line,
 * a one-item `period` list is separated from the unit, whole-step ticks print integers, a narrow
 * `BandStrip` cell keeps a non-hue cue, and an end label never leaves the plot.
 */
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { defineFormat } from '../format'
import { resetFormatDefaults } from '../format/shared'
import { BandStrip } from './BandStrip'
import { ChartCard } from './ChartCard'
import { Heatmap } from './Heatmap'
import { Lines } from './Lines'
import { compileCartesian, yGuide } from './compile'
import { endLabelOffset, endLabelPlan } from './labels'
import { referenceLabelPlacement } from './ref-label'
import { Sparkline } from './Sparkline'
import { xScaleFor } from './scales'
import type { BandStripSeries } from './BandStrip'
import type { ChartSeries, PlotContext, PlotRow } from './types'

beforeEach(() => defineFormat({ locale: 'en-GB' }))
afterEach(resetFormatDefaults)

const dom = (html: string): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('daily tooltip header (item 1)', () => {
  type Row = { t: Date; v: number }
  const days: Row[] = [1, 2, 3].map((d) => ({ t: new Date(Date.UTC(2026, 8, d)), v: d }))
  const series: ChartSeries<Row> = { key: 'v', label: 'V', color: 'red', getValue: (d) => d.v }
  const title = (formatX: ((x: Date) => string) | undefined): string => {
    const def = compileCartesian({
      chartId: 'h',
      data: days,
      x: (d: Row) => d.t,
      marks: () => [],
      series: [series],
      ...(formatX && { formatX }),
    })
    const tooltip = def.tooltip
    if (!tooltip || !('content' in tooltip) || !tooltip.content) throw new Error('no tooltip')
    const datum = days[1]
    return tooltip.content(
      [{ datum: { x: datum?.t, y: 2, series: 'v', datum }, xValue: datum?.t } as never],
      {} as never,
    ).title as string
  }
  const long = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(days[1]?.t)
  const short = (d: Date): string =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(d)

  test('the default header is weekday, day, month and year', () => {
    expect(title(undefined)).toBe(long)
  })
  test('a short tick formatX shortens the ticks, never the daily header', () => {
    expect(title(short)).toBe(long)
  })
})

describe('Sparkline referenceLabel clears its line (item 2)', () => {
  const place = (value: number, height: number) =>
    referenceLabelPlacement({ value, domain: [0, 100], height, inset: 3, fontSize: 11 })

  test('a line low in the plot takes the label above it, a line high up takes it below', () => {
    expect(place(20, 30).side).toBe('above')
    expect(place(95, 30).side).toBe('below')
  })
  test('the label box never touches the line and stays inside the plot', () => {
    for (const height of [30, 48, 320]) {
      for (const value of [0, 10, 25, 50, 75, 90, 100]) {
        const { dy, side } = place(value, height)
        const line = 3 + (height - 6) * (1 - value / 100)
        const centre = line + dy
        const [top, bottom] = [centre - 5.5, centre + 5.5]
        expect(side === 'above' ? bottom < line : top > line).toBe(true)
        expect(top).toBeGreaterThanOrEqual(0)
        expect(bottom).toBeLessThanOrEqual(height)
      }
    }
  })
  test('the rendered label sits off its rule and inside the plot inset', () => {
    const html = renderToString(
      <Sparkline
        ariaLabel="S"
        data={[10, 20, 30, 40, 50]}
        height={30}
        reference={30}
        referenceLabel="PR"
      />,
    )
    const el = dom(html)
    const rule = el.querySelector('[data-ts-key^="reference:"]')
    const label = el.querySelector('[data-ts-key="reference-label"] text')
    const line = Number(rule?.getAttribute('y1'))
    const y = Number(label?.getAttribute('y'))
    expect(Math.abs(y - line)).toBeGreaterThanOrEqual(6.5)
    expect(Number(label?.getAttribute('x'))).toBeGreaterThanOrEqual(5)
  })
})

describe('ChartFact period list (item 3)', () => {
  test('a one-item list is separated from the unit', () => {
    const { getByText } = render(
      <ChartCard title="T" facts={{ value: '4', unit: 'h', period: ['basis'] }} />,
    )
    expect(getByText(/basis/).textContent).toBe('· basis')
  })
  test('a list joins its items and leads with the separator after a unit', () => {
    const { getByText } = render(
      <ChartCard title="T" facts={{ value: '4', unit: 'h', period: ['a', 'b'] }} />,
    )
    expect(getByText(/a/).textContent).toBe('· a · b')
  })
  test('an empty list behind a unit renders no period', () => {
    const { container } = render(
      <ChartCard title="T" facts={{ value: '4', unit: 'h', period: [] }} />,
    )
    expect(container.querySelector('[data-basalt-fact]')?.textContent).toBe('4h')
  })
  test('no unit, no leading separator; an already-led item is not doubled', () => {
    const bare = render(<ChartCard title="T" facts={{ value: '4', period: ['basis'] }} />)
    expect(bare.getByText(/basis/).textContent).toBe('basis')
    bare.unmount()
    const led = render(
      <ChartCard title="T" facts={{ value: '4', unit: 'h', period: ['· basis'] }} />,
    )
    expect(led.getByText(/basis/).textContent).toBe('· basis')
  })
})

describe('whole-step ticks print integers (item 4)', () => {
  const ticks = (
    format: (v: number) => string,
    domain: [number, number],
    values?: number[],
    count?: number,
  ) => {
    const guide = yGuide({
      cfg:
        values !== undefined
          ? { ticks: values }
          : count !== undefined
            ? { ticks: count }
            : undefined,
      axis: { domain, format },
      cls: 'regular',
      side: 'left',
      grid: true,
    })
    const axis = guide.axis
    if (!axis) throw new Error('no axis')
    return (axis.ticks as { format: (v: number) => string }).format
  }
  const seconds = (v: number): string => `${v.toFixed(1)} s`
  const grouped = (locale: string) => (v: number) =>
    `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(v)} s`

  test('a formatter that pads a whole tick loses the `.0`', () => {
    const format = ticks(seconds, [0, 4], [0, 1, 2, 3, 4])
    expect([0, 1, 2, 4].map(format)).toEqual(['0 s', '1 s', '2 s', '4 s'])
  })
  test('a tick count over a whole-step domain goes the same way', () => {
    const format = ticks(seconds, [0, 4], undefined, 5)
    expect([0, 2, 4].map(format)).toEqual(['0 s', '2 s', '4 s'])
    const dflt = ticks(seconds, [0, 4])
    expect(dflt(2)).toBe('2 s')
  })
  test('a fractional step keeps its decimals', () => {
    const format = ticks(seconds, [0, 2], [0, 0.5, 1, 1.5, 2])
    expect([0, 0.5, 1].map(format)).toEqual(['0.0 s', '0.5 s', '1.0 s'])
    expect(ticks(seconds, [0, 1], undefined, 5)(1)).toBe('1.0 s')
  })
  test('a thousands group is never read as a decimal (en)', () => {
    const format = ticks(grouped('en-GB'), [0, 2000], [0, 1000, 2000])
    expect(format(1000)).toBe(`${new Intl.NumberFormat('en-GB').format(1000)} s`)
    const million = ticks((v) => new Intl.NumberFormat('en-GB').format(v), [0, 2e6], [0, 1e6, 2e6])
    expect(million(1_000_000)).toBe(new Intl.NumberFormat('en-GB').format(1_000_000))
  })
  test('de: `1.000,0 s` loses only the decimal zero; `1.000 s` is untouched', () => {
    defineFormat({ locale: 'de-DE' })
    const format = ticks(grouped('de-DE'), [0, 2000], [0, 1000, 2000])
    expect(format(1000)).toBe(`${new Intl.NumberFormat('de-DE').format(1000)} s`)
    const whole = ticks(
      (v) => `${new Intl.NumberFormat('de-DE').format(v)} s`,
      [0, 2000],
      [0, 1000, 2000],
    )
    expect(whole(1000)).toBe(`${new Intl.NumberFormat('de-DE').format(1000)} s`)
  })
})

describe('BandStrip glyph at a narrow cell (item 5)', () => {
  type Day = { t: string; s: 'ok' | 'warn' | 'bad' }
  const states: (BandStripSeries<Day> & { key: Day['s'] })[] = [
    { key: 'ok', label: 'OK', color: 'var(--vx-good)' },
    { key: 'warn', label: 'Warn', color: 'var(--vx-status-warn)', glyph: '!' },
    { key: 'bad', label: 'Bad', color: 'var(--vx-status-bad)', glyph: '×' },
  ]
  // SSR measures 640 px: n cells are 640 / n px wide.
  const strip = (n: number) =>
    dom(
      renderToString(
        <BandStrip
          ariaLabel="B"
          data={Array.from({ length: n }, (_, i) => ({
            t: `s${String(i).padStart(3, '0')}`,
            s: (['ok', 'warn', 'bad'] as const)[i % 3] as Day['s'],
          }))}
          x={(d) => d.t}
          states={states}
          getBand={(d) => ({ state: d.s })}
        />,
      ),
    )
  const glyphCount = (el: HTMLElement): number =>
    el.querySelectorAll('[data-ts-key="band-glyphs"] text').length

  const notches = (el: HTMLElement): Element[] => [
    ...el.querySelectorAll('[data-ts-key^="band-notches"] rect'),
  ]
  const bandBottom = (el: HTMLElement): number => {
    const band = el.querySelector('[data-ts-key="band-0"] rect')
    return Number(band?.getAttribute('y')) + Number(band?.getAttribute('height'))
  }

  test('a 16 px cell keeps its glyph and needs no notch', () => {
    const el = strip(40)
    expect(glyphCount(el)).toBe(26)
    expect(notches(el)).toHaveLength(0)
  })
  test('under 16 px the glyph drops and warn and bad get a notch instead', () => {
    const el = strip(41)
    expect(glyphCount(el)).toBe(0)
    // Two of every three cells are warn or bad: 27 of 41 are not `ok`.
    expect(notches(el)).toHaveLength(27)
  })
  test('warn is 3 px and bad 6 px, both flush with the cell bottom', () => {
    const el = strip(60)
    const bottom = bandBottom(el)
    const sizes = new Set<number>()
    for (const r of notches(el)) {
      const h = Number(r.getAttribute('height'))
      expect(Number(r.getAttribute('y')) + h).toBeCloseTo(bottom, 1)
      sizes.add(Math.round(h))
    }
    expect([...sizes].toSorted()).toEqual([3, 6])
  })
  test('the notch is the state fill pulled to the ink, not a panel cut-out', () => {
    const fills = notches(strip(60)).map((r) => r.getAttribute('fill'))
    expect(fills.every((f) => f?.includes('color-mix') && f.includes('--vx-ink'))).toBe(true)
    expect(fills.join()).not.toContain('--vx-surface-panel')
  })
  test('an ok cell draws no notch: only the warn and bad cells of 60 do', () => {
    expect(notches(strip(60))).toHaveLength(40)
  })
  test('a Heatmap keeps its own 12 px glyph threshold', () => {
    const cols = Array.from({ length: 44 }, (_, i) => String(i)) // 640 / 44 = 14.5 px
    const html = renderToString(
      <Heatmap
        ariaLabel="H"
        data={cols.map((c) => ({ row: 'a', col: c, s: 'down' as const }))}
        getRow={(d) => d.row}
        getCol={(d) => d.col}
        getValue={() => null}
        getState={(d) => d.s}
        states={[{ key: 'down', label: 'Down', tone: 'bad' }]}
      />,
    )
    expect(dom(html).querySelectorAll('[data-ts-key$="glyphs"] text').length).toBe(44)
  })
})

describe('an end label stays inside the plot (item 6)', () => {
  type Row = { t: Date; a: number | null }
  const day = (d: number): Date => new Date(Date.UTC(2026, 8, d))
  const A: ChartSeries<Row> = { key: 'a', label: 'Download', color: 'red', getValue: (d) => d.a }
  const plotOf = (
    data: Row[],
    plotHeight = 300,
    xDomain?: [Date, Date],
  ): PlotContext<Row, Date> => {
    const model = xScaleFor(
      data.map((d) => d.t),
      false,
      xDomain,
    )
    const rows = (): PlotRow<Row, Date>[] =>
      data.map((datum) => ({ x: datum.t, y: datum.a, series: 'a', datum }))
    return {
      rows,
      visible: [A],
      highlighted: null,
      containerClass: 'wide',
      width: 1000,
      height: plotHeight,
      plotWidth: 1000,
      plotHeight,
      data,
      xFraction: model.fraction,
      y2: undefined,
      yDomain: [0, 100],
      y2Domain: undefined,
    }
  }
  /** The label's centre, px from the plot bottom. */
  const centre = (data: Row[], plotHeight = 300, xDomain?: [Date, Date]): number => {
    const [label] = endLabelPlan(plotOf(data, plotHeight, xDomain), [A])
    if (!label) throw new Error('no label')
    const { dy } = endLabelOffset(label.anchor, label.side)
    return ((label.row.y as number) / 100) * plotHeight - (dy + label.nudge)
  }
  const half = 6
  test('a line rising into its last point near the top edge', () => {
    const c = centre([
      { t: day(1), a: 60 },
      { t: day(2), a: 99 },
    ])
    expect(c).toBeLessThanOrEqual(300 - half)
    expect(c).toBeGreaterThanOrEqual(half)
  })
  test('a line falling into its last point near the bottom edge', () => {
    const c = centre([
      { t: day(1), a: 60 },
      { t: day(2), a: 1 },
    ])
    expect(c).toBeGreaterThanOrEqual(half)
  })
  test('a label right of its point at the bottom edge', () => {
    const c = centre(
      [
        { t: day(1), a: 5 },
        { t: day(2), a: 1 },
      ],
      300,
      [day(1), day(20)],
    )
    expect(c).toBeGreaterThanOrEqual(half)
  })
  test('two series ending near the top edge stay apart and inside', () => {
    const B: ChartSeries<Row> = { key: 'b', label: 'Upload', color: 'blue', getValue: (d) => d.a }
    const data: Row[] = [
      { t: day(1), a: 90 },
      { t: day(2), a: 99 },
    ]
    const base = plotOf(data)
    const plot = { ...base, visible: [A, B], rows: (key: string) => base.rows(key) }
    const plan = endLabelPlan(plot, [A, { ...B, getValue: () => 98 }])
    const centres = plan.map((l) => {
      const { dy } = endLabelOffset(l.anchor, l.side)
      return ((l.row.y as number) / 100) * 300 - (dy + l.nudge)
    })
    expect(Math.max(...centres)).toBeLessThanOrEqual(300 - half)
    expect(Math.abs((centres[0] as number) - (centres[1] as number))).toBeGreaterThanOrEqual(13)
  })
})

describe('empty chart default (argo Wave 32)', () => {
  const emptyText = (state: { empty: true | string }): string =>
    dom(
      renderToString(
        <Lines ariaLabel="L" data={[]} x={(d: { t: Date }) => d.t} series={[]} state={state} />,
      ),
    ).textContent ?? ''
  test('says the range is empty, without the banned filler', () => {
    const text = emptyText({ empty: true })
    expect(text).toContain('Nothing recorded in this range')
    expect(text).not.toContain('No data')
  })
  test('a consumer label wins', () => {
    expect(emptyText({ empty: 'No runs yet' })).toContain('No runs yet')
  })
})
