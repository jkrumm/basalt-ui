/**
 * `SyncButton` — the age formatting and the syncing state (law C12, `docs/CONTROLS-SPEC.md` §3).
 *
 * The age is the part that had four hand-rolled copies across consumers, each with its own
 * rounding; it now comes from `format/relativeTime` (boundaries pinned in `format/date.test.ts`).
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { resetFormatDefaults } from '../format/shared'
import { BasaltProvider } from '../provider'
import { testRouter } from '../provider/test-router'
import { AGE_REFRESH_MS, SyncButton } from './sync-button'

function renderSync(props: Partial<Parameters<typeof SyncButton>[0]> = {}) {
  return render(
    <MantineProvider>
      <SyncButton syncing={false} scope="page" onSync={() => {}} {...props} />
    </MantineProvider>,
  )
}

describe('age label', () => {
  test('anything under a minute reads as the locale\'s "now", so a fresh sync stops flickering', () => {
    renderSync({ lastCompletedAt: Date.now() - 5_000 })
    expect(screen.getByRole('button').textContent).toContain('now')
    expect(screen.getByRole('button').textContent).not.toContain('ago')
  })

  test('the refresh interval is coarser than the smallest unit it renders', () => {
    expect(AGE_REFRESH_MS).toBeLessThanOrEqual(60_000)
  })
})

describe('SyncButton', () => {
  test('renders the age beside the label on desktop', () => {
    renderSync({ lastCompletedAt: Date.now() - 2 * 60_000 })
    expect(screen.getByRole('button').textContent).toContain('Sync')
    expect(screen.getByRole('button').textContent).toContain('2 min. ago')
  })

  test('a Date and an epoch number are the same input', () => {
    renderSync({ lastCompletedAt: new Date(Date.now() - 3 * 60_000) })
    expect(screen.getByRole('button').textContent).toContain('3 min. ago')
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

describe('format locale', () => {
  const Original = Intl.RelativeTimeFormat
  class GermanHost extends Original {
    constructor(locales?: string | string[], options?: Intl.RelativeTimeFormatOptions) {
      super(locales ?? 'de', options)
    }
  }
  beforeEach(() => {
    Object.defineProperty(Intl, 'RelativeTimeFormat', {
      value: GermanHost,
      configurable: true,
      writable: true,
    })
  })
  afterEach(() => {
    cleanup()
    resetFormatDefaults()
    Object.defineProperty(Intl, 'RelativeTimeFormat', {
      value: Original,
      configurable: true,
      writable: true,
    })
  })

  async function ageUnder(locale: string) {
    const router = testRouter('x', () => (
      <SyncButton
        syncing={false}
        scope="page"
        onSync={() => {}}
        lastCompletedAt={Date.now() - 2 * 60_000}
      />
    ))
    render(<BasaltProvider router={router} locale={locale} />)
    return (await screen.findByRole('button', { name: /sync/i })).textContent
  }

  test('BasaltProvider locale="en-GB" wins over a German host', async () => {
    expect(await ageUnder('en-GB')).toContain('2 min ago')
  })

  test('BasaltProvider locale="de" reads German', async () => {
    expect(await ageUnder('de')).toContain('vor 2 Min.')
  })
})

/**
 * `scope: 'page'` below `sm` keeps a SHORT age beside the icon (argo m365 refresh at 390). The long
 * age and the label are `display: none` there; the compact one is the only text that survives, so
 * the form is queryable by a data attribute and its CSS is pinned against the shipped stylesheet.
 */
describe('the compact age below sm', () => {
  test.each([
    [30_000, 'now'],
    [2 * 60_000, '2m'],
    [3 * 3_600_000, '3h'],
    [2 * 86_400_000, '2d'],
  ])('%ims ago renders "%s"', (ago, text) => {
    renderSync({ lastCompletedAt: Date.now() - ago })
    expect(document.querySelector('[data-sync-age="compact"]')?.textContent).toBe(text)
  })

  test('the unit follows the format locale (Intl narrow unit), not a hard-coded letter', async () => {
    const router = testRouter('x', () => (
      <SyncButton
        syncing={false}
        scope="page"
        onSync={() => {}}
        lastCompletedAt={Date.now() - 2 * 60_000}
      />
    ))
    render(<BasaltProvider router={router} locale="de" />)
    await screen.findByRole('button', { name: /sync/i })
    const compact = document.querySelector('[data-sync-age="compact"]')?.textContent
    expect(compact).toBe(
      new Intl.NumberFormat('de', { style: 'unit', unit: 'minute', unitDisplay: 'narrow' }).format(
        2,
      ),
    )
    expect(compact).not.toBe('2 m')
    resetFormatDefaults()
  })

  test('no age, no compact span', () => {
    renderSync({ lastCompletedAt: null })
    expect(document.querySelector('[data-sync-age="compact"]')).toBeNull()
  })

  test('global scope stays icon-only: no compact age either', () => {
    renderSync({ scope: 'global', lastCompletedAt: Date.now() - 120_000 })
    expect(document.querySelector('[data-sync-age="compact"]')).toBeNull()
  })

  test('the phone form shows the compact age, hides the long one, and never wraps', () => {
    const css = readFileSync(
      resolve(import.meta.dirname, 'sync-button.module.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    const phone = css.slice(css.indexOf('@media (max-width: 52.49375em)'))
    expect(phone).toMatch(/\.age\s*\{[^}]*display:\s*none/)
    expect(phone).toMatch(/\.ageCompact\s*\{[^}]*display:\s*inline/)
    expect(css).toMatch(/\.ageCompact\s*\{[^}]*white-space:\s*nowrap/)
    // The square pin is released when an age rides beside the glyph.
    expect(phone).toMatch(/\.pageButton\[data-with-age\]\s*\{[^}]*width:\s*auto/)
  })
})
