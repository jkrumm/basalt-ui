/**
 * The shell's route states under a real router: a slow navigation keeps the page on screen and
 * shows main busy while the rail and the crumb hold, a path no route matches is titled `Not found`,
 * and focus the old page took with it goes to main. Geometry is the layout suite's.
 */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  useSearch,
} from '@tanstack/react-router'
import { afterEach, describe, expect, test } from 'bun:test'
import { requestMainFocus } from '../common/focus'
import { BasaltProvider } from '../core/provider'
import { routerDefaults } from '../router/defaults'
import { Page } from '../page/page'
import { PageBar } from '../page/page-bar'
import { AppShell } from './app-shell'
import { defineNav } from '../../tests/support/router-nav'

const NAV = defineNav({
  sections: [
    {
      id: 'fleet',
      label: 'Fleet',
      items: [
        { id: 'home', label: 'Overview', link: { to: '/f' }, mobile: 'tab' },
        { id: 'services', label: 'Services', link: { to: '/f/services' }, mobile: 'tab' },
      ],
    },
  ],
})

function mount(entry: string) {
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  // The shell sits in a layout that owns a path prefix: an unknown path under it is its not-found, drawn in its outlet.
  const rootRoute = createRootRoute()
  const root = createRoute({
    getParentRoute: () => rootRoute,
    path: '/f',
    component: () => (
      <AppShell nav={NAV} brand={{ name: 'Basalt' }}>
        <Outlet />
      </AppShell>
    ),
  })
  const home = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => (
      <Page>
        <PageBar title="Fleet overview" />
        <button type="button" data-testid="leave">
          Leave
        </button>
      </Page>
    ),
  })
  const services = createRoute({
    getParentRoute: () => root,
    path: '/services',
    loader: async () => {
      await gate
      return 'loaded'
    },
    component: () => (
      <Page>
        <PageBar title="Services" parent={{ label: 'All services', href: '/f' }} />
      </Page>
    ),
  })
  const record = createRoute({
    getParentRoute: () => root,
    path: '/services/gone',
    loader: () => {
      throw notFound()
    },
  })
  // A selection: the crumb parent goes up to the same path without it, and its link goes with the leaf.
  const queue = createRoute({
    getParentRoute: () => root,
    path: '/queue',
    component: function Queue() {
      const selected = (useSearch({ strict: false }) as { sel?: string }).sel !== undefined
      return (
        <Page>
          <PageBar
            title={selected ? 'Job 7' : 'Queue'}
            {...(selected && { parent: { label: 'Queue', href: '/f/queue' } })}
          />
          <input aria-label="Filter" data-testid="filter" />
        </Page>
      )
    },
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([root.addChildren([home, services, record, queue])]),
    history: createMemoryHistory({ initialEntries: [entry] }),
    defaultPendingMs: 20,
  })
  render(
    <BasaltProvider link={routerDefaults().link}>
      <RouterProvider router={router} />
    </BasaltProvider>,
  )
  return { router, release }
}

const main = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>('[data-slot="shell-main"]')
  if (el === null) throw new Error('no main')
  return el
}
const railActive = (): string | undefined =>
  document.querySelector('[data-slot="shell-rail"] [aria-current="page"]')?.textContent?.trim() ??
  undefined
const crumb = (): string =>
  document.querySelector('[data-slot="page-breadcrumb-leaf"]')?.textContent ?? 'none'

afterEach(() => {
  cleanup()
  document.title = ''
})

describe('a slow navigation', () => {
  test('shows main busy past defaultPendingMs; the rail and the crumb change with the page, not before', async () => {
    const { router, release } = mount('/f')
    await waitFor(() => expect(crumb()).toBe('Fleet overview'))
    expect(main().hasAttribute('aria-busy')).toBe(false)
    expect(railActive()).toBe('Overview')

    act(() => {
      void router.navigate({ to: '/f/services' })
    })
    await waitFor(() => expect(main().getAttribute('aria-busy')).toBe('true'))
    expect(main().hasAttribute('data-pending')).toBe(true)
    // Still the old page: the rail and the crumb have not moved ahead of it.
    expect(railActive()).toBe('Overview')
    expect(crumb()).toBe('Fleet overview')

    await act(async () => release())
    await waitFor(() => expect(crumb()).toBe('Services'))
    expect(railActive()).toBe('Services')
    expect(main().hasAttribute('aria-busy')).toBe(false)
  })
})

describe('a path no page answers', () => {
  test('an unknown path reads Not found in the crumb and the title', async () => {
    mount('/f/nope/deeper')
    await waitFor(() => expect(document.title).toBe('Not found · Basalt'))
    expect(crumb()).toBe('Not found')
  })

  test('a loader notFound() reads Not found too', async () => {
    mount('/f/services/gone')
    await waitFor(() => expect(document.title).toBe('Not found · Basalt'))
  })
})

describe('focus after navigating', () => {
  test('goes to main when the focused control left with the old page', async () => {
    const { router, release } = mount('/f')
    release()
    await waitFor(() => expect(crumb()).toBe('Fleet overview'))
    const leave = document.querySelector<HTMLElement>('[data-testid="leave"]')
    leave?.focus()
    expect(document.activeElement).toBe(leave)
    await act(() => router.navigate({ to: '/f/services' }))
    await waitFor(() => expect(document.activeElement).toBe(main()))
  })

  test('stays where it is when something real holds it', async () => {
    const { router, release } = mount('/f')
    release()
    await waitFor(() => expect(crumb()).toBe('Fleet overview'))
    const skip = document.querySelector<HTMLElement>('[data-slot="shell-skip"]')
    skip?.focus()
    await act(() => router.navigate({ to: '/f/services' }))
    await waitFor(() => expect(crumb()).toBe('Services'))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    expect(document.activeElement).toBe(skip)
    fireEvent.blur(skip as Element)
  })
})

