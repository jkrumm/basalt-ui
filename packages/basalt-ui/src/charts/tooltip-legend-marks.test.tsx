/**
 * Argo friction rows 30-33: tooltip swatch shapes, reference-line legend entries, a cursor dot for a
 * marks-drawn series, and the band edge rules. Compile-level where the definition says it, rendered
 * where the engine does (keys such as `zone-0-top` are the engine's `data-ts-key`).
 */
import { afterEach, describe, expect, test } from 'bun:test'
import type { ChartPoint } from '@tanstack/charts/types/core'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { CartesianChart } from './CartesianChart'
import { compileCartesian, dashedSwatch, engineRow, refLegendSeries } from './compile'
import { chartCursor } from './cursor'
import { Lines } from './Lines'
import type { ChartSeries } from './types'

type Row = { t: Date; a: number | null; track: number | null }
const day = (d: number): Date => new Date(Date.UTC(2026, 8, d))
const data: Row[] = [1, 2, 3, 4].map((d) => ({ t: day(d), a: d * 10, track: d === 3 ? null : d }))
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

function rowsOf(def: ReturnType<typeof compileCartesian>, i: number) {
  const tooltip = def.tooltip
  if (!tooltip || !('content' in tooltip) || !tooltip.content) throw new Error('no tooltip')
  const datum = { x: day(i), y: 0, series: 'a', datum: data[i - 1] }
  return tooltip.content([{ datum, xValue: day(i) } as ChartPoint], {} as never).rows
}

describe('row 30: tooltip swatch', () => {
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
    const colors = rowsOf(def, 2).map((r) => r.color)
    expect(colors).toEqual([
      'var(--vx-line)',
      dashedSwatch('var(--vx-line)'),
      dashedSwatch('var(--vx-good)'),
    ])
  })
})

describe('row 31: reference-line legend entries', () => {
  const refs = [
    { value: 20, color: 'var(--vx-good)', dashed: true, legend: { label: 'MEV' } },
    { value: 30, color: 'var(--vx-bad)' },
    { value: 40, color: 'var(--vx-warn)', legend: { label: 'MAV', mark: 'bar' as const } },
  ]

  test('only the lines that name themselves become legend entries, role reference', () => {
    const entries = refLegendSeries<Row>(refs)
    expect(entries.map((e) => [e.key, e.label, e.role, e.mark, e.dash])).toEqual([
      ['__ref-0', 'MEV', 'reference', undefined, 'dashed'],
      ['__ref-2', 'MAV', 'reference', 'bar', undefined],
    ])
    expect(entries.every((e) => e.tooltip === false && e.getValue(data[0] as Row) === null)).toBe(
      true,
    )
    expect(refLegendSeries(undefined)).toEqual([])
  })

  test('the legend lists them after the series, with no tooltip row', () => {
    const el = ssr(<Lines ariaLabel="L" data={data} x={x} series={[a]} refLines={refs} />)
    const keys = [...el.querySelectorAll('[data-legend-key]')].map((n) =>
      n.getAttribute('data-legend-key'),
    )
    expect(keys).toEqual(['a', '__ref-0', '__ref-2'])
    expect(el.querySelector('[data-legend-key="__ref-0"]')?.textContent).toContain('MEV')
    const dashed = el.querySelector('[data-legend-key="__ref-0"] line')
    expect(dashed?.getAttribute('stroke-dasharray')).not.toBeNull()
    // Without `legend` a line adds no entry.
    const plain = ssr(
      <Lines
        ariaLabel="L"
        data={data}
        x={x}
        series={[a]}
        refLines={[{ value: 20, color: 'red' }]}
      />,
    )
    expect(plain.querySelector('[data-legend-key^="__ref"]')).toBeNull()
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
})

describe('row 33a: cursorValue', () => {
  const track: ChartSeries<Row> = {
    key: 'track',
    label: 'Track',
    color: 'var(--vx-accent)',
    getValue: () => null,
    cursorValue: (d) => d.track,
  }
  const chart = (series: ChartSeries<Row>[]) => (
    <CartesianChart ariaLabel="C" data={data} x={x} series={series} marks={() => []} />
  )

  test('a dot per datum with a finite value, in the series color, hidden until the cursor', () => {
    const el = ssr(chart([a, track]))
    const dots = [...keyed(el, 'track-cursor')[0]!.querySelectorAll('circle')]
    expect(dots.length).toBe(3)
    expect(dots.every((c) => c.getAttribute('fill') === 'var(--vx-accent)')).toBe(true)
    expect(dots.every((c) => c.getAttribute('fill-opacity') === '0')).toBe(true)
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
    const shown = [...keyed(el, 'track-cursor')[0]!.querySelectorAll('circle')].filter(
      (c) => c.getAttribute('fill-opacity') === '1',
    )
    expect(shown.length).toBe(1)
  })

  test('the dots are focus points: the tooltip reaches the datum through them', () => {
    const def = compileCartesian({
      chartId: 'cv',
      data,
      x,
      series: [a, track],
      marks: () => [],
    })
    // A dot's datum is a plot row of the series; its source datum feeds the other series' rows.
    const tooltip = def.tooltip
    if (!tooltip || !('content' in tooltip) || !tooltip.content) throw new Error('no tooltip')
    const datum = { x: day(2), y: 2, series: 'track', datum: data[1] }
    const content = tooltip.content([{ datum, xValue: day(2) } as ChartPoint], {} as never)
    expect(content.rows.map((r) => r.label)).toEqual(['Alpha'])
  })
})

describe('row 33c: band edge rules', () => {
  const zone = { from: 15, to: 35, fill: 'var(--vx-good)' }
  const edge = { color: 'var(--vx-accent)' }
  const zoned = (z: object) =>
    ssr(
      <Lines
        ariaLabel="L"
        data={data}
        x={x}
        series={[a]}
        y={{ domain: [0, 50] }}
        zones={[{ ...zone, ...z }]}
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

  test('a bound at the plot edge (infinite, or outside the domain) draws no rule', () => {
    const el = zoned({ to: Infinity, edge: { ...edge, side: 'both' } })
    expect(edges(el)).toEqual(['zone-0-bottom'])
  })

  test('paint: color, width and dash', () => {
    const el = zoned({ edge: { ...edge, side: 'top', width: 2, dashed: true } })
    const line = keyed(el, 'zone-0-top')[0]!.querySelector('line')
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

  test('x-zone: start, end or both, and none for an omitted bound', () => {
    expect(xEdges(xzoned({}))).toEqual([])
    expect(xEdges(xzoned({ edge: { ...edge, side: 'start' } }))).toEqual(['xzone-0-start'])
    expect(xEdges(xzoned({ edge: { ...edge, side: 'end' } }))).toEqual(['xzone-0-end'])
    expect(xEdges(xzoned({ edge: { ...edge, side: 'both' } }))).toEqual([
      'xzone-0-start',
      'xzone-0-end',
    ])
    expect(xEdges(xzoned({ to: undefined, edge: { ...edge, side: 'both' } }))).toEqual([
      'xzone-0-start',
    ])
  })
})
