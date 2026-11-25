/**
 * The phone nav seam, through behaviour and DOM: the default renders the section bar, `tabs` the tab
 * bar; the section bar shows SECTIONS with summed badges, opens a section's short drawer, makes a
 * one-item section a link, reveals the rail behind More (search pinned at its foot) and steps out of
 * the keyboard's way. Geometry (44 px, the home indicator, the bottom half, the field)
 * is `tests/layout/shell-phone-nav.layout.test.ts`.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { createNavRuntimeDouble } from '../../core/nav-runtime'
import { RailControlProvider } from '../grid'
import { control } from '../rail-test-kit'
import type { CoreNavConfig, CoreNavItem, CoreNavSection } from '../../core/types'
import { PhoneNav } from './phone-nav'
import type { PhoneNavProps } from './phone-nav'
import { PHONE_NAV_ATTRIBUTE, readPhoneNav } from './variant'
import { raisesKeyboard } from './section-nav/chrome-state'
import { barModel } from './section-nav/model'
import { drawerSizes } from './section-nav/snaps'

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
const OpsIcon = ({ className }: { className?: string }): ReactElement => (
  <svg data-testid="ops-icon" className={className} aria-hidden="true" />
)

/** Five sections: the first four are bar slots, `later` is behind More. `admin` holds one page. */
const NAV: CoreNavConfig = {
  sections: [
    section('main', [
      item('home', { icon: Icon }),
      item('runs', { icon: Icon }),
      item('reports', { icon: Icon }),
    ]),
    section('admin', [item('users', { icon: Icon })]),
    section('ops', [item('alerts'), item('jobs')], { icon: OpsIcon }),
    section('docs', [item('guide'), item('api')]),
    section('later', [item('old'), item('older')]),
  ],
}

const BADGES = {
  runs: { count: 4 },
  reports: { count: 2 },
  jobs: { dot: true },
  old: { count: 1 },
} as const

type Happy = { happyDOM: { setViewport(size: { width: number; height: number }): void } }

/** The router of the last mount: what a tap navigated to is read off it. */
let mounted: { state: { location: { pathname: string } } } | null = null

async function mount(variant: PhoneNavProps['variant']): Promise<void> {
  // A phone: the More sidebar is drawn only below 840 px, where the rail is not on screen.
  ;(window as unknown as Happy).happyDOM.setViewport({ width: 390, height: 844 })
  const runtime = createNavRuntimeDouble(NAV, 'home')
  const rootRoute = createRootRoute({
    component: () => (
      <RailControlProvider value={control(false)}>
        <div data-slot="shell">
          <PhoneNav
            variant={variant}
            brand={{ name: 'Basalt' }}
            runtime={runtime}
            badges={BADGES}
            blocks={[]}
            globalActions={[]}
            settings={undefined}
            account={{ status: 'signed-out', onSignIn: () => {} }}
          />
        </div>
      </RailControlProvider>
    ),
  })
  const splat = createRoute({ getParentRoute: () => rootRoute, path: '$', component: () => null })
  const index = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => null })
  const router = createRouter({
    routeTree: rootRoute.addChildren([index, splat]),
    history: createMemoryHistory({ initialEntries: ['/home'] }),
  })
  mounted = router
  render(<RouterProvider router={router} />)
  await waitFor(() => expect(router.state.status).toBe('idle'))
}

