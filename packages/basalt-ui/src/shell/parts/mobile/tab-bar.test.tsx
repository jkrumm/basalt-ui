/**
 * The phone tab bar and its surfaces, through behaviour, ARIA and DOM structure. happy-dom cannot
 * lay out, so geometry (floors, safe-area, lift) is `tests/layout/shell-mobile-nav.layout.test.ts`.
 * The bar mounts under a memory router: its tabs and rows are the items' own router anchors.
 *
 * A surface mounts a frame after the tap that opens it and unmounts after its exit animation, so
 * every open/close assertion is a `waitFor`. A disappearance is awaited by throwing a plain `Error`
 * rather than failing an `expect` inside the callback: a failed matcher serializes a whole happy-dom
 * node on every poll, which outlasts the poll timeout.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import type { ReactElement } from 'react'
import { createNavRuntimeDouble } from '../../core/nav-runtime'
import type { NavRuntimeDouble } from '../../core/nav-runtime'
import type { CoreNavConfig, CoreNavItem, CoreNavSection } from '../../core/types'
import { TabBar } from './tab-bar'
import type { TabBarProps } from './tab-bar'

// ── fixtures ─────────────────────────────────────────────────────────────────────────────────────

/** A declared item: `link` rides beside the core fields exactly as `defineNav` leaves it. */
function item(id: string, extra: Record<string, unknown> = {}): CoreNavItem {
  const label = id.slice(0, 1).toUpperCase() + id.slice(1)
  return { id, label, link: { to: `/${id}` }, ...extra } as unknown as CoreNavItem
}

function section(
  id: string,
  items: CoreNavItem[],
  extra: Partial<CoreNavSection> = {},
): CoreNavSection {
  return { id, label: id.slice(0, 1).toUpperCase() + id.slice(1), items, ...extra }
}

const Icon = ({ className }: { className?: string }): ReactElement => (
  <svg data-testid="icon" className={className} aria-hidden="true" />
)

/** home + runs are tabs; reports, billing (disabled) and the Admin section's users overflow to More. */
const BASE_NAV: CoreNavConfig = {
  sections: [
    section('main', [
      item('home', { mobile: 'tab', icon: Icon }),
      item('runs', { mobile: 'tab', icon: Icon }),
      item('reports'),
      item('billing', { disabled: true }),
    ]),
    section('admin', [item('users')]),
  ],
}

type Mounted = {
  router: { state: { status: string; location: { pathname: string } }; history: { length: number } }
  runtime: NavRuntimeDouble
}

async function mount(
  nav: CoreNavConfig,
  activeId: string | undefined,
  props: Partial<TabBarProps> = {},
  entry = '/',
): Promise<Mounted> {
  const runtime = createNavRuntimeDouble(nav, activeId)
  const rootRoute = createRootRoute({
    component: () => (
      <TabBar
        runtime={runtime}
        badges={undefined}
        blocks={[]}
        globalActions={[]}
        settings={undefined}
        account={undefined}
        {...props}
      />
    ),
  })
  const splat = createRoute({ getParentRoute: () => rootRoute, path: '$', component: () => null })
  const index = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => null })
  const router = createRouter({
    routeTree: rootRoute.addChildren([index, splat]),
    history: createMemoryHistory({ initialEntries: [entry] }),
  })
  render(<RouterProvider router={router} />)
  await waitFor(() => expect(router.state.status).toBe('idle'))
  await screen.findByRole('navigation', { name: 'Primary' })
  return { router, runtime }
}

/** Queried by the DOM, not by role: an open surface makes everything behind it inert and hidden. */
const bar = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('nav[aria-label="Primary"]')
  if (found === null) throw new Error('no tab bar')
  return found
}
const tab = (name: string): HTMLElement => {
  const found = bar().querySelector<HTMLElement>(`[aria-label="${name}"]`)
  if (found === null) throw new Error(`no tab named ${name}`)
  return found
}
const dialog = (): HTMLElement | null => document.querySelector('[role="dialog"]')