describe('focus while the next page loads', () => {
  const frames = (): Promise<void> =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

  test('a palette or sheet jump holds main before the loader settles and after it', async () => {
    const { router, release } = mount('/f')
    await waitFor(() => expect(crumb()).toBe('Fleet overview'))
    const leave = document.querySelector<HTMLElement>('[data-testid="leave"]')
    leave?.focus()
    // What the palette and the More sheet do before they navigate.
    requestMainFocus()
    act(() => {
      void router.navigate({ to: '/f/services' })
    })
    await waitFor(() => expect(document.activeElement === main()).toBe(true))
    // The loader is still gated: the old page is on screen and main is busy.
    expect(crumb()).toBe('Fleet overview')
    await waitFor(() => expect(main().getAttribute('aria-busy')).toBe('true'))
    expect(document.activeElement === main()).toBe(true)
    await act(async () => release())
    await waitFor(() => expect(crumb()).toBe('Services'))
    await frames()
    expect(document.activeElement === main()).toBe(true)
  })

  test('a Tab during a pending jump neither enters the old page nor leaves main', async () => {
    const { router, release } = mount('/f')
    await waitFor(() => expect(crumb()).toBe('Fleet overview'))
    const leave = document.querySelector<HTMLElement>('[data-testid="leave"]')
    leave?.focus()
    requestMainFocus()
    act(() => {
      void router.navigate({ to: '/f/services' })
    })
    // Before main has taken focus (the old page is still focused) and after it has.
    const early = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    leave?.dispatchEvent(early)
    expect(early.defaultPrevented).toBe(true)
    await waitFor(() => expect(document.activeElement === main()).toBe(true))
    await waitFor(() => expect(main().getAttribute('aria-busy')).toBe('true'))
    const late = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    main().dispatchEvent(late)
    expect(late.defaultPrevented).toBe(true)
    expect(document.activeElement === main()).toBe(true)
    await act(async () => release())
    await waitFor(() => expect(crumb()).toBe('Services'))
    // The jump is over: Tab is the browser's again.
    const after = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    main().dispatchEvent(after)
    expect(after.defaultPrevented).toBe(false)
  })

  test('a Tab on a plain rail navigation is left alone', async () => {
    const { router, release } = mount('/f')
    await waitFor(() => expect(crumb()).toBe('Fleet overview'))
    act(() => {
      void router.navigate({ to: '/f/services' })
    })
    await waitFor(() => expect(main().getAttribute('aria-busy')).toBe('true'))
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    main().dispatchEvent(tab)
    expect(tab.defaultPrevented).toBe(false)
    await act(async () => release())
  })

  test('waits for the overlay to leave before taking focus', async () => {
    const { router, release } = mount('/f')
    await waitFor(() => expect(crumb()).toBe('Fleet overview'))
    const overlay = document.createElement('div')
    overlay.setAttribute('data-slot', 'dialog-content')
    const control = document.createElement('button')
    overlay.append(control)
    document.body.append(overlay)
    control.focus()
    requestMainFocus()
    act(() => {
      void router.navigate({ to: '/f/services' })
    })
    await frames()
    await frames()
    expect(document.activeElement === control).toBe(true)
    overlay.remove()
    await waitFor(() => expect(document.activeElement === main()).toBe(true))
    await act(async () => release())
  })

  test('a rail link click keeps focus on the link while the page loads and after', async () => {
    const { release } = mount('/f')
    await waitFor(() => expect(crumb()).toBe('Fleet overview'))
    const link = [...document.querySelectorAll<HTMLElement>('[data-slot="shell-rail"] a')].find(
      (a) => a.textContent?.includes('Services'),
    )
    link?.focus()
    await act(async () => {
      fireEvent.click(link as Element, { button: 0 })
    })
    await waitFor(() => expect(main().getAttribute('aria-busy')).toBe('true'))
    await frames()
    expect(document.activeElement === link).toBe(true)
    await act(async () => release())
    await waitFor(() => expect(crumb()).toBe('Services'))
    await frames()
    expect(document.activeElement === link).toBe(true)
  })
})

describe('the crumb parent', () => {
  test('hands focus to main when the click only drops the selection from the search', async () => {
    const { release } = mount('/f/queue?sel=7')
    release()
    await waitFor(() => expect(crumb()).toBe('Job 7'))
    const parent = document.querySelector<HTMLElement>('a[data-slot="page-breadcrumb-parent"]')
    parent?.focus()
    await act(async () => {
      fireEvent.click(parent as Element, { button: 0 })
    })
    await waitFor(() => expect(crumb()).toBe('Queue'))
    await waitFor(() => expect(document.activeElement).toBe(main()))
  })

  test('is not the current page', async () => {
    mount('/f/queue?sel=7')
    await waitFor(() => expect(crumb()).toBe('Job 7'))
    const parent = document.querySelector('a[data-slot="page-breadcrumb-parent"]')
    expect(parent?.hasAttribute('aria-current')).toBe(false)
  })
})

describe('the crumb trail', () => {
  test('is the section, the page parent, then the page', async () => {
    const { router, release } = mount('/f')
    release()
    await waitFor(() => expect(crumb()).toBe('Fleet overview'))
    await act(() => router.navigate({ to: '/f/services' }))
    await waitFor(() => expect(crumb()).toBe('Services'))
    const trail = [
      ...(document.querySelector('[data-slot="shell-breadcrumb"]')?.children ?? []),
    ].map((el) => el.textContent)
    expect(trail).toEqual(['Fleet', 'All services', 'Services'])
  })
})
