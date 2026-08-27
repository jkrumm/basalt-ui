/**
 * `Section` — the tier-2 heading composer (docs/CONTROLS-SPEC.md §2.2): the collapse contract
 * (persisted vs local, header stays drawn, body unmounts, tabs hide), the scroll-anchor style, and
 * the ≤3-actions dev warning (C6).
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, spyOn, test } from 'bun:test'
import type { ReactElement } from 'react'
import { Section } from './section'

function renderWith(node: ReactElement) {
  return render(<MantineProvider>{node}</MantineProvider>)
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('Section composes WidgetHeader at the section tier', () => {
  test('renders an h2 carrying the title', () => {
    renderWith(
      <Section title="Revenue">
        <div>body</div>
      </Section>,
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Revenue' })).toBeDefined()
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
