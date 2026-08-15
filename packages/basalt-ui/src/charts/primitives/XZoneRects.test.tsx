/**
 * `XZoneRects` — the x-analog of `ZoneRects`. Same SSR harness as `ChartFrame.test.tsx`:
 * `src/charts/**` is Mantine-free, so `renderToStaticMarkup` needs no provider wrapper.
 */
import { scalePoint } from '@visx/scale'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { XZoneRects } from './XZoneRects'
import type { XZoneSpec } from './XZoneRects'

const DOMAIN = ['a', 'b', 'c', 'd']
const xScale = scalePoint<string>({ domain: DOMAIN, range: [0, 100], padding: 0.3 })

function render(zones: XZoneSpec[]): string {
  return renderToStaticMarkup(<XZoneRects zones={zones} height={50} xScale={xScale} />)
}

describe('XZoneRects', () => {
  test('both bounds present -> rect spans center-to-center', () => {
    const from = xScale('b') as number
    const to = xScale('c') as number
    const markup = render([{ from: 'b', to: 'c', fill: 'red' }])
    expect(markup).toContain(`x="${from}"`)
    expect(markup).toContain(`width="${to - from}"`)
    expect(markup).toContain('height="50"')
    expect(markup).toContain('fill="red"')
  })

  test('omitted from -> resolves to the plot left edge (0)', () => {
    const to = xScale('b') as number
    const [rangeStart] = xScale.range() as [number, number]
    const markup = render([{ to: 'b', fill: 'red' }])
    expect(markup).toContain(`x="${rangeStart}"`)
    expect(markup).toContain(`width="${to - rangeStart}"`)
  })

  test('omitted to -> resolves to the plot right edge (xScale.range()[1])', () => {
    const from = xScale('c') as number
    const [, rangeEnd] = xScale.range() as [number, number]
    const markup = render([{ from: 'c', fill: 'red' }])
    expect(markup).toContain(`x="${from}"`)
    expect(markup).toContain(`width="${rangeEnd - from}"`)
  })

  test('an unknown key skips the band entirely — no rect, no clamping to a plot edge', () => {
    const markup = render([{ from: 'not-in-domain', to: 'c', fill: 'red' }])
    expect(markup).not.toContain('<rect')
  })

  test('an inverted range (to before from) renders no rect', () => {
    const markup = render([{ from: 'c', to: 'a', fill: 'red' }])
    expect(markup).not.toContain('<rect')
  })

  test('a degenerate zero-width range (from === to) renders no rect', () => {
    const markup = render([{ from: 'b', to: 'b', fill: 'red' }])
    expect(markup).not.toContain('<rect')
  })

  test('an empty zones array renders no rects', () => {
    expect(render([])).not.toContain('<rect')
  })
})