async function opened(): Promise<HTMLElement> {
  return waitFor(() => {
    const found = dialog()
    if (found === null) throw new Error('no surface is open')
    return found
  })
}

async function closed(): Promise<void> {
  await waitFor(() => {
    if (dialog() !== null) throw new Error('a surface is still open')
  })
}

const rows = (root: ParentNode): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>('[data-slot="shell-sheet-rows"]'),
]

async function openMore(): Promise<HTMLElement> {
  fireEvent.click(tab('More'))
  return opened()
}

/** A section tab with `count` destinations: a menu up to the 12-row cap, a sheet past it. */
function sectionNav(count: number): CoreNavConfig {
  const items = Array.from({ length: count }, (_, index) => item(`page${index}`))
  return {
    sections: [
      section('main', [item('home', { mobile: 'tab' })]),
      section('docs', items, { mobile: { tab: true } }),
    ],
  }
}

beforeEach(() => {
  // A bar with its tabs mounted must not trip the dev warning of an unrelated test.
  spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  mock.restore()
})

// ── the bar ──────────────────────────────────────────────────────────────────────────────────────

describe('TabBar structure', () => {
  test('the bar is nav[aria-label="Primary"] and sits inside the footer', async () => {
    await mount(BASE_NAV, 'home')
    const nav = document.querySelector('nav[aria-label="Primary"]')
    expect(nav?.getAttribute('data-slot')).toBe('shell-tab-bar')
    expect(nav?.parentElement?.getAttribute('data-slot')).toBe('shell-footer')
  })

  test('a link slot renders the item router anchor and opens no dialog', async () => {
    const { router } = await mount(BASE_NAV, 'home')
    const runs = tab('Runs')
    expect(runs.tagName).toBe('A')
    expect(runs.getAttribute('href')).toBe('/runs')
    expect(runs.hasAttribute('aria-haspopup')).toBe(false)
    fireEvent.click(runs)
    await waitFor(() => expect(router.state.location.pathname).toBe('/runs'))
    expect(dialog()).toBeNull()
  })

  test('an icon-less slot shows an aria-hidden first-letter glyph and keeps its name', async () => {
    const nav: CoreNavConfig = {
      sections: [section('main', [item('home', { mobile: 'tab', short: 'start' })])],
    }
    await mount(nav, 'home')
    const home = tab('Home')
    const glyph = home.querySelector('span[aria-hidden="true"]')
    expect(glyph?.getAttribute('data-letter')).toBe('S')
    expect(home.getAttribute('aria-label')).toBe('Home')
    expect(home.querySelector('p')?.textContent).toBe('start')
  })

  test('an icon is rendered aria-hidden in place of the letter', async () => {
    await mount(BASE_NAV, 'home')
    const icon = tab('Home').querySelector('[data-testid="icon"]')
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
  })

  test('the More tab carries the chrome glyph, the label, and no letter', async () => {
    await mount(BASE_NAV, 'home')
    const more = tab('More')
    expect(more.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(more.textContent).toBe('More')
  })

  test('an item covered by a tab is not also lit in More: one aria-current among tabs and rows', async () => {
    await mount(BASE_NAV, 'home')
    await openMore()
    expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
    expect(tab('Home').getAttribute('aria-current')).toBe('page')
    expect(tab('More').hasAttribute('aria-current')).toBe(false)
  })

  test('an active item that lives in More lights the More tab and exactly one row', async () => {
    await mount(BASE_NAV, 'reports')
    const surface = await openMore()
    expect([...bar().querySelectorAll('a')].some((a) => a.hasAttribute('aria-current'))).toBe(false)
    expect(tab('More').getAttribute('aria-current')).toBe('page')
    const lit = rows(surface).filter((row) => row.getAttribute('aria-current') === 'page')
    expect(lit).toHaveLength(1)
    expect(lit[0]?.textContent).toBe('Reports')
  })
})

// ── surfaces ─────────────────────────────────────────────────────────────────────────────────────

describe('surface tabs', () => {
  test('a surface tab is a button with aria-haspopup="dialog" and a live aria-expanded', async () => {
    await mount(BASE_NAV, 'home')
    const more = tab('More')
    expect(more.tagName).toBe('BUTTON')
    expect(more.getAttribute('aria-haspopup')).toBe('dialog')
    expect(more.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(more)
    await opened()
    expect(tab('More').getAttribute('aria-expanded')).toBe('true')
  })

  test('a section tab with several destinations opens a menu dialog at or under menuMax rows', async () => {
    await mount(sectionNav(12), 'home')
    fireEvent.click(tab('Docs'))
    const surface = await opened()
    expect(surface.querySelector('[data-slot="shell-menu"]')).not.toBeNull()
    expect(surface.querySelector('[data-slot="shell-sheet"]')).toBeNull()
    expect(rows(surface)).toHaveLength(12)
  })

  test('past menuMax the same tab opens a sheet', async () => {
    await mount(sectionNav(13), 'home')
    fireEvent.click(tab('Docs'))
    const surface = await opened()
    expect(surface.querySelector('[data-slot="shell-sheet"]')).not.toBeNull()
    expect(surface.querySelector('[data-slot="shell-menu"]')).toBeNull()
  })

  test('a dialog is named by its tab label', async () => {
    await mount(BASE_NAV, 'home')
    const surface = await openMore()
    expect(within(surface).getByText('More')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'More' })).toBe(surface)
  })

  test('a second tap on the same surface tab closes it', async () => {
    await mount(BASE_NAV, 'home')
    await openMore()
    fireEvent.click(tab('More'))
    await closed()
    expect(tab('More').getAttribute('aria-expanded')).toBe('false')
  })

  test('Escape closes the surface and returns focus to the tab', async () => {
    await mount(BASE_NAV, 'home')
    const more = tab('More')
    more.focus()
    const surface = await openMore()
    fireEvent.keyDown(surface, { key: 'Escape' })
    await closed()
    await waitFor(() => expect(document.activeElement).toBe(tab('More')))
  })

  test('the More rows are grouped under their section heading', async () => {
    await mount(BASE_NAV, 'home')
    const surface = await openMore()
    const text = surface.textContent ?? ''
    expect(text).toContain('Main')
    expect(text).toContain('Admin')
    expect(rows(surface).map((row) => row.textContent)).toEqual(['Reports', 'Billing', 'Users'])
  })

  test('a destination row is the item router anchor', async () => {
    await mount(BASE_NAV, 'home')
    const surface = await openMore()
    const reports = within(surface).getByText('Reports').closest('a')
    expect(reports?.getAttribute('href')).toBe('/reports')
  })

  test('a disabled row is aria-disabled, not a link, fires nothing and does not dismiss', async () => {
    const { router } = await mount(BASE_NAV, 'home')
    const surface = await openMore()
    const billing = within(surface).getByText('Billing').closest('[data-slot="shell-sheet-rows"]')
    expect(billing?.getAttribute('aria-disabled')).toBe('true')
    expect(billing?.tagName).not.toBe('A')
    expect(within(surface).queryByRole('link', { name: 'Billing' })).toBeNull()
    fireEvent.click(billing as Element)
    await Promise.resolve()
    expect(dialog()).not.toBeNull()
    expect(router.state.location.pathname).toBe('/')
  })

  test('a row tap inside More closes the surface and navigates', async () => {
    const { router } = await mount(BASE_NAV, 'home')
    const surface = await openMore()
    fireEvent.click(within(surface).getByText('Reports'))
    await closed()
    await waitFor(() => expect(router.state.location.pathname).toBe('/reports'))
  })

  test('retapping the active row inside More at rest keeps the location and closes the surface', async () => {
    const { router } = await mount(BASE_NAV, 'reports', {}, '/reports')
    const surface = await openMore()
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    fireEvent(within(surface).getByText('Reports'), click)
    expect(click.defaultPrevented).toBe(true)
    await closed()
    expect(router.state.location.pathname).toBe('/reports')
  })
})

