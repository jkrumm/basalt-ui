/**
 * `WidgetHeader` — the tier/heading contract, the count tag, the actions slot, and the info
 * glyph's accessible name (docs/CONTROLS-SPEC.md §2.2). Mantine-free, so components mount with no
 * `MantineProvider` at all (unlike `stat-card.test.tsx`'s `renderToStaticMarkup` harness).
 *
 * CSS-module class hashes are unavailable under `bun test` (see `app-mobile-nav.test.tsx`'s doc) —
 * nothing here selects on `classes.*`; every query goes through role/accessible-name/text content.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { WidgetHeader } from './widget-header'

describe('tier picks the heading level', () => {
  test('section renders an h2', () => {
    render(<WidgetHeader tier="section" title="Overview" />)
    expect(screen.getByRole('heading', { level: 2, name: 'Overview' })).toBeDefined()
  })

  test('widget renders an h3', () => {
    render(<WidgetHeader tier="widget" title="Active Users" />)
    expect(screen.getByRole('heading', { level: 3, name: 'Active Users' })).toBeDefined()
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

test('the info glyph exposes its text as an accessible name', () => {
  render(<WidgetHeader tier="widget" title="Uptime" info="Measured over the trailing 30 days." />)
  expect(screen.getByRole('button', { name: 'Measured over the trailing 30 days.' })).toBeDefined()
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
