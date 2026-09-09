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

describe('StatGroup resolves base 2 → sm min(cols, 3) except 4→2 → lg cols', () => {
  const CASES: { cols: StatGroupCols; sm: number }[] = [
    { cols: 2, sm: 2 },
    { cols: 3, sm: 3 },
    // 4 is the exception, and the reason is in `stat-group.tsx`: three columns leave a four-KPI
    // row as 3 + 1, one orphan against two thirds of empty track.
    { cols: 4, sm: 2 },
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
    expect(markup).toContain('--basalt-stat-group-cols-sm:2')
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
      // px in the container queries, Mantine's own em in the viewport fallback — the same two
      // boundaries either way. `em` inside a @container condition resolves against the CONTAINER's
      // font-size rather than the root's, which is why the live law is the px one; see the
      // module's own header.
      expect(css).toContain('(min-width: 768px)')
      expect(css).toContain('(min-width: 1200px)')
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

/**
 * The defect this half exists to stop coming back: the shell has regions that change the AVAILABLE
 * width with the viewport HELD STILL — a `PageAside` claiming 300px, the sidebar collapsing 256px →
 * its 48px rail, a consumer's own split pane. Measured in Chrome at 1512×945: a `PageAside` left
 * the KPI row 956px wide, `@media` still resolved `lg`, and four 239px cells truncated their own
 * values mid-word.
 *
 * Two things have to hold together, and a unit test can only see them as text + markup (happy-dom
 * applies no stylesheet and evaluates no container query): the query must be a `@container`, and
 * the component must RENDER the container it queries. Neither alone is the fix — a `@container`
 * with no container ancestor evaluates to false, which would have pinned every consumer to the
 * base count instead.
 */
describe('the law keys on the container, not the viewport', () => {
  const CASES = [
    { css: 'widget-grid.module.css', name: 'basalt-widget-grid' },
    { css: 'stat-group.module.css', name: 'basalt-stat-group' },
  ]

  for (const { css: file, name } of CASES) {
    test(`${file} states its law as @container ${name}`, () => {
      const css = read(file)
      expect(css).toContain(`container-name: ${name}`)
      expect(css).toContain('container-type: inline-size')
      expect(css).toContain(`@container ${name} (min-width: 768px)`)
      expect(css).toContain(`@container ${name} (min-width: 1200px)`)
    })

    test(`${file} keeps the viewport law only where @container is unsupported`, () => {
      // Comments stripped first — these files DISCUSS `@media` at length in their headers, and the
      // assertion is about the rules, not the prose.
      const css = read(file).replace(/\/\*[\s\S]*?\*\//g, '')
      // Every @media that survives sits inside the @supports-not block: two laws live at once is
      // the one thing these files must never do — the rail's :nth-child suppressors are more
      // specific than the rule that draws the hairline, so an overlapping viewport law would blank
      // the border on cells in the MIDDLE of a row.
      const supportsAt = css.indexOf('@supports not (container-type: inline-size)')
      expect(supportsAt).toBeGreaterThan(-1)
      expect(css.indexOf('@media')).toBeGreaterThan(supportsAt)
    })
  }

  // Class NAMES are empty under `bun test` (no CSS-module loader), so the wrapper is asserted
  // structurally — the grid, identified by the data attribute only it carries, nested one level in
  // — plus the source naming `classes.container`. A size container is a container for its
  // DESCENDANTS, never for itself: a wrapper is the whole mechanism, not a tidy-up.
  test('WidgetGrid renders the container it queries, around the grid', () => {
    expect(render(<WidgetGrid cols={3}>card</WidgetGrid>)).toMatch(
      /<div[^>]*><div[^>]*data-cols="3"/,
    )
    expect(read('widget-grid.tsx')).toContain('classes.container')
  })

  test('StatGroup renders the container it queries, around the grid', () => {
    expect(render(<StatGroup cols={4}>kpi</StatGroup>)).toMatch(/<div[^>]*><div[^>]*data-cols="4"/)
    expect(read('stat-group.tsx')).toContain('classes.container')
  })

  test('className and style land on the container — the box a consumer positions AND measures', () => {
    const markup = render(
      <StatGroup className="mine" style={{ maxWidth: 600 }}>
        kpi
      </StatGroup>,
    )
    // Not cosmetic: the container query reads the box the consumer sized. A `maxWidth` applied to
    // the inner grid while the wrapper stayed full-width would resolve the tier off a width no
    // cell has — the same class of wrong measurement this whole change removes.
    expect(markup).toMatch(/<div class="[^"]*mine" style="max-width:600px"><div/)
  })
})
