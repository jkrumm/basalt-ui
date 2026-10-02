/**
 * `WidgetHeader` — the tier/heading contract, the count tag, the actions slot, and the info glyph's
 * accessibility contract (docs/CONTROLS-SPEC.md §2.2). Mantine-free, so components mount with no
 * `MantineProvider` at all (unlike `stat-card.test.tsx`'s `renderToStaticMarkup` harness).
 *
 * CSS-module class hashes are unavailable under `bun test` (see `app-mobile-nav.test.tsx`'s doc) —
 * nothing here selects on `classes.*`; every query goes through role/accessible-name/text content.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WidgetHeader } from './widget-header'

const CSS = readFileSync(join(import.meta.dir, 'widget-header.module.css'), 'utf8')

/** The declaration block of one class in this module — CSS-module hashes are unavailable under
 *  `bun test`, so the rules themselves are read from the file (same idiom as
 *  `theme/layout-rhythm-css.test.ts` and `controls/filter-set.test.tsx`). */
function block(selector: string): string {
  const start = CSS.indexOf(`${selector} {`)
  expect(start).toBeGreaterThan(-1)
  return CSS.slice(start, CSS.indexOf('}', start))
}

describe('the hero-metric row — value → delta spacing and alignment', () => {
  test('the value→badge gap is the 8px rhythm step, and a TOKEN so density tracks it', () => {
    // It shipped as `gap: 4px`. 4px is the rhythm's smallest step — label-to-thing distance — and at
    // that distance the DeltaBadge read as a superscript hanging off the numeral. A literal would
    // also have frozen the gap while every other spacing in the header moved with the density knob.
    const metrics = block('.metrics')
    expect(metrics).toContain('gap: var(--vx-space-stack-sm)')
    expect(metrics).not.toContain('gap: 4px')
    // Bare `gap:`, not `row-gap:` — the block's own `row-gap: 2px` is legitimate sub-scale
    // micro-spacing (basalt-tokens.md), a different property from the one this test pins.
    expect(metrics).not.toMatch(/(?<![-\w])gap:\s*\d/)
  })

  test('the badge is CENTRED on the value, not baseline-aligned to it', () => {
    // A DeltaBadge is a padded box with an 11.5px mono label; aligning its TEXT baseline to a 24px
    // KPI numeral's baseline put the box itself low — top edge under the numeral's x-height, bottom
    // edge hanging below its baseline. The `count` tag in the title row already centres for the
    // same reason.
    const metrics = block('.metrics')
    expect(metrics).toContain('align-items: center')
    expect(metrics).not.toContain('align-items: baseline')
  })
})

