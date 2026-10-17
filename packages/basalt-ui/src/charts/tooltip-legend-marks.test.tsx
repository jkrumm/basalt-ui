/**
 * Tooltip swatch shapes, reference-line legend entries, cursor dots for marks-drawn series and the
 * band edge rules. Compile-level where the definition says it, rendered where the engine does
 * (keys such as `zone-0-top` are the engine's `data-ts-key`).
 */
import { afterEach, describe, expect, test } from 'bun:test'
import type { ChartPoint } from '@tanstack/charts/types/core'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { CartesianChart } from './CartesianChart'
import { ChartLegend, LINE_SWATCH } from './legend'
import type { LegendMode } from './legend'
import { compileCartesian, dashedSwatch, engineRow, refLegendSeries } from './compile'
import type { CartesianDefinition } from './compile'
import { VX } from '../tokens'
import { contrastRatio } from '../tokens/hct'
import { STATUS, SURFACE } from '../tokens/palette'
import { chartCursor } from './cursor'
import { hoverPlot } from '../../tests/support/hover-plot'
import { Lines } from './Lines'
import type { ChartSeries, RefLine } from './types'

type Row = { t: Date; a: number | null; track: number | null; n: number }
const day = (d: number): Date => new Date(Date.UTC(2026, 8, d))
const data: Row[] = [1, 2, 3, 4].map((d) => ({
  t: day(d),
  a: d * 10,
  track: d === 3 ? null : d,
  n: d,
}))
const x = (d: Row): Date => d.t
const a: ChartSeries<Row> = {
  key: 'a',
  label: 'Alpha',
  color: 'var(--vx-line)',
  getValue: (d) => d.a,
}

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  chartCursor().setState(null)
  document.body.innerHTML = ''
})

async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => {
    root?.render(node)
  })
  return el
}

const ssr = (node: React.ReactNode): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el
}

const keyed = (el: Element, key: string): Element[] => [
  ...el.querySelectorAll(`g[data-ts-key="${key}"]`),
]

/** The one engine group with this key; a missing or duplicated one fails the test. */
function only(el: Element, key: string): Element {
  const found = keyed(el, key)
  const [group] = found
  if (found.length !== 1 || !group)
    throw new Error(`expected one "${key}" group, got ${found.length}`)
  return group
}

type TooltipContent = {
  title?: string | undefined
  rows: readonly { color?: string | undefined }[]
}

/** The definition's tooltip content for a hovered plot row of `series` at datum index `i`. */
function tooltipFor(def: CartesianDefinition, series: string, i: number): TooltipContent {
  const tooltip = def.tooltip
  if (!tooltip || !('content' in tooltip) || !tooltip.content) throw new Error('no tooltip')
  const datum = { x: day(i + 1), y: 0, series, datum: data[i] }
  // The engine builds a full point; the content function reads only these two fields.
  const point = { datum, xValue: day(i + 1) } as ChartPoint
  const context = {} as Parameters<typeof tooltip.content>[1]
  return tooltip.content([point], context)
}

describe('tooltip swatch', () => {
  test('a row swatch is solid unless it says dashed', () => {
    expect(engineRow({ label: 'L', value: 'V', color: 'red' })).toEqual({
      label: 'L',
      value: 'V',
      color: 'red',
    })
    expect(engineRow({ label: 'L', value: 'V', color: 'red', swatch: 'solid' }).color).toBe('red')
    expect(engineRow({ label: 'L', value: 'V', color: 'red', swatch: 'dashed' }).color).toBe(
      dashedSwatch('red'),
    )
    // No color, no swatch to shape; an explicit undefined is the same as omitted.
    expect(engineRow({ label: 'L', value: 'V', swatch: 'dashed' })).toEqual({
      label: 'L',
      value: 'V',
    })
    expect(engineRow({ label: 'L', value: 'V', color: undefined, swatch: undefined })).toEqual({
      label: 'L',
      value: 'V',
    })
  })

  test('a dashed series lists a dashed swatch, a consumer row picks its own', () => {
    const def = compileCartesian({
      chartId: 'sw',
      data,
      x,
      series: [a, { ...a, key: 'ref', label: 'Ref', dash: 'dashed' }],
      marks: () => [],
      tooltip: {
        rows: () => [{ label: 'Target', value: '50', color: 'var(--vx-good)', swatch: 'dashed' }],
      },
    })
    expect(tooltipFor(def, 'a', 1).rows.map((r) => r.color)).toEqual([
      'var(--vx-line)',
      dashedSwatch('var(--vx-line)'),
      dashedSwatch('var(--vx-good)'),
    ])
  })
})

