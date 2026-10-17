/**
 * Axis tick labels follow the Wave 35 typography law: the proportional sans with tabular figures
 * (digits line up down an axis), never the mono of captions, times and code. The engine measures and
 * paints guides in the host's computed font, so the host element carries it.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Lines } from './Lines'

const html = renderToString(
  <Lines
    ariaLabel="Spend"
    data={[
      { d: new Date(Date.UTC(2026, 9, 1)), v: 10 },
      { d: new Date(Date.UTC(2026, 9, 2)), v: 20 },
    ]}
    x={(r) => r.d}
    series={[{ key: 'v', label: 'Spend', color: 'var(--vx-line)', getValue: (r) => r.v }]}
  />,
)
const hostStyle = /class="[^"]*ts-chart-host[^"]*"[^>]*style="([^"]*)"/.exec(html)?.[1] ?? ''

describe('chart tick font', () => {
  test('the host is the sans with tabular figures, not mono', () => {
    expect(hostStyle).toContain('font-family:var(--basalt-font-sans)')
    expect(hostStyle).toContain('font-variant-numeric:tabular-nums')
    expect(hostStyle).not.toContain('font-mono')
  })
})
