/**
 * Expression cycle 16 kit fixes, the Heatmap group (`v3-expr-16-kit-fixes` 2 and 9): the x ticks beside
 * `tickCols` step evenly or add none (n77 at 390, n78 at 1800), and a state's legend key draws the glyph
 * its cells draw (n77).
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Heatmap, colTicks } from './heatmap'

const days = (n: number): string[] => Array.from({ length: n }, (_, i) => String(i))
const gaps = (cols: readonly string[], ticks: readonly string[]): number[] =>
  ticks.slice(1).map((t, i) => cols.indexOf(t) - cols.indexOf(ticks[i] as string))

describe('colTicks beside tickCols', () => {
  test('n77 at 390: every column named, 14 days in a 290 px plot, steps evenly', () => {
    const cols = days(14)
    const ticks = colTicks(cols, cols, 'narrow', { cellPx: 290 / 14, labelPx: 33 })
    expect(ticks.length).toBeGreaterThan(3)
    expect(Math.min(...gaps(cols, ticks))).toBeGreaterThanOrEqual(2)
    expect(new Set(gaps(cols, ticks)).size).toBe(1)
  })

  test('n78 at 1800: weekly names keep their step, no stride tick is added between them', () => {
    const cols = days(30)
    const weekly = [0, 7, 14, 21, 28].map(String)
    const ticks = colTicks(cols, weekly, 'wide', { cellPx: 50, labelPx: 33 })
    expect(ticks).toEqual(weekly)
  })

  test('stride ticks are added only when they and the named ones share one step', () => {
    const cols = days(24)
    const room = { cellPx: 30, labelPx: 14 }
    expect(colTicks(cols, ['12'], 'wide', room)).toEqual(['0', '4', '8', '12', '16', '20'])
    expect(colTicks(cols, ['21'], 'wide', room)).toEqual(['21'])
  })

  test('with no named column the stride ticks stand unchanged', () => {
    const cols = days(24)
    expect(colTicks(cols, undefined, 'wide')).toEqual(colTicks(cols, [], 'wide'))
  })
})

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

async function mount(node: ReactElement): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => root?.render(node))
  await act(async () => new Promise((r) => setTimeout(r, 20)))
  return el
}

type Cell = { row: string; col: string; v: number | null; s?: 'bad' | 'plain' | 'custom' }
const CELLS: Cell[] = [
  { row: 'a', col: '1', v: 3 },
  { row: 'a', col: '2', v: null, s: 'bad' },
  { row: 'a', col: '3', v: null, s: 'plain' },
  { row: 'a', col: '4', v: null, s: 'custom' },
]
const STATES = [
  { key: 'bad', label: 'Failed', tone: 'bad' },
  { key: 'plain', label: 'Clean', tone: 'good' },
  { key: 'custom', label: 'In flight', tone: 'neutral', glyph: '…' },
] as const

describe('a Heatmap state key', () => {
  test('draws the glyph its cells draw, and none where the state has none', async () => {
    const el = await mount(
      <Heatmap
        label="Grid"
        data={CELLS}
        getRow={(d: Cell) => d.row}
        getCol={(d: Cell) => d.col}
        getValue={(d: Cell) => d.v}
        getState={(d: Cell) => d.s}
        states={STATES}
      />,
    )
    const glyphOfKey = (key: string) =>
      el.querySelector(`[data-legend-key="${key}"] [data-legend-glyph]`)?.textContent ?? null
    expect(glyphOfKey('bad')).toBe('×')
    expect(glyphOfKey('custom')).toBe('…')
    expect(glyphOfKey('plain')).toBeNull()
    const cellGlyphs = [...el.querySelectorAll('g[data-ts-key="state-glyphs"] text')].map(
      (t) => t.textContent,
    )
    expect(cellGlyphs).toContain('×')
  })
})
