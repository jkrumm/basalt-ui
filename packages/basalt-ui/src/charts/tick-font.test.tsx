/**
 * Axis tick labels follow the Wave 35 typography law: the proportional sans with tabular figures
 * (digits line up down an axis), never the mono of captions, times and code. The engine measures and
 * paints guides in the host's computed font, so the one shared host element carries it, for every
 * kind; `--basalt-chart-font` retunes the face from outside.
 */
import { describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { BandStrip } from './BandStrip'
import { Bars } from './Bars'
import { Donut } from './Donut'
import { Heatmap } from './Heatmap'
import { Lines } from './Lines'

const days = [1, 2, 3].map((d) => ({ t: new Date(Date.UTC(2026, 9, d)), v: d * 10 }))
const series = [
  { key: 'v', label: 'Spend', color: 'var(--vx-line)', getValue: (r: (typeof days)[0]) => r.v },
]

const KINDS: ReadonlyArray<readonly [string, () => ReactElement]> = [
  ['Lines', () => <Lines ariaLabel="L" data={days} x={(r) => r.t} series={series} />],
  ['Bars', () => <Bars ariaLabel="B" data={days} x={(r) => r.t} bars={series} />],
  [
    'Heatmap',
    () => (
      <Heatmap
        ariaLabel="H"
        data={[{ row: 'Mon', col: '0', v: 2 }]}
        getRow={(d) => d.row}
        getCol={(d) => d.col}
        getValue={(d) => d.v}
      />
    ),
  ],
  [
    'BandStrip',
    () => (
      <BandStrip
        ariaLabel="S"
        data={[{ t: 's0', s: 'up' }]}
        x={(d) => d.t}
        states={[{ key: 'up', label: 'Up', color: 'var(--vx-good)' }]}
        getBand={(d) => ({ state: d.s })}
      />
    ),
  ],
  [
    'Donut',
    () => (
      <Donut
        ariaLabel="D"
        data={[{ key: 'a', value: 1 }]}
        colorForKey={() => 'var(--vx-line)'}
        formatValue={String}
        centerLabel="60"
      />
    ),
  ],
]

const hostStyle = (html: string): string =>
  /class="[^"]*ts-chart-host[^"]*"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? ''

describe('chart tick font', () => {
  for (const [name, make] of KINDS) {
    test(`${name}: the host is the overridable sans with tabular figures, not mono`, () => {
      const style = hostStyle(renderToString(make()))
      expect(style).toContain('font-family:var(--basalt-chart-font, var(--basalt-font-sans))')
      expect(style).toContain('font-variant-numeric:tabular-nums')
      expect(style).not.toContain('font-mono')
    })
  }

  test('the Donut centre figure is the numeral face with lining figures', () => {
    const html = renderToString(KINDS.find(([n]) => n === 'Donut')?.[1]())
    expect(html).toMatch(/font-family:var\(--basalt-font-numeral, var\(--basalt-font-sans\)\)/)
    expect(html).toContain('font-variant-numeric:lining-nums')
  })
})
