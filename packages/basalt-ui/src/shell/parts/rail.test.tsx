/**
 * The rail part: the DOM contract the layout tests find things by, the persisted section folds
 * (ported from 2.x "folded collapsible sections on the rail"), the search row and the footer.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { createNavRuntimeDouble } from '../core/nav-runtime'
import type { CoreNavConfig } from '../core/types'
import type { NavRuntime } from '../core/nav-runtime'
import { Rail } from './rail'
import type { RailProps } from './rail'
import { item, navOf, renderInRouter, section } from './rail-test-kit'

beforeEach(() => localStorage.clear())
afterEach(cleanup)

const BRAND = { name: 'Argo' }
const HOME_NAV = navOf(section('main', [item('home', 'Home'), item('runs', 'Runs')]))

function props(nav: CoreNavConfig, extra: Partial<RailProps> = {}): RailProps {
  return {
    runtime: createNavRuntimeDouble(nav, 'home') as NavRuntime,
    brand: BRAND,
    badges: undefined,
    blocks: [],
    settings: undefined,
    account: undefined,
    search: undefined,
    ...extra,
  }
}

const renderRail = (p: RailProps, collapsed = false) => renderInRouter(<Rail {...p} />, collapsed)

/** argo's nav shape: a section that is collapsible AND folded by default, holding a badged row. */
const foldedNav = (id: string): CoreNavConfig =>
  navOf(
    section('main', [item('home', 'Home')], { label: 'Main' }),
    section(id, [item('m365', 'M365 Explorer', { icon: () => <span /> })], {
      label: 'Elsewhere',
      collapsible: true,
      defaultCollapsed: true,
    }),
  )

describe('the rail DOM contract', () => {
  test('a labelled primary nav, a size container, a viewport and no footer when nothing pins', async () => {
    await renderRail(props(HOME_NAV))
    const nav = document.querySelector('[data-slot="shell-rail"]')!
    expect(nav.tagName).toBe('NAV')
    expect(nav.getAttribute('aria-label')).toBe('Primary')
    expect(nav.className).toContain('@container')
    const viewport = nav.querySelector('[data-slot="shell-rail-viewport"]')!
    expect(viewport.className).toContain('overflow-y-auto')
    expect(nav.querySelector('[data-slot="shell-rail-footer"]')).toBeNull()
  })

  test('the rail renders one set of parts: the same slots expanded and collapsed', async () => {
    const slots = () =>
      [...document.querySelectorAll('[data-slot^="shell-rail"]')].map((el) =>
        el.getAttribute('data-slot'),
      )
    const { unmount } = await renderRail(props(HOME_NAV))
    const expanded = slots()
    unmount()
    await renderRail(props(HOME_NAV), true)
    expect(slots()).toEqual(expanded)
  })

  test('the active row follows the runtime', async () => {
    const runtime = createNavRuntimeDouble(HOME_NAV, 'home')
    await renderRail(props(HOME_NAV, { runtime }))
    expect(screen.getByRole('link', { name: 'Home' }).getAttribute('aria-current')).toBe('page')
    runtime.setActive('runs')
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Runs' }).getAttribute('aria-current')).toBe('page'),
    )
    expect(screen.getByRole('link', { name: 'Home' }).hasAttribute('aria-current')).toBe(false)
  })

  test('a section label is a heading band; an unlabelled section renders none', async () => {
    await renderRail(
      props(
        navOf(
          section('a', [item('a1', 'Alpha')], { label: 'Group' }),
          section('b', [item('b1', 'Beta')]),
        ),
      ),
    )
    const labels = document.querySelectorAll('[data-slot="shell-rail-section-label"]')
    expect(labels).toHaveLength(1)
    expect(labels[0]!.textContent).toBe('Group')
    expect(labels[0]!.className).toContain('@max-[120px]:hidden')
  })

  test('the first section sits 6px in, later ones 16px apart', async () => {
    await renderRail(props(navOf(section('a', [item('a', 'A')]), section('b', [item('b', 'B')]))))
    const [first, second] = [...document.querySelectorAll('[data-slot="shell-rail-section"]')]
    expect(first!.className).toContain('mt-1.5')
    expect(second!.className).toContain('mt-4')
  })

  test('pinned rows render in the footer as rows', async () => {
    const nav: CoreNavConfig = { ...HOME_NAV, pinned: [item('help', 'Help')] }
    await renderRail(props(nav))
    const footer = document.querySelector('[data-slot="shell-rail-footer"]')!
    expect(footer.querySelector('[data-slot="shell-rail-row"]')?.getAttribute('aria-label')).toBe(
      'Help',
    )
    expect(footer.className).toContain('pt-3')
    expect(footer.className).toContain('pb-2.5')
  })
})

