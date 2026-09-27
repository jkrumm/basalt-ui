/**
 * `Heatmap` — touch and keyboard parity over the grid (`useDiscreteCursor`). The wrapper's measured
 * width is faked through `useChartSize`, same rationale as `Donut.test.tsx`: the DOM harness's
 * `ResizeObserver` shim never fires, so `ChartFrame`'s plot rect would otherwise stay at its SSR
 * fallback size and every cell would collapse to a zero-area rect.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import * as realChartSize from '../hooks/useChartSize'
import { Heatmap } from './Heatmap'

const realUseChartSize = realChartSize.useChartSize

let fakeSize: { width: number; height: number } | null = null

void mock.module('../hooks/useChartSize', () => ({
  useChartSize: (debounceMs?: number) => {
    const real = realUseChartSize(debounceMs)
    return fakeSize === null ? real : { ...real, ...fakeSize }
  },
}))

afterEach(() => {
  fakeSize = null
  cleanup()
})

type Cell = { row: string; col: string; value: number }

// A 2×3 grid (2 rows, 3 cols) — enough to exercise a real row jump under keyboard nav.
const cells: Cell[] = [
  { row: 'r0', col: 'c0', value: 1 },
  { row: 'r0', col: 'c1', value: 2 },
  { row: 'r0', col: 'c2', value: 3 },
  { row: 'r1', col: 'c0', value: 4 },
  { row: 'r1', col: 'c1', value: 5 },
  { row: 'r1', col: 'c2', value: 6 },
]

function renderGrid() {
  fakeSize = { width: 400, height: 240 }
  return render(
    <Heatmap<Cell>
      data={cells}
      chartId="heat-test"
      getRow={(d) => d.row}
      getCol={(d) => d.col}
      getValue={(d) => d.value}
      height={240}
    />,
  )
}

describe('Heatmap — hover (fine pointer, unchanged)', () => {
  test('hovering a cell shows its value', () => {
    const { container } = renderGrid()
    const cellEls = container.querySelectorAll('svg rect[role="option"]')
    expect(cellEls.length).toBe(6)
    fireEvent.pointerMove(cellEls[0]!, { pointerType: 'mouse', clientX: 5, clientY: 5 })
    expect(screen.getByText('Value').parentElement?.textContent).toContain('1')
    fireEvent.pointerLeave(cellEls[0]!, { pointerType: 'mouse' })
    expect(screen.queryByText('Value')).toBeNull()
  })
})

describe('Heatmap — touch (coarse pointer pin)', () => {
  test('a tap pins the tooltip; lift does not dismiss it, a tap outside does', () => {
    const { container } = renderGrid()
    const cellEls = container.querySelectorAll('svg rect[role="option"]')

    fireEvent.pointerDown(cellEls[0]!, { pointerType: 'touch' })
    expect(screen.getByText('Value').parentElement?.textContent).toContain('1')

    fireEvent.pointerLeave(cellEls[0]!, { pointerType: 'touch' })
    expect(screen.getByText('Value').parentElement?.textContent).toContain('1')

    fireEvent.pointerDown(document.body, { pointerType: 'touch' })
    expect(screen.queryByText('Value')).toBeNull()
  })

  test('a tap on a different cell moves the pin', () => {
    const { container } = renderGrid()
    const cellEls = container.querySelectorAll('svg rect[role="option"]')
    fireEvent.pointerDown(cellEls[0]!, { pointerType: 'touch' })
    expect(screen.getByText('Value').parentElement?.textContent).toContain('1')
    fireEvent.pointerDown(cellEls[3]!, { pointerType: 'touch' })
    expect(screen.getByText('Value').parentElement?.textContent).toContain('4')
  })
})

describe('Heatmap — keyboard (row-major grid, columns = cols.length)', () => {
  test('the grid is one focusable listbox exposing every cell as an option', () => {
    const { container } = renderGrid()
    const host = screen.getByRole('listbox')
    expect(host.tagName).toBe('svg')
    expect(container.querySelectorAll('rect[role="option"]')).toHaveLength(6)
  })

  test('Left/Right step within a row; Down/Up jump a full row', () => {
    renderGrid()
    const host = screen.getByRole('listbox')

    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(screen.getByText('Value').parentElement?.textContent).toContain('1')
    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(screen.getByText('Value').parentElement?.textContent).toContain('2')
    fireEvent.keyDown(host, { key: 'ArrowDown' })
    expect(screen.getByText('Value').parentElement?.textContent).toContain('5')
    fireEvent.keyDown(host, { key: 'ArrowUp' })
    expect(screen.getByText('Value').parentElement?.textContent).toContain('2')
  })

  test('Escape dismisses keyboard focus', () => {
    renderGrid()
    const host = screen.getByRole('listbox')
    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(screen.queryByText('Value')).not.toBeNull()
    fireEvent.keyDown(host, { key: 'Escape' })
    expect(screen.queryByText('Value')).toBeNull()
  })
})
