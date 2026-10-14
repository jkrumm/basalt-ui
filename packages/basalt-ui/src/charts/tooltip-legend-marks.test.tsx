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