describe('tier picks the heading level', () => {
  test('section renders an h2', () => {
    render(<WidgetHeader tier="section" title="Overview" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toBeDefined()
  })

  test('widget renders an h3', () => {
    render(<WidgetHeader tier="widget" title="Active Users" />)
    expect(screen.getByRole('heading', { level: 3, name: 'Active Users' })).toBeDefined()
  })

  test('group renders an h3 carrying data-tier="group"', () => {
    const { container } = render(<WidgetHeader tier="group" title="Presets" />)
    expect(screen.getByRole('heading', { level: 3, name: 'Presets' })).toBeDefined()
    expect(container.querySelector('[data-tier="group"]')).not.toBeNull()
  })

  test('the three tiers each set a distinct data-tier value', () => {
    for (const tier of ['section', 'widget', 'group'] as const) {
      const { container, unmount } = render(<WidgetHeader tier={tier} title="X" />)
      expect(container.querySelector(`[data-tier="${tier}"]`)).not.toBeNull()
      unmount()
    }
  })

  test('the group tier reads as a mono micro-label, quieter than the widget tier (CSS-text)', () => {
    const group = block(".root[data-tier='group'] .heading")
    expect(group).toContain('--vx-text-micro')
    expect(group).toContain('--basalt-font-mono')
    expect(group).toContain('text-transform: uppercase')
  })
})

test('count renders a mono tag after the title', () => {
  render(<WidgetHeader tier="section" title="Recent orders" count={42} />)
  expect(screen.getByText('42')).toBeDefined()
})

test('count={0} renders "0" — a real count, distinct from an omitted one', () => {
  render(<WidgetHeader tier="section" title="Recent orders" count={0} />)
  expect(screen.getByText('0')).toBeDefined()
})

test('omitting count renders no tag', () => {
  render(<WidgetHeader tier="section" title="Recent orders" />)
  expect(screen.queryByText('0')).toBeNull()
})

describe('the actions slot renders only when passed', () => {
  test('absent by default', () => {
    render(<WidgetHeader tier="widget" title="Active Users" />)
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull()
  })

  test('present when given', () => {
    render(
      <WidgetHeader
        tier="widget"
        title="Active Users"
        actions={<button type="button">Menu</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Menu' })).toBeDefined()
  })
})

describe('the title row wraps and the actions slot shrinks — unconditionally, no container needed', () => {
  test('`.actions` does not grow (no forced full-width row) but can shrink and is capped at 100%', () => {
    // `flex: 0 1 auto` (no grow) lets a short slot stay on the shared title-row line; `.titleRow`'s
    // own `flex-wrap: wrap` drops a slot that does not fit to its own line, `max-width: 100%` caps it.
    expect(block('.titleRow')).toContain('flex-wrap: wrap')
    const rule = block('.actions')
    expect(rule).toContain('flex: 0 1 auto')
    expect(rule).toContain('min-width: 0')
    expect(rule).toContain('max-width: 100%')
    expect(rule).toContain('flex-wrap: wrap')
  })

  test('every real flex item inside `.actions` can shrink below its content width', () => {
    const start = CSS.indexOf('.actions > *,')
    expect(start).toBeGreaterThan(-1)
    const rule = CSS.slice(start, CSS.indexOf('}', start))
    expect(rule).toContain('.actions > * > *')
    expect(rule).toContain('flex: 1 1 auto')
    expect(rule).toContain('min-width: 0')
  })
})

describe('the info glyph', () => {
  const INFO = 'Measured over the trailing 30 days.'

  test("is named `More information` — the text is NOT the button's accessible name", () => {
    render(<WidgetHeader tier="widget" title="Uptime" info={INFO} />)
    expect(screen.getByRole('button', { name: 'More information' })).toBeDefined()
    expect(screen.queryByRole('button', { name: INFO })).toBeNull()
  })

  test("leaves the heading's accessible name as the title ALONE", () => {
    // The glyph used to live inside the heading, so an `info` paragraph was read out with the title
    // in every headings list. This is the assertion that keeps it outside.
    render(<WidgetHeader tier="widget" title="Uptime" info={INFO} />)
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading.textContent).toBe('Uptime')
    expect(heading.querySelector('button')).toBeNull()
    expect(screen.getByRole('heading', { level: 3, name: 'Uptime' })).toBeDefined()
  })

  test('the bubble is closed until asked, and describes the trigger while open', () => {
    render(<WidgetHeader tier="section" title="Uptime" info={INFO} />)
    const trigger = screen.getByRole('button', { name: 'More information' })
    expect(trigger.getAttribute('aria-describedby')).toBeNull()
    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.focus(trigger)
    const bubble = screen.getByRole('tooltip')
    expect(bubble.textContent).toBe(INFO)
    expect(trigger.getAttribute('aria-describedby')).toBe(bubble.id)
  })

  test('KEYBOARD reaches it — focus opens, Escape and blur close', () => {
    // A `title` attribute alone rendered on hover only, which is the whole reason this bubble exists.
    render(<WidgetHeader tier="widget" title="Uptime" info={INFO} />)
    const trigger = screen.getByRole('button', { name: 'More information' })

    fireEvent.focus(trigger)
    expect(screen.getByRole('tooltip')).toBeDefined()

    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.focus(trigger)
    fireEvent.blur(trigger)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  test('a pointer-down outside closes it', () => {
    render(<WidgetHeader tier="widget" title="Uptime" info={INFO} />)
    fireEvent.click(screen.getByRole('button', { name: 'More information' }))
    expect(screen.getByRole('tooltip')).toBeDefined()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})

test('omitting info renders no glyph', () => {
  render(<WidgetHeader tier="widget" title="Uptime" />)
  expect(screen.queryByRole('button')).toBeNull()
})

test('value + delta render together, delta via DeltaBadge', () => {
  render(<WidgetHeader tier="widget" title="Active Users" value="12,483" delta={4.2} />)
  expect(screen.getByText('12,483')).toBeDefined()
  expect(screen.getByText('4.2%')).toBeDefined()
})

describe('value + delta render on their own row under the title, for both tiers', () => {
  for (const tier of ['section', 'widget'] as const) {
    test(tier, () => {
      render(<WidgetHeader tier={tier} title="Active Users" value="12,483" delta={4.2} />)
      const valueNode = screen.getByText('12,483')
      // Never inline with the title — the heading holds title/icon/info/count/actions only.
      expect(valueNode.closest('h2, h3')).toBeNull()
    })
  }
})

test('subtitle renders below the title row', () => {
  render(<WidgetHeader tier="section" title="Profile" subtitle="Your public identity." />)
  expect(screen.getByText('Your public identity.')).toBeDefined()
})

describe('the subtitle folds into the info glyph in a card under 480px (CSS-only, one shows)', () => {
  test('subtitle with no info renders a fold glyph whose bubble is the subtitle', () => {
    render(<WidgetHeader tier="widget" title="Uptime" subtitle="Trailing 30 days." />)
    // The fold glyph's aria-label carries the subtitle text — it is otherwise the ONLY accessible
    // surface a folded (narrow/short) card leaves for it (regression: used to be a bare
    // 'More information', indistinguishable from every other card's glyph).
    const trigger = screen.getByRole('button', { name: 'More information: Trailing 30 days.' })
    fireEvent.focus(trigger)
    expect(screen.getByRole('tooltip').textContent).toBe('Trailing 30 days.')
    expect(screen.getByRole('heading', { level: 3, name: 'Uptime' })).toBeDefined()
  })

  test('info + subtitle share ONE glyph: the bubble reads info, then the subtitle', () => {
    render(
      <WidgetHeader tier="widget" title="Uptime" info="How it is computed." subtitle="Basis." />,
    )
    expect(screen.getAllByRole('button', { name: 'More information' })).toHaveLength(1)
    fireEvent.focus(screen.getByRole('button', { name: 'More information' }))
    expect(screen.getByRole('tooltip').textContent).toBe('How it is computed.Basis.')
  })

  test('the info glyph button is a real 24px target whose margin gives the size back', () => {
    const trigger = block('.infoTrigger')
    expect(trigger).toContain('min-width: 24px')
    expect(trigger).toContain('min-height: 24px')
    expect(trigger).toContain('margin: calc((11px - 24px) / 2)')
  })

  test('the container rules hide the visible subtitle and show the fold pieces, and only there', () => {
    expect(block('.foldGlyph,\n.foldNote')).toContain('display: none')
    const narrow = CSS.slice(CSS.indexOf('@container basalt-card (max-width: 479.9px)'))
    expect(narrow).toContain('.subtitle {\n    display: none')
    expect(narrow).toContain('.foldGlyph {\n    display: inline-flex')
    expect(narrow).toContain('.foldNote {\n    display: block')
  })
})

describe('the container laws', () => {
  test('the KPI value never ellipsizes and sizes with a cqi clamp capped at the kpi step', () => {
    const value = block('.value')
    expect(value).not.toContain('text-overflow')
    expect(value).not.toContain('overflow: hidden')
    expect(value).not.toContain('white-space: nowrap')
    // Plain kpi step with no card; the cqi clamp lives inside a `basalt-card` container query only.
    expect(value).toContain('font-size: var(--vx-text-kpi)')
    const clamp = CSS.slice(CSS.indexOf('@container basalt-card (width >= 0px)'))
    expect(clamp).toMatch(/font-size: clamp\([^;]*\dcqi, var\(--vx-text-kpi\)\)/)
  })

  test('the metrics row always wraps, and no viewport @media is left', () => {
    expect(block('.metrics')).toContain('flex-wrap: wrap')
    expect(CSS).not.toContain('@media')
  })

  test('from 480px value + delta move onto the title row (the title row dissolves)', () => {
    const wide = CSS.slice(CSS.indexOf('@container basalt-card (min-width: 480px)'))
    expect(wide).toContain('display: contents')
    expect(wide).toContain('margin-inline-start: auto')
    // metrics BEFORE actions, both after the heading, so actions stay the rightmost item
    expect(wide).toMatch(/\.metrics \{\s*order: 1/)
    expect(wide).toMatch(/\.actions \{\s*order: 2/)
  })
})

test('the sparkline slot carries a data-placement for a future bleed layout', () => {
  render(
    <WidgetHeader
      tier="widget"
      title="Active Users"
      sparkline={<span data-testid="spark">trend</span>}
    />,
  )
  const spark = screen.getByTestId('spark')
  expect(spark.closest('[data-placement]')?.getAttribute('data-placement')).toBe('right')
})

/**
 * `className`/`style` on the root and the four-slot union (`common/props.ts`). Mantine-free, so
 * `container.firstElementChild` really is the header's own root here — no injected `<style>` node
 * ahead of it, unlike the Mantine-wrapped composers.
 */
describe('className, style and the classNames slots', () => {
  test('className and style reach the root, and className never replaces the root class', () => {
    const { container } = render(
      <WidgetHeader
        tier="section"
        title="Revenue"
        className="my-header"
        style={{ marginTop: '3px' }}
      />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.classList.contains('my-header')).toBe(true)
    expect(root.getAttribute('data-tier')).toBe('section')
    expect(root.getAttribute('style') ?? '').toContain('margin-top: 3px')
  })

  test('each slot class lands on the box it names', () => {
    const { container } = render(
      <WidgetHeader
        tier="widget"
        title="Active Users"
        icon={<span data-testid="glyph">◆</span>}
        value="12,483"
        delta={4.2}
        classNames={{
          root: 'slot-root',
          title: 'slot-title',
          metric: 'slot-metric',
          icon: 'slot-icon',
        }}
      />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.classList.contains('slot-root')).toBe(true)
    expect(root.querySelector('h3.slot-title')?.textContent).toContain('Active Users')
    expect(root.querySelector('.slot-metric')?.textContent).toContain('12,483')
    expect(screen.getByTestId('glyph').closest('.slot-icon')).not.toBeNull()
  })

  test('an omitted classNames leaves every box on its own class alone', () => {
    const { container } = render(<WidgetHeader tier="widget" title="Active Users" value="1" />)
    expect(container.querySelector('.slot-root')).toBeNull()
    expect(container.querySelector('h3')?.textContent).toContain('Active Users')
  })
})
