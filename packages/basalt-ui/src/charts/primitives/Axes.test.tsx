/**
 * `AxisBottomNumeric` — the numeric twin of `AxisLeftNumeric`, added for a continuous-x bespoke
 * plot (`docs/CHARTS-SPEC.md` issue #52; `sky-panorama.tsx`'s azimuth axis). Same SSR harness as
 * `ChartFrame.test.tsx` — Mantine-free, so no provider wrapper is needed.
 */
import { scaleLinear } from '@visx/scale'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AxisBottomNumeric } from './Axes'

describe('AxisBottomNumeric', () => {
  const scale = scaleLinear({ domain: [0, 360], range: [0, 300] })

  test('renders themed tick labels for a continuous numeric domain', () => {
    const html = renderToStaticMarkup(<AxisBottomNumeric scale={scale} top={100} numTicks={4} />)
    expect(html).toContain('<svg')
    expect(html).toContain('tick')
  })

  test('a custom tickFormat overrides the raw number label', () => {
    const html = renderToStaticMarkup(
      <AxisBottomNumeric scale={scale} top={100} tickFormat={(v) => `${v}°`} />,
    )
    expect(html).toContain('°')
  })
})
