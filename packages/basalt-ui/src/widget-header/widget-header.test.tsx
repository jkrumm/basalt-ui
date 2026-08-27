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
