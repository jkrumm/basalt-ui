/**
 * Rail rows, ported from the 2.x sidebar's nav half (`app-sidebar.test.tsx`, `nav-glyph.test.tsx`):
 * links, active versus ancestor, the icon-less fallback, badges and the collapsed dot, and child
 * rows named by their label.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { createNavRuntimeDouble } from '../core/nav-runtime'
import { projectRail } from '../core/projector'
import type { RailRow } from '../core/projector'
import type { BadgeMap, CoreNavItem } from '../core/types'
import { RailRowView, initialOf } from './rail-rows'
import { item, navOf, renderInRouter, section } from './rail-test-kit'

afterEach(cleanup)

/** The projected first row of a one-section nav, as the rail would paint it. */
function rowOf(
  top: CoreNavItem[],
  options: { active?: string; ancestors?: string[]; badges?: BadgeMap } = {},
): RailRow[] {
  const nav = navOf(section('main', top))
  const runtime = createNavRuntimeDouble(nav, options.active, options.ancestors)
  const model = projectRail({
    nav,
    state: runtime.getState(),
    ...(options.badges !== undefined && { badges: options.badges }),
  })
  return [...model.sections[0]!.rows]
}

async function renderRows(rows: RailRow[], collapsed = false) {
  return renderInRouter(
    <div>
      {rows.map((row) => (
        <RailRowView key={row.id} row={row} />
      ))}
    </div>,
    collapsed,
  )
}

describe('initialOf', () => {
  test('uppercases the first letter', () => {
    expect(initialOf('inbox')).toBe('I')
  })

  test('an empty label falls back to a question mark', () => {
    expect(initialOf('')).toBe('?')
  })

  test('keeps a whole grapheme, not a lone code unit', () => {
    expect(initialOf('👨‍👩‍👧 Family')).toBe('👨‍👩‍👧')
    expect(initialOf('🇩🇪 Germany')).toBe('🇩🇪')
    expect(initialOf('école')).toBe('É')
  })
})

describe('rows are router links', () => {
  test('a row is an anchor with the row slot, its href and its label as the name', async () => {
    await renderRows(rowOf([item('home', 'Home')]))
    const link = screen.getByRole('link', { name: 'Home' })
    expect(link.getAttribute('data-slot')).toBe('shell-rail-row')
    expect(link.getAttribute('href')).toBe('/home')
    expect(link.querySelector('[data-slot="shell-rail-row-icon"]')).not.toBeNull()
  })
})

describe('active and ancestor rows', () => {
  test('only the active row carries aria-current="page"', async () => {
    await renderRows(rowOf([item('home', 'Home'), item('charts', 'Charts')], { active: 'home' }))
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Charts' }).hasAttribute('aria-current')).toBe(false)
  })

  test('an ancestor row carries data-ancestor and no aria-current', async () => {
    const rows = rowOf([item('dash', 'Dashboard', { children: [item('sessions', 'Sessions')] })], {
      active: 'sessions',
      ancestors: ['dash'],
    })
    await renderRows(rows)
    const parent = screen.getAllByRole('link', { name: 'Dashboard' })[0]!
    expect(parent.hasAttribute('data-ancestor')).toBe(true)
    expect(parent.hasAttribute('aria-current')).toBe(false)
    expect(screen.getByRole('link', { name: 'Sessions' }).getAttribute('aria-current')).toBe('page')
  })

  test('a row off the path has neither', async () => {
    await renderRows(rowOf([item('home', 'Home')]))
    const link = screen.getByRole('link', { name: 'Home' })
    expect(link.hasAttribute('data-ancestor')).toBe(false)
    expect(link.hasAttribute('aria-current')).toBe(false)
  })
})

describe('an icon-less item survives the collapsed rail', () => {
  test('falls back to the first letter, aria-hidden, and the link is named by its label', async () => {
    await renderRows(rowOf([item('inbox', 'inbox')]), true)
    const link = screen.getByRole('link', { name: 'inbox' })
    const glyph = link.querySelector('[data-slot="shell-rail-row-icon"] > [data-nav-glyph]')
    expect(glyph?.getAttribute('data-nav-glyph')).toBe('I')
    expect(glyph?.getAttribute('aria-hidden')).toBe('true')
  })

  test('a disabled icon-less row is inert, named, and still has its glyph', async () => {
    await renderRows(rowOf([item('soon', 'Soon', { disabled: true })]))
    const row = screen.getByLabelText('Soon')
    expect(row.tagName).toBe('SPAN')
    expect(row.getAttribute('aria-disabled')).toBe('true')
    expect(row.querySelector('[data-nav-glyph]')?.getAttribute('data-nav-glyph')).toBe('S')
  })

  test('a supplied icon is rendered as-is, with no fallback glyph', async () => {
    const Own = () => <svg data-testid="own-icon" />
    await renderRows(rowOf([item('home', 'Home', { icon: Own })]))
    expect(screen.getByTestId('own-icon')).toBeTruthy()
    expect(document.querySelector('[data-nav-glyph]')).toBeNull()
  })

  test('the glyph is replaced, not added, when the icon is falsy at runtime', async () => {
    await renderRows(rowOf([item('a', 'Alpha', { icon: false as never })]))
    expect(document.querySelector('[data-nav-glyph]')?.getAttribute('data-nav-glyph')).toBe('A')
  })
})