describe('reference-line legend entries', () => {
  const refs: RefLine[] = [
    { value: 20, color: 'var(--vx-good)', dashed: true, legend: { label: 'MEV' } },
    { value: 30, color: 'var(--vx-bad)' },
    { value: 40, color: 'var(--vx-warn)', legend: { label: 'MAV', mark: 'bar' } },
  ]

  test('only the lines that name themselves become legend entries, role reference', () => {
    const entries = refLegendSeries<Row>(refs)
    expect(entries.map((e) => [e.key, e.label, e.role, e.mark, e.dash])).toEqual([
      ['__ref-0', 'MEV', 'reference', undefined, 'dashed'],
      ['__ref-2', 'MAV', 'reference', 'bar', undefined],
    ])
    const [first] = data
    if (!first) throw new Error('no data')
    expect(entries.every((e) => e.tooltip === false && e.getValue(first) === null)).toBe(true)
    expect(refLegendSeries(undefined)).toEqual([])
  })

  test('a translucent status line keeps a solid swatch that reads in both schemes', () => {
    const tone = {
      [VX.goodRef]: 'good',
      [VX.goodSoft]: 'good',
      [VX.good]: 'good',
      [VX.warnRef]: 'warn',
      [VX.warn]: 'warn',
      [VX.badRef]: 'bad',
      [VX.bad]: 'bad',
    } as const
    const solid = { good: VX.goodSolid, warn: VX.warnSolid, bad: VX.badSolid } as const
    for (const [color, t] of Object.entries(tone)) {
      const [entry] = refLegendSeries<Row>([{ value: 1, color, legend: { label: t } }])
      expect(entry?.color).toBe(solid[t])
      for (const scheme of ['light', 'dark'] as const)
        expect(contrastRatio(STATUS[t][scheme], SURFACE.panel[scheme])).toBeGreaterThanOrEqual(3)
    }
  })

  test('any other color, including an Object.prototype key, passes through', () => {
    const colors = ['var(--vx-axis)', 'constructor', 'toString']
    const entries = refLegendSeries<Row>(
      colors.map((color) => ({ value: 1, color, legend: { label: color } })),
    )
    expect(entries.map((e) => e.color)).toEqual(colors)
  })

  test('the legend lists them after the series; a line without `legend` adds none', () => {
    const el = ssr(<Lines ariaLabel="L" data={data} x={x} series={[a]} refLines={refs} />)
    const keys = [...el.querySelectorAll('[data-legend-key]')].map((n) =>
      n.getAttribute('data-legend-key'),
    )
    expect(keys).toEqual(['a', '__ref-0', '__ref-2'])
    expect(el.querySelector('[data-legend-key="__ref-0"]')?.textContent).toContain('MEV')
    expect(
      el.querySelector('[data-legend-key="__ref-0"] line')?.getAttribute('stroke-dasharray'),
    ).not.toBeNull()
  })

  test('mark "bar" draws a filled chip, not a line swatch', () => {
    const el = ssr(<Lines ariaLabel="L" data={data} x={x} series={[a]} refLines={refs} />)
    const bar = el.querySelector('[data-legend-key="__ref-2"]')
    expect(bar?.querySelector('svg')).toBeNull()
    const chip = [...(bar?.querySelectorAll('span') ?? [])].find((n) => n.style.width === '10px')
    expect(chip?.style.background).toBe('var(--vx-warn-solid)')
  })

  test('no `legend` on any line adds no reference entry', () => {
    const el = ssr(
      <Lines
        ariaLabel="L"
        data={data}
        x={x}
        series={[a]}
        refLines={[{ value: 20, color: 'red' }]}
      />,
    )
    expect(el.querySelector('[data-legend-key^="__ref"]')).toBeNull()
  })

  test('toggling the entry hides the line', async () => {
    const el = await mount(<Lines ariaLabel="L" data={data} x={x} series={[a]} refLines={refs} />)
    expect(keyed(el, 'ref-0').length).toBe(1)
    const toggle = el.querySelector('button[data-legend-key="__ref-0"]')
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('no toggle')
    await act(async () => {
      toggle.click()
    })
    expect(keyed(el, 'ref-0').length).toBe(0)
    expect(keyed(el, 'ref-1').length).toBe(1)
  })

  test('the toggle state is keyed by the line index, not its identity', async () => {
    const first: RefLine = { value: 20, color: 'var(--vx-good)', legend: { label: 'One' } }
    const second: RefLine = { value: 30, color: 'var(--vx-bad)', legend: { label: 'Two' } }
    const chart = (refLines: RefLine[]) => (
      <Lines ariaLabel="L" data={data} x={x} series={[a]} refLines={refLines} />
    )
    const el = await mount(chart([first, second]))
    const toggle = el.querySelector('button[data-legend-key="__ref-0"]')
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('no toggle')
    await act(async () => {
      toggle.click()
    })
    expect(keyed(el, 'ref-0').length).toBe(0)
    await act(async () => {
      root?.render(chart([second, first]))
    })
    // `second` now sits at index 0, so it is the one that is off.
    expect(keyed(el, 'ref-0').length).toBe(0)
    expect(keyed(el, 'ref-1').length).toBe(1)
  })

  test('a series key in the reserved `__ref-` namespace throws', () => {
    expect(() =>
      compileCartesian({
        chartId: 'reserved',
        data,
        x,
        series: [{ ...a, key: '__ref-0' }],
        marks: () => [],
      }),
    ).toThrow(/reserved/)
  })
})

