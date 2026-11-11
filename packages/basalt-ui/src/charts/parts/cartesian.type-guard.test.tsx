/**
 * The closed series vocabulary (docs/v3/concepts/charts-cards-kanban.md § 8): a series has no free
 * hue, no `tone` and no numeric stroke width, and a chart without an accessible name does not compile.
 * Compile-time facts only; the function is never called.
 */
import { expect, test } from 'bun:test'
import { Bars } from './bars'
import { CartesianChart } from './cartesian'
import { Lines } from './lines'

type Row = { t: Date; v: number }
const color = { light: '#0b6bcb', dark: '#5aa9f0' }
const x = { value: (d: Row): Date => d.t }
const y = (d: Row): number => d.v

export function rejected(): void {
  CartesianChart({
    ariaLabel: 'V',
    data: [],
    x,
    series: [
      // @ts-expect-error a series has no `tone`: colour is a { light, dark } pair from the app's series file
      { mark: 'line', key: 'v', label: 'V', color, y, tone: 'good' },
    ],
  })
  CartesianChart({
    ariaLabel: 'V',
    data: [],
    x,
    // @ts-expect-error a free colour string is not a series colour
    series: [{ mark: 'line', key: 'v', label: 'V', color: '#ff0000', y }],
  })
  CartesianChart({
    ariaLabel: 'V',
    data: [],
    x,
    // @ts-expect-error the stroke scale is closed: `weight`, never a number
    series: [{ mark: 'line', key: 'v', label: 'V', color, y, strokeWidth: 3 }],
  })
  // @ts-expect-error an unnamed chart is an unlabeled image
  CartesianChart({ data: [], x, series: [{ mark: 'line', key: 'v', label: 'V', color, y }] })
  Lines({
    ariaLabel: 'V',
    data: [],
    x,
    // @ts-expect-error a bar is not a line
    series: [{ mark: 'bar', key: 'v', label: 'V', color, y }],
  })
  Bars({
    ariaLabel: 'V',
    data: [],
    x,
    // @ts-expect-error a dot is neither a bar nor an overlay line
    series: [{ mark: 'dot', key: 'v', label: 'V', color, y }],
  })
  CartesianChart({
    ariaLabel: 'V',
    data: [],
    x,
    // @ts-expect-error `dash` belongs to a line series
    series: [{ mark: 'bar', key: 'v', label: 'V', color, y, dash: true }],
  })
}

test('the accepted shape compiles', () => {
  const props = {
    ariaLabel: 'V',
    data: [] as Row[],
    x,
    series: [{ mark: 'line', key: 'v', label: 'V', color, y, weight: 'strong', dash: true }],
  } as const
  expect(typeof CartesianChart).toBe('function')
  expect(props.series[0].weight).toBe('strong')
})
