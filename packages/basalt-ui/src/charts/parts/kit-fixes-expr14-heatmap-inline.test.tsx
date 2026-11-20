/**
 * Expression cycle 14 (`v3-expr-14-kit-fixes` 8): a focused Heatmap whose `getRow`, `getCol` and `getValue`
 * are inline arrows (a new function every render, as in a build without the React Compiler) settles: a
 * pointer over a cell focuses it and the grid draws once more, never a render loop (React error 185).
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { useChartFocus } from '../focus'
import { Heatmap } from './heatmap'

type Cell = { row: string; col: string; v: number | null }
const CELLS: Cell[] = [
  { row: 'Mon', col: '0', v: 2 },
  { row: 'Mon', col: '1', v: 5 },
  { row: 'Tue', col: '0', v: 8 },
  { row: 'Tue', col: '1', v: null },
]

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

function Inline(): ReactElement {
  const focus = useChartFocus(CELLS, { announce: (d) => `${d.row} ${d.col}` })
  return (
    <Heatmap
      label="Cells"
      data={CELLS}
      getRow={(c) => c.row}
      getCol={(c) => c.col}
      getValue={(c) => c.v}
      getState={(c) => (c.v === null ? undefined : undefined)}
      annotate={(c) => (c.v === null ? null : String(c.v))}
      focus={focus}
    />
  )
}

describe('the Heatmap doc names the stable-identity requirement', () => {
  test('beside getState and tickCols it lists getRow, getCol and getValue', () => {
    const doc = readFileSync(join(import.meta.dirname, '../../../docs/heatmap.md'), 'utf8')
    const line = doc.split('\n').find((l) => l.includes('need a stable identity')) ?? ''
    for (const name of ['getRow', 'getCol', 'getValue', 'getState', 'tickCols']) {
      expect(line.includes(name) || doc.includes(`\`${name}\``), name).toBe(true)
    }
    const para = doc.slice(
      doc.indexOf('need a stable identity') - 160,
      doc.indexOf('need a stable identity') + 40,
    )
    for (const name of ['getRow', 'getCol', 'getValue', 'getState', 'tickCols'])
      expect(para, name).toContain(name)
  })
})

describe('a focused Heatmap with inline accessors', () => {
  test('settles after a pointer focus, never loops', async () => {
    const errors: unknown[] = []
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el, { onUncaughtError: (e) => errors.push(e) })
    await act(async () => {
      root?.render(<Inline />)
    })
    const svg = el.querySelector('svg')
    expect(svg).not.toBeNull()
    await act(async () => {
      svg!.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 30, clientY: 30, bubbles: true }),
      )
      await new Promise((r) => setTimeout(r, 60))
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    expect(el.querySelectorAll('[data-ts-key="focus-ring"] rect')).toHaveLength(1)
    expect(errors).toEqual([])
  })
})