describe('cursorValue dots', () => {
  const track: ChartSeries<Row> = {
    key: 'track',
    label: 'Track',
    color: 'var(--vx-accent)',
    getValue: () => null,
    cursorValue: (d) => d.track,
  }
  const chart = (series: ChartSeries<Row>[], extra: object = {}) => (
    <CartesianChart ariaLabel="C" data={data} x={x} series={series} marks={() => []} {...extra} />
  )
  const dotsOf = (el: Element, key: string): Element[] => [
    ...only(el, `${key}-cursor`).querySelectorAll('circle'),
  ]

  test('a dot per datum with a finite value, in the series color, hidden until the cursor', () => {
    const dots = dotsOf(ssr(chart([a, track])), 'track')
    expect(dots.length).toBe(3)
    expect(dots.every((c) => c.getAttribute('fill') === 'var(--vx-accent)')).toBe(true)
    expect(dots.every((c) => c.getAttribute('fill-opacity') === '0')).toBe(true)
  })

  test('NaN, Infinity and null values draw no dot', () => {
    const odd: ChartSeries<Row> = {
      ...track,
      cursorValue: (d) => [Number.NaN, Number.POSITIVE_INFINITY, null, 4][d.n - 1] ?? null,
    }
    expect(dotsOf(ssr(chart([a, odd])), 'track').length).toBe(1)
  })

  test('a series without cursorValue draws none, and a legend toggle drops the dots', async () => {
    expect(keyed(ssr(chart([a])), 'a-cursor').length).toBe(0)
    const el = await mount(chart([a, track]))
    expect(keyed(el, 'track-cursor').length).toBe(1)
    const toggle = el.querySelector('button[data-legend-key="track"]')
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('no toggle')
    await act(async () => {
      toggle.click()
    })
    expect(keyed(el, 'track-cursor').length).toBe(0)
  })

  test('a right-axis series places its dots on the right scale', () => {
    const left: ChartSeries<Row> = { ...track, key: 'left', cursorValue: () => 5 }
    const right: ChartSeries<Row> = { ...track, key: 'right', axis: 'right', cursorValue: () => 5 }
    const el = ssr(chart([a, left, right], { y: { domain: [0, 1000] }, y2: { domain: [0, 10] } }))
    const cy = (key: string): number => Number(dotsOf(el, key)[0]?.getAttribute('cy'))
    // 5 of 10 sits mid-plot; 5 of 1000 sits at the bottom.
    expect(cy('right')).toBeLessThan(cy('left'))
  })

  test('a series with both getValue and cursorValue gets one cursor dot per datum', () => {
    const both: ChartSeries<Row> = { ...a, cursorValue: (d) => d.a }
    const el = ssr(chart([both]))
    expect(dotsOf(el, 'a').length).toBe(data.length)
    expect(keyed(el, 'a-cursor').length).toBe(1)
  })

  test('hovering a datum shows exactly its dot', async () => {
    const el = await mount(chart([a, track]))
    const svg = el.querySelector('svg')
    if (!svg) throw new Error('no chart')
    await act(async () => {
      svg.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 200, clientY: 40, bubbles: true }),
      )
      await new Promise((r) => setTimeout(r, 30))
    })
    const shown = dotsOf(el, 'track').filter((c) => c.getAttribute('fill-opacity') === '1')
    expect(shown.length).toBe(1)
  })

  test('the dots are focus points: the tooltip reaches the datum through them', () => {
    const def = compileCartesian({ chartId: 'cv', data, x, series: [a, track], marks: () => [] })
    // A dot's datum is a plot row of the series; its source datum feeds the other series' rows.
    expect(tooltipFor(def, 'track', 1).rows.length).toBe(1)
  })
})

