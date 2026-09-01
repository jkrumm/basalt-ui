/**
 * `Section` — the tier-2 heading composer (docs/CONTROLS-SPEC.md §2.2): the collapse contract
 * (persisted vs local, header stays drawn, body unmounts, tabs hide), the scroll-anchor style, and
 * the ≤3-actions dev warning (C6).
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactElement } from 'react'
import { FilterSetScope } from '../controls/filter-context'
import { Section } from './section'

function renderWith(node: ReactElement) {
  return render(<MantineProvider>{node}</MantineProvider>)
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('Section composes WidgetHeader at the section tier', () => {
  test('renders an h2 carrying the title, and data-tier="section", outside any filter surface', () => {
    renderWith(
      <Section title="Revenue">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Revenue' })).toBeDefined()
    // The Section ROOT, not WidgetHeader's — both carry `data-tier`, so walk up from the body.
    const root = screen.getByText('body').parentElement?.parentElement
    expect(root?.getAttribute('data-tier')).toBe('section')
  })

  test('resolves to the group tier — an h3 with data-tier="group" — on the aside panel surface', () => {
    renderWith(
      <FilterSetScope surface="panel" registry={null}>
        <Section title="Composition">
          <div>body</div>
        </Section>
      </FilterSetScope>,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Composition' })).toBeDefined()
    const root = screen.getByText('body').parentElement?.parentElement
    expect(root?.getAttribute('data-tier')).toBe('group')
  })

  test("also resolves to group on the aside's mobile sheet projection, not just the desktop panel", () => {
    renderWith(
      <FilterSetScope surface="sheet" registry={null}>
        <Section title="Composition">
          <div>body</div>
        </Section>
      </FilterSetScope>,
    )
    expect(screen.getByRole('heading', { level: 3, name: 'Composition' })).toBeDefined()
    const root = screen.getByText('body').parentElement?.parentElement
    expect(root?.getAttribute('data-tier')).toBe('group')
  })

  test('section.module.css quiets the group tier body gap to 0 (SR4 panel-row pitch)', () => {
    const css = readFileSync(join(import.meta.dir, 'section.module.css'), 'utf8')
    const start = css.indexOf("[data-tier='group'] .body {")
    expect(start).toBeGreaterThan(-1)
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toContain('gap: 0')
  })
})

describe('collapsible', () => {
  test('the header stays drawn when closed; only the body unmounts', () => {
    renderWith(
      <Section title="Usage" collapsible>
        <div>body content</div>
      </Section>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Usage' })).toBeDefined()
    expect(screen.getByText('body content')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse section' }))

    expect(screen.getByRole('heading', { level: 2, name: 'Usage' })).toBeDefined()
    expect(screen.queryByText('body content')).toBeNull()
  })

  test('tabs hide while collapsed', () => {
    renderWith(
      <Section title="Usage" collapsible tabs={<div>the tabs</div>}>
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('the tabs')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse section' }))
    expect(screen.queryByText('the tabs')).toBeNull()
  })

  test('an unpersisted fold (no persistKey) does not touch localStorage', () => {
    renderWith(
      <Section title="Usage" collapsible>
        <div>body</div>
      </Section>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Collapse section' }))
    expect(window.localStorage.length).toBe(0)
  })

  test('persistKey persists the fold state under basalt:section:<key>', () => {
    renderWith(
      <Section title="Usage" collapsible persistKey="usage">
        <div>body</div>
      </Section>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Collapse section' }))

    const raw = window.localStorage.getItem('basalt:section:usage')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw ?? '{}')).toMatchObject({ value: false })
  })
})

describe('id — the scroll-anchor contract', () => {
  test('sets the id and a scrollMarginTop clearing both sticky bars', () => {
    const { container } = renderWith(
      <Section id="usage" title="Usage">
        <div>body</div>
      </Section>,
    )
    const root = container.querySelector('#usage')
    expect(root).not.toBeNull()
    const style = root?.getAttribute('style') ?? ''
    expect(style).toContain('scroll-margin-top')
    expect(style).toContain('--app-shell-header-height')
    expect(style).toContain('--basalt-page-bar-h')
  })

  test('omitting id sets neither an id nor the anchor style', () => {
    const { container } = renderWith(
      <Section title="Usage">
        <div>body</div>
      </Section>,
    )
    const root = container.firstElementChild
    expect(root?.id).toBe('')
    expect(root?.getAttribute('style')).toBeNull()
  })
})

// Relies on the default test-runner NODE_ENV being non-production (`isDev()` true), matching
// `data/data-table.test.tsx`'s manualPagination dev-throw tests — no explicit env override needed.
describe('≤3 actions — the dev-only budget warning (C6)', () => {
  // `Children.count` (like every `Children.*` helper) does not recurse into a Fragment passed as
  // a single node — an ARRAY of actions is what the count actually sees, same shape a consumer
  // building the list programmatically would pass.
  test('4 actions warns', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    renderWith(
      <Section
        title="Usage"
        actions={[1, 2, 3, 4].map((n) => (
          <button key={n} type="button">
            {n}
          </button>
        ))}
      >
        <div>body</div>
      </Section>,
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0]?.[0])).toContain('≤3 budget')
    warn.mockRestore()
  })

  test('3 actions does not warn', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    renderWith(
      <Section
        title="Usage"
        actions={[1, 2, 3].map((n) => (
          <button key={n} type="button">
            {n}
          </button>
        ))}
      >
        <div>body</div>
      </Section>,
    )
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('defaultOpen', () => {
  test('defaultOpen={false} opens collapsed, and the chevron still expands it', () => {
    renderWith(
      <Section title="Usage" collapsible defaultOpen={false}>
        <div>body content</div>
      </Section>,
    )
    expect(screen.queryByText('body content')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Expand section' }))
    expect(screen.getByText('body content')).toBeDefined()
  })

  test('a persisted value outranks it — a section the reader opened stays open', () => {
    window.localStorage.setItem('basalt:section:usage', JSON.stringify({ v: 1, value: true }))
    renderWith(
      <Section title="Usage" collapsible persistKey="usage" defaultOpen={false}>
        <div>body content</div>
      </Section>,
    )
    expect(screen.getByText('body content')).toBeDefined()
  })
})

describe('summary — visible collapsed or not', () => {
  test('a collapsed section still states its headline figures', () => {
    renderWith(
      <Section title="Usage" collapsible summary={<span>48,204 requests</span>}>
        <div>body content</div>
      </Section>,
    )
    expect(screen.getByText('48,204 requests')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse section' }))

    expect(screen.queryByText('body content')).toBeNull()
    expect(screen.getByText('48,204 requests')).toBeDefined()
  })

  test('it renders under the header, above where the body starts', () => {
    renderWith(
      <Section title="Usage" summary={<span>48,204 requests</span>}>
        <div>body content</div>
      </Section>,
    )
    const summary = screen.getByText('48,204 requests').parentElement
    expect(
      summary?.previousElementSibling?.contains(screen.getByRole('heading', { level: 2 })),
    ).toBe(true)
    expect(summary?.nextElementSibling?.contains(screen.getByText('body content'))).toBe(true)
  })
})

// A rest-spread bug in `section.tsx` silently dropped `unit`/`deltaPolarity`/`deltaFormat`/
// `deltaGlyph` even though `SectionProps` type-checked them — nothing rendered, nothing errored.
// Every `WidgetHeaderProps` key `SectionProps` admits must reach the composed `WidgetHeader`.
describe('forwards every WidgetHeader prop (unit, deltaPolarity, deltaFormat, deltaGlyph)', () => {
  test('unit renders beside value', () => {
    renderWith(
      <Section title="Load" value="412" unit="TSS">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('TSS')).toBeDefined()
  })

  test('deltaPolarity="up-bad" renders a positive delta with the bad tone', () => {
    renderWith(
      <Section title="Load" delta={12.4} deltaPolarity="up-bad">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('12.4%').style.color).toBe('var(--vx-status-bad)')
  })

  test('deltaFormat overrides the default percentage label', () => {
    renderWith(
      <Section title="Pace" delta={-12} deltaFormat={(v) => `${Math.abs(v)}ms`}>
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('12ms')).toBeDefined()
    expect(screen.queryByText('12.0%')).toBeNull()
  })

  test('deltaGlyph={false} suppresses the glyph', () => {
    renderWith(
      <Section title="Load" delta={12.4} deltaGlyph={false}>
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('12.4%')).toBeDefined()
    expect(screen.queryByText('▲')).toBeNull()
  })

  test('icon renders in the heading via the icon slot', () => {
    renderWith(
      <Section title="Load" icon={<svg data-testid="load-icon" />}>
        <div>body</div>
      </Section>,
    )
    const icon = screen.getByTestId('load-icon')
    expect(icon.closest('[data-basalt-icon]')).not.toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: 'Load' }).contains(icon)).toBe(true)
  })

  test('subtitle renders below the title row', () => {
    renderWith(
      <Section title="Load" subtitle="7-day rolling">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('7-day rolling')).toBeDefined()
  })

  test('info renders the "More information" glyph beside the heading', () => {
    renderWith(
      <Section title="Load" info="Training stress score.">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByRole('button', { name: 'More information' })).toBeDefined()
  })

  test('deltaPeriod renders alongside the delta chip', () => {
    renderWith(
      <Section title="Load" delta={4.2} deltaPeriod="MoM">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('4.2%')).toBeDefined()
    expect(screen.getByText('MoM')).toBeDefined()
  })

  test('sparkline renders below the metric row', () => {
    renderWith(
      <Section title="Load" sparkline={<span data-testid="load-spark">trend</span>}>
        <div>body</div>
      </Section>,
    )
    expect(screen.getByTestId('load-spark')).toBeDefined()
  })

  test('count renders a mono tag after the title', () => {
    renderWith(
      <Section title="Orders" count={42}>
        <div>body</div>
      </Section>,
    )
    expect(screen.getByText('42')).toBeDefined()
  })
})
