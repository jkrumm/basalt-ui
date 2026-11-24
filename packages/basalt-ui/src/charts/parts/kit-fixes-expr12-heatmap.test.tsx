/**
 * Expression cycle 12 kit fixes (`v3-expr-12-kit-fixes` 5): a Heatmap draws a held span. A list
 * row that holds a run of cells through `focus.hold` (a `BarList` row on `focusItems` holding one
 * source's cells) lights every one of them, not only the first.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act, useEffect } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { useChartFocus } from '../focus'
import type { ChartFocus } from '../focus'
import { Heatmap } from './heatmap'

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

type Cell = { row: string; col: string; v: number }
const CELLS: readonly Cell[] = ['Mail', 'Alerts', 'Docs'].flatMap((row) =>
  ['0', '1', '2', '3'].map((col, i) => ({ row, col, v: 1 + i })),
)
const handle: { focus?: ChartFocus<Cell> } = {}

function Harness(): ReactElement {
  const focus = useChartFocus(CELLS, { announce: (d) => `${d.row} ${d.col}` })
  useEffect(() => {
    handle.focus = focus
  })
  return (
    <Heatmap
      label="Messages"
      data={CELLS}
      getRow={(d) => d.row}
      getCol={(d) => d.col}
      getValue={(d) => d.v}
      focus={focus}
    />
  )
}

async function mount(): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => {
    root?.render(<Harness />)
  })
  return el
}

/** The cells drawn at full ink beside the dimmed rest: the focused mark's rects. */
const lit = (el: HTMLElement): number =>
  el.querySelectorAll('[data-ts-key="cells:focused"] rect, rect[data-ts-key="cells:focused"]')
    .length

const rings = (el: HTMLElement): number =>
  el.querySelectorAll('[data-ts-key="focus-ring"] rect, rect[data-ts-key="focus-ring"]').length

describe('Heatmap focus', () => {
  test('one focused datum lights one cell', async () => {
    const el = await mount()
    await act(async () => handle.focus?.set(1))
    expect(lit(el)).toBe(1)
    expect(rings(el)).toBe(1)
  })

  test("a row's held span lights every cell it holds", async () => {
    const el = await mount()
    // The four cells of the second source, as a BarList row on focusItems holds them.
    await act(async () => handle.focus?.hold([4, 5, 6, 7]))
    expect(handle.focus?.span).toHaveLength(4)
    expect(lit(el)).toBe(4)
    expect(rings(el)).toBe(4)
  })
})