// ── extras ───────────────────────────────────────────────────────────────────────────────────────

describe('More extras', () => {
  test('settings rows render in More and fire their callback', async () => {
    const onClick = mock(() => {})
    await mount(BASE_NAV, 'home', {
      settings: { mode: 'menu', items: [{ id: 'prefs', label: 'Preferences', onClick }] },
    })
    const surface = await openMore()
    fireEvent.click(within(surface).getByRole('button', { name: 'Preferences' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    await closed()
  })

  test('a signed-out account offers Sign in', async () => {
    const onSignIn = mock(() => {})
    await mount(BASE_NAV, 'home', { account: { status: 'signed-out', onSignIn } })
    const surface = await openMore()
    fireEvent.click(within(surface).getByRole('button', { name: 'Sign in' }))
    expect(onSignIn).toHaveBeenCalledTimes(1)
  })

  test('a signed-in account lists identity, its rows and Sign out, in that order', async () => {
    const onRow = mock(() => {})
    const onSignOut = mock(() => {})
    await mount(BASE_NAV, 'home', {
      account: {
        status: 'signed-in',
        name: 'Ada Lovelace',
        detail: 'ada@example.com',
        rows: [{ label: 'Manage account', onClick: onRow }],
        onSignOut,
      },
    })
    const surface = await openMore()
    const labels = rows(surface).map((row) => row.textContent)
    expect(labels.slice(-3)).toEqual(['Ada Lovelaceada@example.com', 'Manage account', 'Sign out'])
    fireEvent.click(within(surface).getByRole('button', { name: 'Manage account' }))
    expect(onRow).toHaveBeenCalledTimes(1)
    await closed()
  })

  test('Sign out fires its callback', async () => {
    const onSignOut = mock(() => {})
    await mount(BASE_NAV, 'home', { account: { status: 'signed-in', name: 'Ada', onSignOut } })
    const surface = await openMore()
    fireEvent.click(within(surface).getByRole('button', { name: 'Sign out' }))
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  test('a loading account adds no row', async () => {
    await mount(BASE_NAV, 'home', { account: { status: 'loading' } })
    const surface = await openMore()
    expect(rows(surface).map((row) => row.textContent)).toEqual(['Reports', 'Billing', 'Users'])
  })

  test('a progress block row fires its own onClick and raises no sheet', async () => {
    const onClick = mock(() => {})
    const block = {
      kind: 'progress',
      id: 'quota',
      label: 'Quota',
      value: 0.7,
      mobile: 'more',
      onClick,
    }
    await mount(BASE_NAV, 'home', { blocks: [block] as never })
    const surface = await openMore()
    fireEvent.click(within(surface).getByRole('button', { name: 'Quota · 70%' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  test('a custom block renders its declared content in a nested sheet', async () => {
    const render = mock((_box: unknown) => <p data-testid="declared">Declared body</p>)
    const icon = Icon
    await mount(BASE_NAV, 'home', {
      blocks: [{ kind: 'custom', id: 'tree', mobile: { label: 'Tree', icon }, render }],
    })
    const surface = await openMore()
    fireEvent.click(within(surface).getByRole('button', { name: 'Tree' }))
    await waitFor(() => {
      if (document.querySelector('[data-testid="declared"]') === null) throw new Error('not yet')
    })
    expect(render).toHaveBeenCalled()
    expect(render.mock.calls[0]).toEqual([{ height: 560, sizeClass: 'compact' }])
  })

  test('a list block opens its nested sheet a frame after More closes, not in the same handler', async () => {
    const onItem = mock(() => {})
    const list = {
      kind: 'list',
      id: 'await',
      label: 'Awaiting',
      items: [{ id: 'a', label: 'First', meta: 'now', onClick: onItem }],
    }
    await mount(BASE_NAV, 'home', { blocks: [list] as never })
    const surface = await openMore()

    const frames: FrameRequestCallback[] = []
    const real = window.requestAnimationFrame
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    }) as typeof window.requestAnimationFrame
    try {
      fireEvent.click(within(surface).getByRole('button', { name: 'Awaiting · 1' }))
      // The closing surface may queue its own frames; ours is among them and has not run.
      expect(frames.length).toBeGreaterThanOrEqual(1)
      expect(screen.queryByText('First · now')).toBeNull()
      await act(async () => {
        for (const callback of frames) callback(0)
      })
    } finally {
      window.requestAnimationFrame = real
    }
    const sheet = await screen.findByRole('dialog', { name: 'Awaiting · 1' })
    expect(sheet.querySelector('[data-slot="shell-sheet"]')).not.toBeNull()
    fireEvent.click(within(sheet).getByRole('button', { name: 'First · now' }))
    expect(onItem).toHaveBeenCalledTimes(1)
  })
})

// ── badges ───────────────────────────────────────────────────────────────────────────────────────

describe('badges', () => {
  const dotOf = (node: HTMLElement): Element | null =>
    node.querySelector('span[aria-hidden="true"].rounded-full')

  test('a lit badge is a dot on the tab icon', async () => {
    await mount(BASE_NAV, 'home', { badges: { runs: { count: 3 } } })
    expect(dotOf(tab('Runs'))).not.toBeNull()
    expect(dotOf(tab('Home'))).toBeNull()
  })

  test('an attention badge uses the warn tone', async () => {
    await mount(BASE_NAV, 'home', { badges: { runs: { dot: true, attention: true } } })
    expect(dotOf(tab('Runs'))?.className).toContain('bg-warn')
  })

  test('a count of 0 shows no dot', async () => {
    await mount(BASE_NAV, 'home', { badges: { runs: { count: 0 } } })
    expect(dotOf(tab('Runs'))).toBeNull()
  })

  test('the More tab rolls up the badges of its overflow rows', async () => {
    await mount(BASE_NAV, 'home', { badges: { reports: { count: 2 } } })
    expect(dotOf(tab('More'))).not.toBeNull()
  })

  test('a row shows its CountBadge with the count', async () => {
    await mount(BASE_NAV, 'home', { badges: { reports: { count: 7 } } })
    const surface = await openMore()
    const row = within(surface).getByText('Reports').closest('a')
    expect(row?.textContent).toContain('7')
  })

  test('a count of 0 renders no CountBadge on a row', async () => {
    await mount(BASE_NAV, 'home', { badges: { reports: { count: 0 } } })
    const surface = await openMore()
    expect(within(surface).getByText('Reports').closest('a')?.textContent).toBe('Reports')
  })
})

// ── dev diagnostics ──────────────────────────────────────────────────────────────────────────────

describe('short label warning', () => {
  const nav: CoreNavConfig = {
    sections: [section('main', [item('home', { mobile: 'tab', short: 'Overview page' })])],
  }
  const longWarnings = (): unknown[] =>
    (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map((call) => String(call[0]))
      .filter((message) => message.includes('characters'))

  test('a short longer than 10 characters warns in development', async () => {
    await mount(nav, 'home')
    expect(longWarnings().length).toBeGreaterThan(0)
    expect(longWarnings()[0]).toContain('Overview page')
  })

  test('a short of exactly 10 characters does not warn', async () => {
    await mount(
      { sections: [section('main', [item('home', { mobile: 'tab', short: 'Ten chars!' })])] },
      'home',
    )
    expect(longWarnings()).toHaveLength(0)
  })

  test('production stays silent', async () => {
    const saved = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      await mount(nav, 'home')
      expect(longWarnings()).toHaveLength(0)
    } finally {
      if (saved === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = saved
    }
  })
})

// ── the retap on a tab ───────────────────────────────────────────────────────────────────────────

describe('retap on the bar', () => {
  test('a tap on a non-active tab navigates', async () => {
    const { router } = await mount(BASE_NAV, 'home')
    fireEvent.click(tab('Runs'))
    await waitFor(() => expect(router.state.location.pathname).toBe('/runs'))
  })

  test('a tap on the active tab at rest re-navigates nowhere', async () => {
    const { router } = await mount(BASE_NAV, 'runs', {}, '/runs')
    const before = router.history.length
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    fireEvent(tab('Runs'), click)
    expect(click.defaultPrevented).toBe(true)
    expect(router.state.location.pathname).toBe('/runs')
    expect(router.history.length).toBe(before)
  })
})
