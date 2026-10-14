/**
 * Argo friction row 30: tooltip swatch shapes. Compile-level: the definition's tooltip content says
 * what the engine will paint.
 */
import { describe, expect, test } from 'bun:test'
import type { ChartPoint } from '@tanstack/charts/types/core'
import { compileCartesian, dashedSwatch, engineRow } from './compile'
import type { ChartSeries } from './types'

type Row = { t: Date; a: number | null }
const day = (d: number): Date => new Date(Date.UTC(2026, 8, d))
const data: Row[] = [1, 2, 3, 4].map((d) => ({ t: day(d), a: d * 10 }))
const x = (d: Row): Date => d.t
const a: ChartSeries<Row> = {
  key: 'a',
  label: 'Alpha',
  color: 'var(--vx-line)',
  getValue: (d) => d.a,
}

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
