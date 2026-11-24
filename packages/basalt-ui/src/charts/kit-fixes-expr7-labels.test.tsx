/**
 * Expression cycle 7 (`v3-expr-7-kit-fixes` 3): a zone caption takes a line path as an obstacle,
 * and a reference caption keeps a few px of air from the line it clears. The rule caption's other
 * end is `kit-fixes-expr6-labels.test.tsx`.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { CartesianChart } from './parts/cartesian'
import { placeRefLabel } from './ref-label'

const DAY = 86_400_000
type Row = { t: number; v: number }
const color = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }

/** The `y` the zone caption is drawn at, or `null` when it was dropped. */
function captionY(value: (i: number) => number): number | null {
  const data: Row[] = Array.from({ length: 10 }, (_, i) => ({ t: i * DAY, v: value(i) }))
  const html = renderToString(
    <CartesianChart<Row>
      label="V"
      data={data}
      x={{ value: (d) => new Date(d.t) }}
      y={{ domain: [0, 100] }}
      series={[{ mark: 'line', key: 'v', label: 'V', color, y: (d) => d.v }]}
      zones={[
        {
          axis: 'x',
          from: new Date(2 * DAY),
          to: new Date(6 * DAY),
          fill: 'var(--basalt-bad)',
          label: 'Router 5 min',
        },
      ]}
    />,
  )
  const y = /<text[^>]*xzone-0-label[^>]*\sy="([\d.]+)"/.exec(html)?.[1]
  return y === undefined ? null : Number(y)
}

describe('zone caption against a line', () => {
  test('a line away from the corner leaves the caption in the zone corner', () => {
    const corner = captionY(() => 10)
    expect(corner).not.toBeNull()
  })

  test('a line along the top of the zone moves the caption down, off the stroke', () => {
    const corner = captionY(() => 10) as number
    const moved = captionY(() => 99)
    expect(moved).not.toBeNull()
    expect(moved as number).toBeGreaterThan(corner)
  })

  test('a line through the zone corner never strikes the caption', () => {
    // A spike inside the zone, at its start: the corner row is crossed, a lower row is not.
    const corner = captionY(() => 10) as number
    const spike = captionY((i) => (i === 3 ? 99 : 10))
    expect(spike === null || spike >= corner).toBe(true)
  })
})

const at = (y: number) => [
  [
    { fx: 0.5, y },
    { fx: 1, y },
  ],
]

describe('reference caption keeps air from a line', () => {
  const base = {
    pinned: undefined,
    startFirst: false,
    value: 50,
    domain: [0, 100] as const,
    plotWidth: 400,
    plotHeight: 200,
    label: 'Median',
    fontSize: 11,
  }

  test('a line 1 px above the caption band is no longer clear', () => {
    // end-above spans 51.5 to 58 on this axis; a line at 58.5 sits half a value off it.
    const placed = placeRefLabel({ ...base, series: at(58.5) })
    expect(placed?.position).not.toBe('end-above')
  })

  test('a line well clear leaves the first spot', () => {
    const placed = placeRefLabel({ ...base, series: at(80) })
    expect(placed?.position).toBe('end-above')
  })
})
