/**
 * The column law of `WidgetGrid` and `StatGroup` (audit B #6/#7) — the one thing these two
 * primitives exist to own, and the one that regresses silently: a wrong count still renders a
 * perfectly plausible grid, just not the same one the page beside it renders.
 *
 * Asserted against SSR markup rather than through the DOM harness (the `stat-card.test.tsx` idiom):
 * the law is expressed as two custom properties plus two `@media` blocks in the CSS module, and
 * happy-dom applies no stylesheet, so the rendered custom properties ARE the observable law here.
 * The `@media` half is structural CSS asserted separately below by reading the module.
 *
 * The clamp is the interesting half. `grid-column: span <n>` takes an integer, so a `span={3}` that
 * survives into a 2-up `sm` row opens a third implicit track and knocks every sibling below it out
 * of alignment — which is why `WidgetGrid.Item` reads the live count from context instead of
 * trusting its own prop.
 */
import { MantineProvider } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatGroup } from './stat-group'
import type { StatGroupCols } from './stat-group'
import { WidgetGrid } from './widget-grid'
import type { WidgetGridCols } from './widget-grid'

function render(node: ReactNode): string {
  return renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)
}

describe('WidgetGrid resolves base 1 → sm min(cols, 2) → lg cols', () => {
  const CASES: { cols: WidgetGridCols; sm: number }[] = [
    { cols: 1, sm: 1 },
    { cols: 2, sm: 2 },
    { cols: 3, sm: 2 },
    { cols: 4, sm: 2 },
  ]

  for (const { cols, sm } of CASES) {
    test(`cols=${cols}`, () => {
      const markup = render(<WidgetGrid cols={cols}>card</WidgetGrid>)
      expect(markup).toContain(`--basalt-widget-grid-cols-sm:${sm}`)
      expect(markup).toContain(`--basalt-widget-grid-cols-lg:${cols}`)
      expect(markup).toContain(`data-cols="${cols}"`)
    })
  }

  test('defaults to 2', () => {
    const markup = render(<WidgetGrid>card</WidgetGrid>)
    expect(markup).toContain('--basalt-widget-grid-cols-sm:2')
    expect(markup).toContain('--basalt-widget-grid-cols-lg:2')
  })
})

describe('WidgetGrid.Item clamps its span to the live column count', () => {
  test('a span wider than the sm count is clamped there, not at lg', () => {
    const markup = render(
      <WidgetGrid cols={3}>
        <WidgetGrid.Item span={3}>wide</WidgetGrid.Item>
      </WidgetGrid>,
    )
    // sm is min(3, 2) = 2, so the span cannot be 3 there — an unclamped 3 opens a phantom track.
    expect(markup).toContain('--basalt-widget-grid-span-sm:2')
    expect(markup).toContain('--basalt-widget-grid-span-lg:3')
  })

  test('a span narrower than the count is left alone', () => {
    const markup = render(
      <WidgetGrid cols={4}>
        <WidgetGrid.Item span={2}>wide</WidgetGrid.Item>
      </WidgetGrid>,
    )
    expect(markup).toContain('--basalt-widget-grid-span-sm:2')
    expect(markup).toContain('--basalt-widget-grid-span-lg:2')
  })

  test('an Item outside a grid falls back to the default counts rather than throwing', () => {
    const markup = render(<WidgetGrid.Item span={4}>orphan</WidgetGrid.Item>)
    expect(markup).toContain('--basalt-widget-grid-span-sm:2')
    expect(markup).toContain('--basalt-widget-grid-span-lg:2')
  })
})

describe('StatGroup resolves base 2 → sm min(cols, 3) → lg cols', () => {
  const CASES: { cols: StatGroupCols; sm: number }[] = [
    { cols: 2, sm: 2 },
    { cols: 3, sm: 3 },
    { cols: 4, sm: 3 },
    { cols: 5, sm: 3 },
  ]

  for (const { cols, sm } of CASES) {
    test(`cols=${cols}`, () => {
      const markup = render(<StatGroup cols={cols}>kpi</StatGroup>)
      expect(markup).toContain(`--basalt-stat-group-cols-sm:${sm}`)
      expect(markup).toContain(`--basalt-stat-group-cols-lg:${cols}`)
      expect(markup).toContain(`data-sm-cols="${sm}"`)
    })
  }

  test('defaults to 4', () => {
    const markup = render(<StatGroup>kpi</StatGroup>)
    expect(markup).toContain('--basalt-stat-group-cols-sm:3')
    expect(markup).toContain('--basalt-stat-group-cols-lg:4')
  })

  test('the rail is opt-in', () => {
    expect(render(<StatGroup>kpi</StatGroup>)).not.toContain('data-divided')
    expect(render(<StatGroup divided>kpi</StatGroup>)).toContain('data-divided="true"')
  })
})

describe('both accept BasaltProps', () => {
  test('WidgetGrid appends className and merges style', () => {
    const markup = render(
      <WidgetGrid className="mine" style={{ marginTop: 8 }}>
        card
      </WidgetGrid>,
    )
    expect(markup).toContain('mine')
    expect(markup).toContain('margin-top:8px')
  })

  test('StatGroup appends className and merges style', () => {
    const markup = render(
      <StatGroup className="mine" style={{ marginTop: 8 }}>
        kpi
      </StatGroup>,
    )
    expect(markup).toContain('mine')
    expect(markup).toContain('margin-top:8px')
  })
})

const read = (file: string): string => readFileSync(resolve(import.meta.dir, file), 'utf8')

describe('the responsive half is CSS, never a JS media query (law C9)', () => {
  for (const file of ['widget-grid.module.css', 'stat-group.module.css']) {
    test(`${file} carries the sm and lg blocks`, () => {
      const css = read(file)
      // Mantine's own --mantine-breakpoint-sm / -lg. A @media condition cannot read a custom
      // property, so the literal is the only expression available — see the module's own header.
      expect(css).toContain('min-width: 48em')
      expect(css).toContain('min-width: 75em')
    })
  }

  for (const file of ['widget-grid.tsx', 'stat-group.tsx']) {
    test(`${file} contains no JS media query`, () => {
      expect(read(file)).not.toContain('useMediaQuery')
    })
  }
})
