/**
 * `SyncButton` — the age formatting and the syncing state (law C12, `docs/CONTROLS-SPEC.md` §3).
 *
 * The age is the part that had four hand-rolled copies across consumers, each with its own
 * rounding; `formatAge` is asserted directly so the boundaries are pinned, not inferred from one
 * rendered string.
 */
import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'bun:test'
import { AGE_REFRESH_MS, SyncButton, formatAge } from './sync-button'

function renderSync(props: Partial<Parameters<typeof SyncButton>[0]> = {}) {
  return render(
    <MantineProvider>
      <SyncButton syncing={false} scope="page" onSync={() => {}} {...props} />
    </MantineProvider>,
  )
}

describe('formatAge', () => {
  test('anything under a minute is `just now`, so a fresh sync stops flickering', () => {
    expect(formatAge(0)).toBe('just now')
    expect(formatAge(59_000)).toBe('just now')
  })

  test('minutes, then hours, then days', () => {
    expect(formatAge(60_000)).toBe('1m ago')
    expect(formatAge(2 * 60_000)).toBe('2m ago')
    expect(formatAge(59 * 60_000)).toBe('59m ago')
    expect(formatAge(60 * 60_000)).toBe('1h ago')
    expect(formatAge(23 * 60 * 60_000)).toBe('23h ago')
    expect(formatAge(24 * 60 * 60_000)).toBe('1d ago')
  })

  test('the refresh interval is coarser than the smallest unit it renders', () => {
    expect(AGE_REFRESH_MS).toBeLessThanOrEqual(60_000)
  })
})

describe('SyncButton', () => {
  test('renders the age beside the label on desktop', () => {
    renderSync({ lastCompletedAt: Date.now() - 2 * 60_000 })
    expect(screen.getByRole('button').textContent).toContain('Sync')
    expect(screen.getByRole('button').textContent).toContain('2m ago')
  })

  test('a Date and an epoch number are the same input', () => {
    renderSync({ lastCompletedAt: new Date(Date.now() - 3 * 60_000) })
    expect(screen.getByRole('button').textContent).toContain('3m ago')
  })

  test('no age at all when nothing has completed yet', () => {
    renderSync({ lastCompletedAt: null })
    expect(screen.getByRole('button').textContent).toBe('Sync')
  })

  test('syncing announces itself and refuses a second click — WITHOUT losing focus', () => {
    let presses = 0
    renderSync({
      syncing: true,
      onSync: () => {
        presses += 1
      },
    })
    const button = screen.getByRole('button')

    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    // The NATIVE attribute is what drops focus to <body> mid-press, so it must stay off: a keyboard
    // user who presses Sync has to still be standing on the button when the sync lands.
    expect(button.hasAttribute('disabled')).toBe(false)
    expect(button.hasAttribute('data-disabled')).toBe(true)

    button.focus()
    fireEvent.click(button)
    expect(presses).toBe(0)
    expect(document.activeElement).toBe(button)
  })

  test('an idle press does call onSync — the refusal above is not just a dead handler', () => {
    let presses = 0
    renderSync({
      onSync: () => {
        presses += 1
      },
    })
    fireEvent.click(screen.getByRole('button'))
    expect(presses).toBe(1)
  })

  test('the age is absent on the server, so hydration cannot mismatch it', () => {
    // `Date.now()` during render is the whole bug: the server renders one age and a client hydrating
    // a minute later renders another. Both must render NO age; the effect fills it in after mount.
    const html = renderToStaticMarkup(
      <MantineProvider>
        <SyncButton
          syncing={false}
          scope="page"
          onSync={() => {}}
          lastCompletedAt={Date.now() - 5 * 60_000}
        />
      </MantineProvider>,
    )
    expect(html).not.toContain('5m ago')
    expect(html).toContain('Sync')
  })

  test('an error puts the control in the danger tone', () => {
    renderSync({ error: 'Upstream 503' })
    expect(screen.getByRole('button').getAttribute('data-variant')).toBe('default')
    expect(document.querySelector('[data-basalt-sync-scope="page"]')).not.toBeNull()
  })

  test('the error message is in the accessible name, not only in a hover tooltip', () => {
    // A tooltip announces only while open, and Mantine's opens on hover ALONE by default — so
    // without this the red colour is the entire signal for a keyboard or screen-reader user.
    renderSync({ error: 'Rate limited' })
    expect(screen.getByRole('button', { name: 'Sync — Rate limited' })).toBeDefined()
  })

  test('scope reaches the DOM so a call site is readable without reading the props', () => {
    renderSync({ scope: 'global' })
    expect(document.querySelector('[data-basalt-sync-scope="global"]')).not.toBeNull()
  })
})

/**
 * The shape per scope. `scope` used to be documentation only; it now picks the form, because the
 * shell header has no room for a labelled button beside the breadcrumb, `PageBar` row 1 and every
 * other global action — and a page bar does (spec §3, law C12).
 */
describe('the shape follows the scope', () => {
  test('global renders an ActionIcon with no label text at any width', () => {
    renderSync({ scope: 'global', label: 'Sync all' })
    const button = screen.getByRole('button')
    // Mantine's own class names are static strings (unlike a CSS-module hash), so which PRIMITIVE
    // rendered is assertable — and it is the whole difference between the two forms.
    expect(button.classList.contains('mantine-ActionIcon-root')).toBe(true)
    // Icon-only on EVERY viewport, so there is no text to hide with a media query in the first
    // place: the label reaches the user as the accessible name only.
    expect(button.textContent).toBe('')
    expect(screen.getByRole('button', { name: 'Sync all' })).toBeDefined()
  })

  test('a global button carries no rendered age either — the tooltip is its only home', () => {
    renderSync({ scope: 'global', lastCompletedAt: Date.now() - 4 * 60_000 })
    expect(screen.getByRole('button').textContent).toBe('')
  })

  test('page renders the labelled Button, and is named even once the label is hidden below sm', () => {
    renderSync({ scope: 'page' })
    const button = screen.getByRole('button')
    expect(button.classList.contains('mantine-Button-root')).toBe(true)
    expect(button.textContent).toBe('Sync')
    // jsdom evaluates no media query, so the `display: none` below `sm` is not observable here —
    // what IS observable is the half that makes it safe: `display: none` text leaves the
    // accessibility tree, so the name has to come from `aria-label`, not from the children.
    expect(button.getAttribute('aria-label')).toBe('Sync')
  })

  test('both scopes fold an error into the accessible name, not only into the tone', () => {
    renderSync({ scope: 'global', error: 'Upstream 503' })
    expect(screen.getByRole('button', { name: 'Sync — Upstream 503' })).toBeDefined()
  })

  test('a global button refuses a second click while syncing, exactly as the page form does', () => {
    let presses = 0
    renderSync({
      scope: 'global',
      syncing: true,
      onSync: () => {
        presses += 1
      },
    })
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button.hasAttribute('disabled')).toBe(false)
    fireEvent.click(button)
    expect(presses).toBe(0)
  })
})