const slot = (name: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-slot="${name}"]`)

async function found(name: string): Promise<HTMLElement> {
  let el: HTMLElement | null = null
  await waitFor(() => {
    el = slot(name)
    if (el === null) throw new Error(`no ${name}`)
  })
  return el as unknown as HTMLElement
}

afterEach(() => {
  cleanup()
  ;(window as unknown as Happy).happyDOM.setViewport({ width: 1024, height: 768 })
  document.documentElement.removeAttribute(PHONE_NAV_ATTRIBUTE)
})

describe('the phone nav pick', () => {
  test('the section bar is the default; only "tabs" on <html> opts into the tab bar', () => {
    expect(readPhoneNav()).toBe('drawer')
    document.documentElement.setAttribute(PHONE_NAV_ATTRIBUTE, 'tabs')
    expect(readPhoneNav()).toBe('tabs')
    document.documentElement.setAttribute(PHONE_NAV_ATTRIBUTE, 'tray')
    expect(readPhoneNav()).toBe('drawer')
  })

  test('the tab bar renders on its own, with nothing of the section bar', async () => {
    await mount('tabs')
    await found('shell-tab-bar')
    expect(slot('shell-phone-bar')).toBeNull()
  })
})

describe('the drawer sizes', () => {
  // A 390x844 phone: 99 px of bar (64 + seam + 34 home indicator), so 745 px above it.
  const phone = { area: 745, bar: 99 }

  test('a list that fits above the middle of the screen has one rest', () => {
    const sizes = drawerSizes({ ...phone, natural: 240 })
    expect(sizes).toMatchObject({ short: 240, tall: 240, snaps: false })
  })

  test('a longer list rests short at the middle of the screen and tall at 85 % of it', () => {
    const sizes = drawerSizes({ ...phone, natural: 900 })
    if (sizes === null) throw new Error('no sizes')
    expect(sizes.snaps).toBe(true)
    // The drawer's top at the short rest is at or below half of the 844 px screen.
    expect(phone.area - sizes.short).toBeGreaterThanOrEqual(422)
    // The tall rest is 85 % of the screen from its bottom edge, the bar included.
    expect(sizes.tall + phone.bar).toBeLessThanOrEqual(0.85 * 844 + 1)
    expect(sizes.popup).toBe(sizes.tall)
  })

  test('a list a few px over the short height rests whole, not clipped', () => {
    const sizes = drawerSizes({ ...phone, natural: 330 })
    expect(sizes).toMatchObject({ short: 330, tall: 330, snaps: false })
  })

  test('nothing is sized before the rows are measured', () => {
    expect(drawerSizes({ ...phone, natural: 0 })).toBeNull()
    expect(drawerSizes({ area: 0, bar: 0, natural: 300 })).toBeNull()
  })
})

describe('the bar model', () => {
  const model = barModel(
    { nav: NAV, state: { activeId: 'home', ancestorIds: new Set<string>() }, badges: BADGES },
    NAV.sections,
  )

  test('the first four sections are slots; the fifth is behind More', () => {
    expect(model.sections.map((s) => s.id)).toEqual(['main', 'admin', 'ops', 'docs'])
    expect(model.more.badge).toEqual({ count: 1 })
  })

  test('a section badge is the sum of its items, a dot when only dots are lit', () => {
    expect(model.sections[0]?.badge).toEqual({ count: 6 })
    expect(model.sections[2]?.badge).toEqual({ dot: true })
    expect(model.sections[3]?.badge).toBeNull()
  })

  test("the section's icon wins, else its first destination's", () => {
    expect(model.sections[2]?.icon).toBe(OpsIcon)
    expect(model.sections[0]?.icon).toBe(Icon)
  })

  test('a section of one destination is that destination', () => {
    expect(model.sections[1]?.only?.id).toBe('users')
    expect(model.sections[0]?.only).toBeUndefined()
    expect(model.sections[0]?.active).toBe(true)
  })
})

describe('the keyboard signal', () => {
  const make = (html: string): Element => {
    const host = document.createElement('div')
    host.innerHTML = html
    return host.firstElementChild as Element
  }

  test('a text field raises it; a checkbox, a button and a read-only field do not', () => {
    expect(raisesKeyboard(make('<input type="text">'))).toBe(true)
    expect(raisesKeyboard(make('<textarea></textarea>'))).toBe(true)
    expect(raisesKeyboard(make('<input type="checkbox">'))).toBe(false)
    expect(raisesKeyboard(make('<input readonly>'))).toBe(false)
    expect(raisesKeyboard(make('<button></button>'))).toBe(false)
    expect(raisesKeyboard(null)).toBe(false)
  })
})

describe.each([['drawer', 'shell-phone-sheet']] as const)('section bar (%s)', (variant, list) => {
  test('the bar carries the summed count, and the name says it', async () => {
    await mount(variant)
    const bar = await found('shell-phone-bar')
    const badge = bar.querySelector('[data-slot="count-badge"]')
    expect(badge?.textContent).toBe('6')
    expect(screen.getByRole('button', { name: 'Main, 6' })).not.toBeNull()
  })

  test('a section opens its list of destinations with their badges; a second tap closes it', async () => {
    await mount(variant)
    await found('shell-phone-bar')
    const main = screen.getByRole('button', { name: 'Main, 6' })
    fireEvent.click(main)
    await waitFor(() => expect(slot(list)?.textContent ?? '').toContain('Reports'))
    expect(main.getAttribute('aria-expanded')).toBe('true')
    expect(slot(list)?.textContent).toContain('4')
    expect(slot(list)?.textContent).not.toContain('Alerts')
    fireEvent.click(main)
    await waitFor(() => expect(main.getAttribute('aria-expanded')).toBe('false'))
  })

  test('a one-item section is a link to it, not a list', async () => {
    await mount(variant)
    const bar = await found('shell-phone-bar')
    const users = bar.querySelector('a[aria-label="Admin"]')
    expect(users?.getAttribute('href')).toBe('/users')
  })

  test('More reveals the rail, the sections behind the bar and the account included', async () => {
    await mount(variant)
    await found('shell-phone-bar')
    const sidebar = await found('shell-phone-sidebar')
    expect(sidebar.hasAttribute('inert')).toBe(true)
    fireEvent.click(await found('shell-phone-more'))
    await waitFor(() => expect(sidebar.hasAttribute('inert')).toBe(false))
    expect(sidebar.textContent).toContain('Older')
    expect(slot('shell')?.hasAttribute('data-phone-sidebar')).toBe(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(sidebar.hasAttribute('inert')).toBe(true))
    expect(slot('shell')?.hasAttribute('data-phone-sidebar')).toBe(false)
  })

  test('a tap on a link in More navigates and closes it, the current route included', async () => {
    await mount(variant)
    await found('shell-phone-bar')
    const sidebar = await found('shell-phone-sidebar')
    const more = await found('shell-phone-more')
    const isOpen = (): boolean => !sidebar.hasAttribute('inert')
    const link = (): HTMLAnchorElement => {
      const el = sidebar.querySelector<HTMLAnchorElement>('a[href="/older"]')
      if (el === null) throw new Error('no link to /older in More')
      return el
    }
    fireEvent.click(more)
    await waitFor(() => expect(isOpen()).toBe(true))
    fireEvent.click(link())
    await waitFor(() => expect(isOpen()).toBe(false))
    await waitFor(() => expect(mounted?.state.location.pathname).toBe('/older'))
    fireEvent.click(more)
    await waitFor(() => expect(isOpen()).toBe(true))
    fireEvent.click(link())
    await waitFor(() => expect(isOpen()).toBe(false))
  })

  test('the back gesture closes More', async () => {
    await mount(variant)
    await found('shell-phone-bar')
    const sidebar = await found('shell-phone-sidebar')
    fireEvent.click(await found('shell-phone-more'))
    await waitFor(() => expect(sidebar.hasAttribute('inert')).toBe(false))
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await waitFor(() => expect(sidebar.hasAttribute('inert')).toBe(true))
  })

  test('a focused text field moves the bar out of the way, and blur brings it back', async () => {
    await mount(variant)
    const host = await found('shell-phone-bar-host')
    const field = document.createElement('input')
    document.body.append(field)
    act(() => field.focus())
    await waitFor(() => expect(host.hasAttribute('data-hidden')).toBe(true))
    act(() => field.blur())
    await waitFor(() => expect(host.hasAttribute('data-hidden')).toBe(false))
    field.remove()
  })

  test("another section cross-fades the drawer's rows in place", async () => {
    await mount(variant)
    await found('shell-phone-bar')
    fireEvent.click(screen.getByRole('button', { name: 'Main, 6' }))
    await waitFor(() => expect(slot(list)?.textContent ?? '').toContain('Reports'))
    fireEvent.click(screen.getByRole('button', { name: 'Ops, new' }))
    await waitFor(() => expect(slot(list)?.textContent ?? '').toContain('Alerts'))
    // The rows that were there cross-fade out in an inert layer; the live rows are the new section's.
    const ghost = slot(list)?.querySelector('[inert][aria-hidden="true"]')
    expect(ghost?.textContent ?? '').toContain('Reports')
    expect(ghost?.textContent ?? '').not.toContain('Alerts')
    await waitFor(() => expect(slot(list)?.querySelector('[inert]') === null).toBe(true))
    expect(slot(list)?.textContent).not.toContain('Reports')
  })
})
