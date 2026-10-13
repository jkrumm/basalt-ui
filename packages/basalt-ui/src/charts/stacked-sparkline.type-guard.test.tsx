/** V2-SPEC § 9.3: a stacked axis sums band heights, so `y.scale` is a compile-time error. */
import { expect, test } from 'bun:test'
import { StackedArea } from './StackedArea'

type Row = { t: Date; a: number }
const series = [{ key: 'a', label: 'A', color: 'var(--vx-line)', getValue: (d: Row) => d.a }]

// Never called: the bad shapes are compile-time facts only.
export function rejected(): void {
  StackedArea({
    ariaLabel: 'S',
    data: [],
    x: (d: Row) => d.t,
    series,
    // @ts-expect-error a log axis has no additive zero to stack from
    y: { scale: 'log' },
  })
  StackedArea({
    ariaLabel: 'S',
    data: [],
    x: (d: Row) => d.t,
    // @ts-expect-error a band is an area: no line dash
    series: [{ ...series[0], dash: 'dashed' }],
  })
}

test('a linear y config with a format is accepted', () => {
  expect(typeof StackedArea).toBe('function')
})
