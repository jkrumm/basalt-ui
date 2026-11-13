/**
 * `RefreshButton`: the 2.x `SyncButton` props and behaviour (age, syncing, error, scope) on the v3
 * primitives. Geometry (the compact form below 840 px, the print line) is the layout suite's.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test } from 'bun:test'
import { IntlScope } from '../core/provider-props'
import { RefreshButton } from './refresh-button'
import type { RefreshButtonProps } from './refresh-button'

afterEach(cleanup)

function renderRefresh(props: Partial<RefreshButtonProps> = {}) {
  return render(<RefreshButton syncing={false} scope="page" onSync={() => {}} {...props} />)
}
const button = () => screen.getByRole('button')

describe('age', () => {
  test('under a minute reads as the locale\'s "now"', () => {
    renderRefresh({ lastCompletedAt: Date.now() - 5_000 })
    expect(button().textContent).toContain('now')
    expect(button().textContent).not.toContain('ago')
  })

  test('the age sits beside the label on the page form', () => {
    renderRefresh({ lastCompletedAt: Date.now() - 2 * 60_000 })
    expect(button().textContent).toContain('Refresh')
    expect(button().textContent).toContain('2 minutes ago')
  })

  test('a Date and an epoch number are the same input', () => {
    renderRefresh({ lastCompletedAt: new Date(Date.now() - 3 * 60_000) })
    expect(button().textContent).toContain('3 minutes ago')
  })

  test('no age at all when nothing has completed yet', () => {
    renderRefresh({ lastCompletedAt: null })
    expect(button().textContent).toBe('Refresh')
    expect(document.querySelector('[data-slot="refresh-button-print"]')).toBeNull()
  })

  test('the age is absent on the server, so hydration cannot mismatch it', () => {
    const html = renderToStaticMarkup(
      <RefreshButton
        syncing={false}
        scope="page"
        onSync={() => {}}
        lastCompletedAt={Date.now() - 5 * 60_000}
      />,
    )
    expect(html).not.toContain('ago')
    expect(html).toContain('Refresh')
  })

  test.each([
    [30_000, 'now'],
    [2 * 60_000, '2m'],
    [3 * 3_600_000, '3h'],
    [2 * 86_400_000, '2d'],
  ])('the compact age %ims ago renders "%s"', (ago, text) => {
    renderRefresh({ lastCompletedAt: Date.now() - ago })
    expect(document.querySelector('[data-age="compact"]')?.textContent).toBe(text)
  })

  test('global scope carries no compact age', () => {
    renderRefresh({ scope: 'global', lastCompletedAt: Date.now() - 120_000 })
    expect(document.querySelector('[data-age="compact"]')).toBeNull()
    expect(button().textContent).toBe('')
  })

  test('the age follows the provider locale', () => {
    render(
      <IntlScope locale="de">
        <RefreshButton
          syncing={false}
          scope="page"
          onSync={() => {}}
          lastCompletedAt={Date.now() - 2 * 60_000}
        />
      </IntlScope>,
    )
    expect(button().textContent).toContain('vor 2 Minuten')
  })
})

describe('syncing', () => {
  test('announces itself and refuses a second press without losing focus', () => {
    let presses = 0
    renderRefresh({ syncing: true, onSync: () => void (presses += 1) })
    expect(button().getAttribute('aria-busy')).toBe('true')
    expect(button().getAttribute('aria-disabled')).toBe('true')
    // The native attribute would drop focus to <body> mid-press.
    expect(button().hasAttribute('disabled')).toBe(false)
    button().focus()
    fireEvent.click(button())
    expect(presses).toBe(0)
    expect(document.activeElement).toBe(button())
  })

  test('an idle press calls onSync', () => {
    let presses = 0
    renderRefresh({ onSync: () => void (presses += 1) })
    fireEvent.click(button())
    expect(presses).toBe(1)
  })

  test('the glyph spins only while syncing', () => {
    renderRefresh({ syncing: true })
    expect(button().querySelector('svg')?.getAttribute('class')).toContain('animate-spin')
    cleanup()
    renderRefresh()
    expect(button().querySelector('svg')?.getAttribute('class')).not.toContain('animate-spin')
  })
})

describe('error and name', () => {
  test('the message is in the accessible name, not only in a tooltip', () => {
    renderRefresh({ error: 'Rate limited' })
    expect(screen.getByRole('button', { name: 'Refresh — Rate limited' })).toBeDefined()
    expect(button().getAttribute('title')).toBe('Rate limited')
  })

  test('both scopes fold an error into the name', () => {
    renderRefresh({ scope: 'global', error: 'Upstream 503' })
    expect(screen.getByRole('button', { name: 'Refresh — Upstream 503' })).toBeDefined()
  })

  test('label is the visible text of the page form and the name of the global one', () => {
    renderRefresh({ label: 'Sync all' })
    expect(button().textContent).toBe('Sync all')
    expect(screen.getByRole('button', { name: 'Sync all' })).toBeDefined()
    cleanup()
    renderRefresh({ scope: 'global', label: 'Sync all' })
    expect(screen.getByRole('button', { name: 'Sync all' }).textContent).toBe('')
  })

  test('scope reaches the DOM', () => {
    renderRefresh({ scope: 'global' })
    expect(document.querySelector('[data-scope="global"]')).not.toBeNull()
  })
})

describe('print', () => {
  test('the button is hidden on paper and a line states the data time', () => {
    const at = Date.UTC(2026, 10, 13, 9, 30)
    renderRefresh({ lastCompletedAt: at })
    expect(button().className).toContain('print:hidden')
    const line = document.querySelector('[data-slot="refresh-button-print"]')
    expect(line?.className).toContain('print:inline')
    expect(line?.textContent).toStartWith('Updated ')
    expect(line?.textContent).toContain('2026')
  })
})