describe('search row', () => {
  test('no search prop, no search row', async () => {
    await renderRail(props(HOME_NAV))
    expect(document.querySelector('[data-slot="shell-rail-search"]')).toBeNull()
  })

  test('is a button with the Search name and a shortcut, opens the app search, and is no nav row', async () => {
    const onOpen = mock(() => undefined)
    await renderRail(props(HOME_NAV, { search: { onOpen } }))
    const search = screen.getByRole('button', { name: 'Search' })
    expect(search.hasAttribute('data-slot')).toBe(true)
    expect(search.getAttribute('data-slot')).toBe('shell-rail-search')
    expect(search.querySelectorAll('[data-slot="kbd"]')).toHaveLength(2)
    fireEvent.click(search)
    expect(onOpen).toHaveBeenCalledTimes(1)
    const rows = [...document.querySelectorAll('[data-slot="shell-rail-row"]')]
    expect(rows.every((row) => row.tagName === 'A')).toBe(true)
  })

  test('collapsed, the label is screen-reader-only and the shortcut is hidden by the container', async () => {
    await renderRail(props(HOME_NAV, { search: { onOpen: () => undefined } }), true)
    const search = screen.getByRole('button', { name: 'Search' })
    expect(search.querySelector('.\\@max-\\[120px\\]\\:sr-only')?.textContent).toBe('Search')
    expect(search.querySelector('[data-slot="kbd"]')?.parentElement?.className).toContain(
      '@max-[120px]:hidden',
    )
  })
})

describe('folded collapsible sections on the rail', () => {
  test('a folded section keeps its rows mounted, marked folded, for the rail to show', async () => {
    await renderRail(props(foldedNav('rail-elsewhere')), true)
    const link = screen.getByRole('link', { name: 'M365 Explorer' })
    const rows = link.closest('[data-slot="shell-rail-section-rows"]')!
    expect(rows.getAttribute('data-folded')).toBe('true')
    expect(rows.hasAttribute('hidden')).toBe(false)
    expect(rows.className).toContain('@max-[120px]:data-[folded=true]:flex')
  })

  test('the header is hidden in the collapsed rail by the container', async () => {
    await renderRail(props(foldedNav('hdr-elsewhere')), true)
    expect(screen.getByRole('button', { name: /Elsewhere/ }).className).toContain(
      '@max-[120px]:hidden',
    )
  })

  test('expanded, the same section stays folded', async () => {
    await renderRail(props(foldedNav('exp-elsewhere')))
    expect(screen.getByRole('button', { name: /Elsewhere/ }).getAttribute('aria-expanded')).toBe(
      'false',
    )
  })

  test('unfolding persists the envelope under basalt:sidebar-section:<id> and survives a remount', async () => {
    const id = 'persist-elsewhere'
    const { unmount } = await renderRail(props(foldedNav(id)))
    fireEvent.click(screen.getByRole('button', { name: /Elsewhere/ }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Elsewhere/ }).getAttribute('aria-expanded')).toBe(
        'true',
      ),
    )
    expect(JSON.parse(localStorage.getItem(`basalt:sidebar-section:${id}`)!)).toEqual({
      v: 1,
      value: false,
    })
    unmount()
    await renderRail(props(foldedNav(id)))
    expect(screen.getByRole('button', { name: /Elsewhere/ }).getAttribute('aria-expanded')).toBe(
      'true',
    )
    expect(
      screen
        .getByRole('link', { name: 'M365 Explorer' })
        .closest('[data-slot="shell-rail-section-rows"]')
        ?.getAttribute('data-folded'),
    ).toBe('false')
  })

  test('a stored fold beats defaultCollapsed', async () => {
    const id = 'stored-elsewhere'
    localStorage.setItem(`basalt:sidebar-section:${id}`, JSON.stringify({ v: 1, value: false }))
    await renderRail(props(foldedNav(id)))
    expect(screen.getByRole('button', { name: /Elsewhere/ }).getAttribute('aria-expanded')).toBe(
      'true',
    )
  })

  test('a folded header shows the rollup of its hidden rows', async () => {
    const nav = navOf(
      section('main', [item('home', 'Home')]),
      section('roll-elsewhere', [item('m', 'M365', { icon: () => <span /> })], {
        label: 'Elsewhere',
        collapsible: true,
        defaultCollapsed: true,
      }),
    )
    await renderRail(props(nav, { badges: { m: { count: 10 } } }))
    const header = screen.getByRole('button', { name: /Elsewhere/ })
    expect(header.querySelector('[data-slot="shell-rail-section-rollup"]')?.textContent).toBe('10')
  })

  test('a folded header says the current page is inside; an unfolded one does not', async () => {
    const nav = foldedNav('cue-elsewhere')
    const runtime = createNavRuntimeDouble(nav, 'm365')
    await renderRail(props(nav, { runtime }))
    const header = screen.getByRole('button', { name: /Elsewhere/ })
    expect(header.hasAttribute('data-contains-active')).toBe(true)
    expect(header.textContent).toContain('Contains the current page')
    fireEvent.click(header)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Elsewhere/ }).hasAttribute('data-contains-active'),
      ).toBe(false),
    )
  })

  test('a non-collapsible labelled section has a heading and no fold button', async () => {
    await renderRail(props(navOf(section('plain', [item('a', 'Alpha')], { label: 'Plain' }))))
    expect(screen.getByRole('heading', { name: 'Plain' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Plain/ })).toBeNull()
  })
  test('an unlabelled collapsible section is never folded: it has no header to unfold it', async () => {
    const nav = navOf(
      section('bare', [item('a', 'Alpha')], { collapsible: true, defaultCollapsed: true }),
    )
    await renderRail(props(nav))
    const rows = document.querySelector('[data-slot="shell-rail-section-rows"]')
    expect(rows?.getAttribute('data-folded')).toBe('false')
  })
})
