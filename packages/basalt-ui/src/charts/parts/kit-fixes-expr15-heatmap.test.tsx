/**
 * Expression cycle 15 kit fixes, the Heatmap group (`v3-expr-15-kit-fixes` 9): a note that is too wide
 * for its own cell drops that cell's note alone, and a dimmed state cell fades like the value ramp.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { DIMMED } from '../core/theme'
import { useChartFocus } from '../focus'
import { Heatmap } from './heatmap'

type Cell = { row: string; col: string; v: number | null; s?: 'up' }
const COLS = ['0', '1', '2', '3', '4', '5', '6', '7']
const ROW: Cell[] = COLS.map((col, i) => ({ row: 'a', col, v: i + 1 }))
const STATED: Cell[] = [
  { row: 'a', col: '0', v: 3 },
  { row: 'a', col: '1', v: null, s: 'up' },
]
const STATES = [{ key: 'up', label: 'Up', tone: 'good' }] as const

const getRow = (d: Cell) => d.row
const getCol = (d: Cell) => d.col
const getValue = (d: Cell) => d.v
const getState = (d: Cell) => d.s

let root: ReturnType<typeof createRoot> | undefined
const rect = HTMLElement.prototype.getBoundingClientRect
beforeEach(() => {
  // A 390 px card: the cell is 390 / 8 px wide, too narrow for a note of nine characters.
  HTMLElement.prototype.getBoundingClientRect = function (): DOMRect {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 390,
      bottom: 300,
      width: 390,
      height: 300,
      toJSON: () => ({}),
    } as DOMRect
  }
})
afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = rect
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

const notes = (el: HTMLElement) =>
  [...el.querySelectorAll('g[data-ts-key="annotations"] text')].map((t) => t.textContent)

describe('a Heatmap note keeps its own cell', () => {
  test('one note too wide for its cell drops that note alone, the narrow ones draw', async () => {
    const el = await mount(
      <Heatmap
        label="Week"
        data={ROW}
        getRow={getRow}
        getCol={getCol}
        getValue={getValue}
        annotate={(d) => (d.col === '0' ? 'Fri 14:00' : String(d.v))}
      />,
    )
    const drawn = notes(el)
    expect(drawn).not.toContain('Fri 14:00')
    expect(drawn).toEqual(['2', '3', '4', '5', '6', '7', '8'])
  })
})

function Focused(): ReactElement {
  const focus = useChartFocus(STATED, { announce: (d) => `${d.row}${d.col}` })
  return (
    <Heatmap
      label="Grid"
      data={STATED}
      getRow={getRow}
      getCol={getCol}
      getValue={getValue}
      getState={getState}
      states={STATES}
      focus={focus}
    />
  )
}

describe('a dimmed Heatmap state cell', () => {
  test('fades at DIMMED of its fill, as the value ramp does, not through a darkening mix', async () => {
    const el = await mount(<Focused />)
    await act(async () => {
      el.querySelector('[data-chart-focus]')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      )
    })
    const cell = el.querySelector('g[data-ts-key="state:up"] rect')
    expect(cell).not.toBeNull()
    expect(cell?.getAttribute('fill') ?? '').not.toContain('light-dark')
    expect(Number(cell?.getAttribute('fill-opacity'))).toBe(DIMMED)
  })
})