describe('badges', () => {
  const BADGES: BadgeMap = { cal: { count: 4 }, m365: { dot: true }, zero: { count: 0 } }
  const ITEMS = [
    item('cal', 'Calendar'),
    item('plain', 'Home'),
    item('m365', 'M365'),
    item('zero', 'Zero'),
  ]

  test('a counted row carries its count in the accessible name', async () => {
    await renderRows(rowOf(ITEMS, { badges: BADGES }))
    const row = screen.getByRole('link', { name: 'Calendar, 4' })
    expect(row.getAttribute('aria-label')).toBe('Calendar, 4')
    expect(row.querySelector('[data-slot="shell-rail-row-badge"]')?.textContent).toBe('4')
  })

  test('a counted row earns the rail dot; an unbadged or zero-count row does not', async () => {
    await renderRows(rowOf(ITEMS, { badges: BADGES }), true)
    const dot = (name: string) =>
      screen.getByRole('link', { name }).querySelector('[data-slot="shell-rail-dot"]')
    expect(dot('Calendar, 4')).not.toBeNull()
    expect(dot('Home')).toBeNull()
    expect(dot('Zero')).toBeNull()
  })

  test('a dot-only badge earns the dot and adds nothing to the name', async () => {
    await renderRows(rowOf(ITEMS, { badges: BADGES }))
    const row = screen.getByRole('link', { name: 'M365' })
    expect(row.querySelector('[data-slot="shell-rail-dot"]')).not.toBeNull()
  })

  test('the dot is visible only in the collapsed rail (container class), the badge only expanded', async () => {
    await renderRows(rowOf(ITEMS, { badges: BADGES }))
    const row = screen.getByRole('link', { name: 'Calendar, 4' })
    expect(row.querySelector('[data-slot="shell-rail-dot"]')?.className).toContain(
      '@max-[120px]:block',
    )
    expect(row.querySelector('[data-slot="shell-rail-row-badge"]')?.className).toContain(
      '@max-[120px]:hidden',
    )
  })

  test('attention is the one warn tone, a plain badge is neutral', async () => {
    await renderRows(
      rowOf([item('a', 'Alert'), item('b', 'Plain')], {
        badges: { a: { count: 2, attention: true }, b: { count: 2 } },
      }),
    )
    const tone = (name: string) =>
      screen
        .getByRole('link', { name })
        .querySelector('[data-slot="shell-rail-dot"]')
        ?.getAttribute('data-tone')
    expect(tone('Alert, 2')).toBe('warn')
    expect(tone('Plain, 2')).toBe('neutral')
  })

  test('a parent shows the dot for a badge that only a child carries', async () => {
    const rows = rowOf([item('p', 'Parent', { children: [item('k', 'Kid')] })], {
      badges: { k: { count: 1 } },
    })
    await renderRows(rows, true)
    const parent = screen.getAllByRole('link', { name: 'Parent' })[0]!
    expect(parent.querySelector('[data-slot="shell-rail-dot"]')).not.toBeNull()
  })
})

describe('child rows are named by their visible label', () => {
  const kids = [item('on', 'enabled kid'), item('off', 'disabled kid', { disabled: true })]
  const parent = () => rowOf([item('parent', 'Parent', { children: kids })])

  test('inline under the parent when expanded', async () => {
    await renderRows(parent())
    const enabled = screen.getByRole('link', { name: 'enabled kid' })
    expect(enabled.getAttribute('data-depth')).toBe('1')
    expect(enabled.closest('[data-slot="shell-rail-children"]')).not.toBeNull()
    expect(enabled.querySelector('[data-nav-glyph]')?.getAttribute('data-nav-glyph')).toBe('E')

    const disabled = screen.getByLabelText('disabled kid')
    expect(disabled.getAttribute('aria-disabled')).toBe('true')
    expect(disabled.querySelector('[data-nav-glyph]')?.getAttribute('aria-hidden')).toBe('true')
  })

  test('the inline list is the container-hidden form: collapsed, the popover lists them', async () => {
    await renderRows(parent(), true)
    expect(document.querySelector('[data-slot="shell-rail-children"]')?.className).toContain(
      '@max-[120px]:hidden',
    )
    fireEvent.click(screen.getAllByRole('link', { name: 'Parent' })[0]!)
    await waitFor(() =>
      expect(document.querySelector('[data-slot="popover-content"]')).not.toBeNull(),
    )
    const popover = document.querySelector('[data-slot="popover-content"]')!
    expect(popover.getAttribute('aria-label')).toBe('Parent')
    expect(popover.querySelector('[aria-label="enabled kid"]')).not.toBeNull()
    expect(
      popover
        .querySelector('[aria-label="disabled kid"] [data-nav-glyph]')
        ?.getAttribute('data-nav-glyph'),
    ).toBe('D')
  })

  test('expanded, a click on the parent navigates and never opens the popover', async () => {
    await renderRows(parent())
    fireEvent.click(screen.getAllByRole('link', { name: 'Parent' })[0]!)
    await Promise.resolve()
    expect(document.querySelector('[data-slot="popover-content"]')).toBeNull()
  })
})
