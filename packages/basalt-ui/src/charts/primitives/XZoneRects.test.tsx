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

  // Mirrors XZoneRects' own bound resolution exactly (same clamp + sign math), so expectations
  // never drift from the implementation's floating-point arithmetic.
  function edgeBound(key: string, sign: 1 | -1): number {
    const step = xScale.step()
    const [rangeStart, rangeEnd] = xScale.range() as [number, number]
    const rangeMin = Math.min(rangeStart, rangeEnd)
    const rangeMax = Math.max(rangeStart, rangeEnd)
    const center = xScale(key) as number
    return Math.min(Math.max(center + sign * (step / 2), rangeMin), rangeMax)
  }

  test('align: "edge" widens a two-key band by exactly one step over center mode', () => {
    const step = xScale.step()
    const centerFrom = xScale('b') as number
    const centerTo = xScale('c') as number
    const centerMarkup = render([{ from: 'b', to: 'c', fill: 'red' }])
    const edgeMarkup = render([{ from: 'b', to: 'c', fill: 'red', align: 'edge' }])
    expect(centerMarkup).toContain(`width="${centerTo - centerFrom}"`)
    const edgeFrom = edgeBound('b', -1)
    const edgeTo = edgeBound('c', 1)
    expect(edgeMarkup).toContain(`x="${edgeFrom}"`)
    expect(edgeMarkup).toContain(`width="${edgeTo - edgeFrom}"`)
    expect(edgeTo - edgeFrom).toBeCloseTo(centerTo - centerFrom + step, 10)
  })

  test('align: "edge" with from === to renders exactly one step wide, where center renders nothing', () => {
    const step = xScale.step()
    const centerMarkup = render([{ from: 'b', to: 'b', fill: 'red' }])
    const edgeMarkup = render([{ from: 'b', to: 'b', fill: 'red', align: 'edge' }])
    expect(centerMarkup).not.toContain('<rect')
    const edgeFrom = edgeBound('b', -1)
    const edgeTo = edgeBound('b', 1)
    expect(edgeMarkup).toContain(`x="${edgeFrom}"`)
    expect(edgeMarkup).toContain(`width="${edgeTo - edgeFrom}"`)
    expect(edgeTo - edgeFrom).toBeCloseTo(step, 10)
  })

  test('an unknown key is skipped in both align modes', () => {
    const centerMarkup = render([{ from: 'not-in-domain', to: 'c', fill: 'red' }])
    const edgeMarkup = render([{ from: 'not-in-domain', to: 'c', fill: 'red', align: 'edge' }])
    expect(centerMarkup).not.toContain('<rect')
    expect(edgeMarkup).not.toContain('<rect')
  })

  test('align: "edge" clamps the widened left edge at the first sample into the plot range', () => {
    const [rangeStart] = xScale.range() as [number, number]
    const markup = render([{ from: 'a', to: 'a', fill: 'red', align: 'edge' }])
    const edgeTo = edgeBound('a', 1)
    expect(markup).toContain(`x="${rangeStart}"`)
    expect(markup).toContain(`width="${edgeTo - rangeStart}"`)
  })

  test('align: "edge" clamps the widened right edge at the last sample into the plot range', () => {
    const [, rangeEnd] = xScale.range() as [number, number]
    const markup = render([{ from: 'd', to: 'd', fill: 'red', align: 'edge' }])
    const edgeFrom = edgeBound('d', -1)
    expect(markup).toContain(`x="${edgeFrom}"`)
    expect(markup).toContain(`width="${rangeEnd - edgeFrom}"`)
  })
})