describe('band edge rules', () => {
  const edge = { color: 'var(--vx-accent)' }
  const zoned = (z: object) =>
    ssr(
      <Lines
        ariaLabel="L"
        data={data}
        x={x}
        series={[a]}
        y={{ domain: [0, 50] }}
        zones={[{ from: 15, to: 35, fill: 'var(--vx-good)', ...z }]}
      />,
    )
  const edges = (el: Element): string[] =>
    ['zone-0-top', 'zone-0-bottom'].filter((k) => keyed(el, k).length === 1)

  test('top, bottom or both; none without `edge`', () => {
    expect(edges(zoned({}))).toEqual([])
    expect(edges(zoned({ edge: { ...edge, side: 'top' } }))).toEqual(['zone-0-top'])
    expect(edges(zoned({ edge: { ...edge, side: 'bottom' } }))).toEqual(['zone-0-bottom'])
    expect(edges(zoned({ edge: { ...edge, side: 'both' } }))).toEqual([
      'zone-0-top',
      'zone-0-bottom',
    ])
  })

  test('reversed bounds: top is the visually higher one', () => {
    const el = zoned({ from: 35, to: 15, edge: { ...edge, side: 'both' } })
    expect(edges(el)).toEqual(['zone-0-top', 'zone-0-bottom'])
    const y = (key: string): number =>
      Number(only(el, key).querySelector('line')?.getAttribute('y1'))
    expect(y('zone-0-top')).toBeLessThan(y('zone-0-bottom'))
  })

  test('a bound at the plot edge draws no rule: infinite, past the domain, or exactly on it', () => {
    const both = { ...edge, side: 'both' as const }
    expect(edges(zoned({ to: Infinity, edge: both }))).toEqual(['zone-0-bottom'])
    expect(edges(zoned({ to: 80, edge: both }))).toEqual(['zone-0-bottom'])
    expect(edges(zoned({ from: -20, edge: both }))).toEqual(['zone-0-top'])
    expect(edges(zoned({ from: 0, edge: both }))).toEqual(['zone-0-top'])
    expect(edges(zoned({ to: 50, edge: both }))).toEqual(['zone-0-bottom'])
  })

  test('paint: color, width and dash', () => {
    const el = zoned({ edge: { ...edge, side: 'top', width: 2, dashed: true } })
    const line = only(el, 'zone-0-top').querySelector('line')
    expect(line?.getAttribute('stroke')).toBe('var(--vx-accent)')
    expect(line?.getAttribute('stroke-width')).toBe('2')
    expect(line?.getAttribute('stroke-dasharray')).not.toBeNull()
  })

  const xzoned = (z: object) =>
    ssr(
      <Lines
        ariaLabel="L"
        data={data}
        x={x}
        series={[a]}
        xZones={[{ from: day(2), to: day(3), fill: 'var(--vx-good)', ...z }]}
      />,
    )
  const xEdges = (el: Element): string[] =>
    ['xzone-0-start', 'xzone-0-end'].filter((k) => keyed(el, k).length === 1)
  const both = { ...edge, side: 'both' as const }

  test('x-zone: start, end or both, and none for an omitted bound', () => {
    expect(xEdges(xzoned({}))).toEqual([])
    expect(xEdges(xzoned({ edge: { ...edge, side: 'start' } }))).toEqual(['xzone-0-start'])
    expect(xEdges(xzoned({ edge: { ...edge, side: 'end' } }))).toEqual(['xzone-0-end'])
    expect(xEdges(xzoned({ edge: both }))).toEqual(['xzone-0-start', 'xzone-0-end'])
    expect(xEdges(xzoned({ to: undefined, edge: both }))).toEqual(['xzone-0-start'])
  })

  test('x-zone: a bound outside the displayed x domain or exactly on its edge draws no rule', () => {
    expect(xEdges(xzoned({ from: day(-5), edge: both }))).toEqual(['xzone-0-end'])
    expect(xEdges(xzoned({ to: day(20), edge: both }))).toEqual(['xzone-0-start'])
    // The first and last samples are the domain's edges.
    expect(xEdges(xzoned({ from: day(1), edge: both }))).toEqual(['xzone-0-end'])
    expect(xEdges(xzoned({ to: day(4), edge: both }))).toEqual(['xzone-0-start'])
    // `align: 'edge'` widens a bound by half a step, which pushes an end-sample bound past the edge.
    expect(xEdges(xzoned({ to: day(4), align: 'edge', edge: both }))).toEqual(['xzone-0-start'])
  })

  test('x-zone: an infinite bound on a numeric x draws no rule', () => {
    const el = ssr(
      <Lines
        ariaLabel="L"
        data={data}
        x={(d) => d.n}
        series={[a]}
        xZones={[{ from: 2, to: Infinity, fill: 'var(--vx-good)', edge: both }]}
      />,
    )
    expect(xEdges(el)).toEqual(['xzone-0-start'])
  })
})

