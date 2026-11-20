/**
 * Expression cycle 15 (`v3-expr-15-kit-fixes` 2): a spread dot series' dots are host obstacles at their
 * spread (drawn) positions, so a label the page places keeps clear of the dots it draws, not of the data.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { LabelBox } from './chart-labels'
import type { Series } from './contract'
import { hostObstacles } from './label-obstacles'
import { CartesianChart } from './parts/cartesian'

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

const COLOR = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }
type Row = { t: number; v: number }
type DotSeries = Extract<Series<Row>, { mark: 'dot' }>

/** Fourteen dots on one x and one value: a heap the spread must part. */
const HEAP: readonly Row[] = [
  ...Array.from({ length: 14 }, () => ({ t: 5, v: 50 })),
  { t: 10, v: 0 },
  { t: 10, v: 100 },
]

/** The obstacles a host publishes while it builds a chart of dot series alone (no bars, lines or rules). */
async function dotObstacles(
  data: readonly Row[],
  spread: 'x' | 'y' | undefined,
): Promise<LabelBox[]> {
  const seen: LabelBox[][] = []
  const marks = CartesianChart.custom<Row>(() => {
    seen.push([...hostObstacles()])
    return []
  })
  const series: DotSeries = {
    mark: 'dot',
    key: 'd',
    label: 'D',
    color: COLOR,
    r: () => 3,
    y: (d) => d.v,
    ...(spread !== undefined && { spread }),
  }
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () =>
    root?.render(
      <CartesianChart<Row>
        label="Dots"
        data={data}
        x={{ value: (d) => d.t }}
        series={[series]}
        marks={marks}
      />,
    ),
  )
  await act(async () => new Promise((r) => setTimeout(r, 20)))
  const last = seen.at(-1)
  if (last === undefined) throw new Error('the builder never ran')
  return last
}

const overlaps = (a: LabelBox, b: LabelBox): boolean =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height

describe('spread dots as label obstacles', () => {
  test('a spread heap publishes one obstacle per dot, none overlapping another', async () => {
    const boxes = await dotObstacles(HEAP, 'y')
    expect(boxes.length).toBe(HEAP.length)
    expect(boxes.some((b) => b.top !== boxes[0]?.top)).toBe(true)
    for (const [i, a] of boxes.entries())
      for (const b of boxes.slice(i + 1)) expect(overlaps(a, b)).toBe(false)
  })
})
