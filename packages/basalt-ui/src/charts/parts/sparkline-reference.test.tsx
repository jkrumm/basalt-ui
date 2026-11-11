/** `Sparkline` `reference`: a quiet dashed hairline, in the domain, never a series. */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import type { ReactElement } from 'react'
import { Sparkline } from './sparkline'

const data = [10, 20, 30, 40, 50]
/** A 30 px box has a 30 unit plot with a 3 unit inset. */
const H = 30
const INSET = 3

const dom = (node: ReactElement): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el
}
const refs = (node: ReactElement): Element[] => [
  ...dom(node).querySelectorAll('[data-slot="spark-reference"]'),
]
const refY = (node: ReactElement): number => Number(refs(node)[0]?.getAttribute('y1'))
/** The y a value lands on for a domain [lo, hi]. */
const yOf = (v: number, [lo, hi]: [number, number]): number =>
  INSET + (H - 2 * INSET) * (1 - (v - lo) / (hi - lo))

const spark = (props: Partial<Parameters<typeof Sparkline>[0]> = {}): ReactElement => (
  <Sparkline series={data} ariaLabel="S" height={H} {...props} />
)

describe('Sparkline reference', () => {
  test('a number reference draws one rule at y(42), inside the data domain', () => {
    expect(refs(spark({ reference: 42 }))).toHaveLength(1)
    expect(refY(spark({ reference: 42 }))).toBeCloseTo(yOf(42, [10, 50]), 1)
  })

  test("'mean' draws at the mean of the plotted, non-null values", () => {
    const series = [10, null, 30, 20]
    expect(refY(spark({ series, reference: 'mean' }))).toBeCloseTo(yOf(20, [10, 30]), 1)
  })

  test('an out-of-range reference widens the y domain so it is never clipped', () => {
    const y = refY(spark({ reference: 100 }))
    expect(y).toBeGreaterThanOrEqual(0)
    expect(y).toBeLessThanOrEqual(H)
    expect(y).toBeCloseTo(yOf(100, [10, 100]), 1)
  })

  test('the reference is dashed, tokenised and not a legend item', () => {
    const html = renderToString(spark({ reference: 30 }))
    const el = refs(spark({ reference: 30 }))[0]
    expect(el?.getAttribute('stroke-dasharray')).toBeTruthy()
    expect(el?.getAttribute('class')).toContain('stroke-line')
    expect(html).not.toContain('legend')
  })

  test('the area form includes the reference too', () => {
    expect(refs(spark({ form: 'area', reference: 30 }))).toHaveLength(1)
  })

  test('NaN and an all-gap series draw no reference', () => {
    expect(refs(spark({ reference: Number.NaN }))).toHaveLength(0)
    expect(refs(spark({ series: [null, null], reference: 'mean' }))).toHaveLength(0)
  })

  test('no reference prop: no reference mark', () => {
    expect(refs(spark())).toHaveLength(0)
  })

  test('the reference is not a series: the line is the same with or without it inside the domain', () => {
    const line = (r?: number): string | null | undefined =>
      dom(spark(r === undefined ? {} : { reference: r }))
        .querySelector('[data-slot="spark-line"]')
        ?.getAttribute('d')
    expect(line(30)).toBe(line())
  })
})