describe('cursor dot per-datum colour (getMarker on a cursorValue series)', () => {
  const colorOf = (d: Row): { color: string } => ({ color: `var(--c${d.n})` })
  const tracked = (marker: ChartSeries<Row>['getMarker']): ChartSeries<Row> => ({
    key: 'track',
    label: 'Track',
    color: 'var(--vx-accent)',
    getValue: () => null,
    cursorValue: (d) => d.track,
    ...(marker && { getMarker: marker }),
  })
  const chart = (series: ChartSeries<Row>, rows: Row[] = data) => (
    <CartesianChart ariaLabel="C" data={rows} x={x} series={[a, series]} marks={() => []} />
  )
  const marksOf = (el: Element): Element[] => [
    ...el.querySelectorAll('g[data-ts-key^="track-cursor"]'),
  ]
  const shownFills = (el: Element): string[] =>
    [...el.querySelectorAll('g[data-ts-key="track-cursor"] circle')]
      .filter((c) => c.getAttribute('fill-opacity') === '1')
      .map((c) => c.getAttribute('fill') ?? '')

  test('however many colours a series has, its cursor dots are ONE mark', () => {
    const many: Row[] = Array.from({ length: 40 }, (_, i) => ({
      t: day(1 + i),
      a: i,
      track: i,
      n: i,
    }))
    const el = ssr(chart(tracked(colorOf), many))
    expect(marksOf(el).map((g) => g.getAttribute('data-ts-key'))).toEqual(['track-cursor'])
    expect(el.querySelectorAll('g[data-ts-key="track-cursor"] circle').length).toBe(40)
  })

  test('the focused dot takes the datum colour from getMarker, not the series colour', async () => {
    const el = await mount(chart(tracked(colorOf)))
    await hoverPlot(el.querySelector('svg'))
    const fills = shownFills(el)
    expect(fills.length).toBe(1)
    expect(fills[0]).toMatch(/^var\(--c[1-4]\)$/)
  })

  test('a datum getMarker returns null for keeps the series colour', async () => {
    const el = await mount(chart(tracked(() => null)))
    await hoverPlot(el.querySelector('svg'))
    expect(shownFills(el)).toEqual(['var(--vx-accent)'])
  })

  test('5,000 rows stay in linear time in one mark', () => {
    const big: Row[] = Array.from({ length: 5000 }, (_, i) => ({
      t: new Date(Date.UTC(2020, 0, 1) + i * 3_600_000),
      a: i,
      track: i,
      n: i,
    }))
    const start = performance.now()
    const el = ssr(chart(tracked(colorOf), big))
    const ms = performance.now() - start
    expect(marksOf(el).length).toBe(1)
    expect(ms).toBeLessThan(3000)
  })
})

describe('legend swatch follows the series mark in every mode', () => {
  const solid: ChartSeries<Row> = { ...a, key: 's', label: 'Solid' }
  const dashed: ChartSeries<Row> = { ...a, key: 'd', label: 'Dashed', dash: 'dashed' }
  const bar: ChartSeries<Row> = { ...a, key: 'b', label: 'Bar', mark: 'bar' }
  const legend = (mode: LegendMode): HTMLElement =>
    ssr(
      <ChartLegend
        series={[solid, dashed, bar]}
        hidden={new Set()}
        mode={mode}
        groups={false}
        toggle={false}
        onToggle={() => {}}
        onHighlight={() => {}}
      />,
    )
  const swatches = (el: Element, key: string): Element[] => [
    ...(el
      .querySelector(`[data-legend-key="${key}"]`)
      ?.querySelectorAll(':scope > [aria-hidden]') ?? []),
  ]
  const stroke = (swatch: Element | undefined) => ({
    width: swatch?.getAttribute('width'),
    dash: swatch?.querySelector('line')?.getAttribute('stroke-dasharray') ?? null,
    cap: swatch?.querySelector('line')?.getAttribute('stroke-linecap'),
  })

  test('the line key never shrinks below a dash: literal floors, not the table', () => {
    expect(LINE_SWATCH.compact.width).toBeGreaterThanOrEqual(14)
    expect(LINE_SWATCH.wide.width).toBeGreaterThanOrEqual(14)
    expect(LINE_SWATCH.compact.dash).toBe('4 3')
    expect(LINE_SWATCH.wide.dash).toBe('4 3')
    const el = legend('dots')
    expect(swatches(el, 'd')[0]?.getAttribute('width')).toBe('14')
    expect(swatches(el, 'd')[0]?.querySelector('line')?.getAttribute('stroke-dasharray')).toBe(
      '4 3',
    )
  })

  test('the dots legend caps its hit areas at the 30px entry gap', () => {
    const row = legend('dots').querySelector('[data-legend-key]')?.parentElement
    expect(row?.style.getPropertyValue('--vx-hit-gap')).toBe('30px')
  })

  test('dots mode: a line series is a 14px stroke (dash kept), never a dot', () => {
    const el = legend('dots')
    expect(swatches(el, 's').map((n) => n.tagName)).toEqual(['svg'])
    expect(stroke(swatches(el, 's')[0])).toEqual({
      width: String(LINE_SWATCH.compact.width),
      dash: null,
      cap: 'round',
    })
    expect(stroke(swatches(el, 'd')[0])).toEqual({
      width: String(LINE_SWATCH.compact.width),
      dash: LINE_SWATCH.compact.dash,
      cap: 'butt',
    })
  })

  test('chips mode: a line series is a 16px stroke (dash kept)', () => {
    const el = legend('chips')
    expect(stroke(swatches(el, 's')[0])).toEqual({
      width: String(LINE_SWATCH.wide.width),
      dash: null,
      cap: 'round',
    })
    expect(stroke(swatches(el, 'd')[0])).toEqual({
      width: String(LINE_SWATCH.wide.width),
      dash: LINE_SWATCH.wide.dash,
      cap: 'butt',
    })
  })

  test('auto mode renders the compact and the wide stroke, CSS picks one', () => {
    const el = legend('auto')
    expect(swatches(el, 'd').map((n) => stroke(n).width)).toEqual([
      String(LINE_SWATCH.compact.width),
      String(LINE_SWATCH.wide.width),
    ])
    expect(swatches(el, 'd').every((n) => n.tagName === 'svg')).toBe(true)
  })

  test('a bar series still swaps between the dot and the chip', () => {
    const el = legend('auto')
    expect(swatches(el, 'b').map((n) => n.tagName)).toEqual(['SPAN', 'SPAN'])
  })
})

describe('hover readout semantics', () => {
  test('the floating readout carries role="tooltip" and stays a live region', async () => {
    const el = await mount(<Lines ariaLabel="L" data={data} x={x} series={[a]} />)
    await hoverPlot(el.querySelector('svg'))
    const tip = document.querySelector('.ts-chart-tooltip')
    expect(tip?.getAttribute('role')).toBe('tooltip')
    expect(tip?.getAttribute('aria-live')).toBe('polite')
  })
})
