/**
 * The installed link (wiring-1.3): with `BasaltProvider link={routerDefaults().link}` a link prop
 * navigates through the router, so the document is never reloaded; without a router the same props
 * render a plain anchor. A navigation that the router handles calls `preventDefault`; a click the
 * browser would follow itself (a modifier, another button, a new tab) is left alone.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  linkOptions,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { BarList } from '../cards/bar-list'
import type { BarListItem } from '../cards/bar-list'
import type { KanbanCardProps } from '../cards/contract'
import { KanbanCard } from '../cards/kanban-card'
import { StatCard } from '../cards/stat-card'
import { ChartCard } from '../charts/parts/chart-card'
import type { CardAction } from '../core/phase'
import { BasaltProvider } from '../core/provider'
import { EmptyState } from '../page/empty-state'
import type { InnerNavItem } from '../page/contract'
import { InnerNav } from '../page/parts/inner-nav'
import { PageBar } from '../page/page-bar'
import { pushField } from '../page/parts/inner-nav.test-support'
import { col } from '../table/core/kinds'
import { EntityCell } from '../table/core/kinds-cells'
import { routerDefaults } from './defaults'
import { navTarget } from '../../tests/support/router-nav'

afterEach(cleanup)

const { link } = routerDefaults()

function mount(element: () => ReactNode, { installed = true } = {}) {
  const root = createRootRoute({
    component: () => (
      <>
        {element()}
        <Outlet />
      </>
    ),
  })
  const page = (path: string, text: string) =>
    createRoute({ getParentRoute: () => root, path, component: () => <p>{text}</p> })
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: '/' }),
      page('/orders', 'orders page'),
      page('/runs/$id', 'run page'),
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(
    <BasaltProvider {...(installed && { link })}>
      <RouterProvider router={router} />
    </BasaltProvider>,
  )
  return router
}

/** `fireEvent` returns false when a handler called `preventDefault`: the browser then does not follow the link. */
const clicked = (element: Element, init: MouseEventInit = {}): boolean =>
  fireEvent.click(element, { button: 0, ...init })

describe('the installed link', () => {
  test('a linked StatCard click navigates in the router and keeps the document', async () => {
    const router = mount(() => <StatCard title="Orders" value={12} href="/orders" />)
    const target = await screen.findByLabelText('Orders')
    const followed = await act(async () => clicked(target))
    expect(followed).toBe(false)
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders'))
    expect(await screen.findByText('orders page')).toBeDefined()
  })

  test('a StatCard href takes a navTarget', async () => {
    const router = mount(() => (
      <StatCard
        title="Run"
        value={1}
        href={navTarget(linkOptions({ to: '/runs/$id', params: { id: '12' } }))}
      />
    ))
    const target = await screen.findByLabelText('Run')
    expect(target.getAttribute('href')).toBe('/runs/12')
    await act(async () => clicked(target))
    await waitFor(() => expect(router.state.location.pathname).toBe('/runs/12'))
  })

  test('an in-app string keeps its query and hash', async () => {
    const router = mount(() => <StatCard title="Orders" value={1} href="/orders?q=open#top" />)
    await act(async () => clicked(await screen.findByLabelText('Orders')))
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders'))
    expect(router.state.location.search).toEqual({ q: 'open' })
    expect(router.state.location.hash).toBe('top')
  })

  test('a CardAction (EmptyArm of a StatCard) and an entity cell link through the router', async () => {
    const action: CardAction = { label: 'Open orders', href: '/orders' }
    const router = mount(() => (
      <>
        <StatCard title="Empty" value={null} empty={{ cause: 'None yet', action }} />
        <EntityCell value="Acme" href="/runs/1" icon={undefined} sub={undefined} />
      </>
    ))
    await act(async () => clicked(await screen.findByText('Acme')))
    await waitFor(() => expect(router.state.location.pathname).toBe('/runs/1'))
  })

  test('a modifier click, another button and an external URL are left to the browser', async () => {
    const router = mount(() => (
      <>
        <StatCard title="Orders" value={1} href="/orders" />
        <StatCard title="Docs" value={1} href="https://example.com/docs" />
      </>
    ))
    const orders = await screen.findByLabelText('Orders')
    expect(await act(async () => clicked(orders, { metaKey: true }))).toBe(true)
    expect(await act(async () => clicked(orders, { button: 1 }))).toBe(true)
    const docs = await screen.findByLabelText('Docs')
    expect(docs.getAttribute('href')).toBe('https://example.com/docs')
    expect(await act(async () => clicked(docs))).toBe(true)
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('without a router', () => {
  test('the same props render a plain anchor', () => {
    render(<StatCard title="Orders" value={12} href="/orders" />)
    const target = screen.getByLabelText('Orders')
    expect(target.tagName).toBe('A')
    expect(target.getAttribute('href')).toBe('/orders')
  })

  test('a provider with no link renders a plain anchor, and a click is not intercepted', async () => {
    mount(() => <StatCard title="Orders" value={12} href="/orders" />, { installed: false })
    const target = await screen.findByLabelText('Orders')
    expect(target.getAttribute('href')).toBe('/orders')
    expect(await act(async () => clicked(target))).toBe(true)
  })
})

describe('every link prop takes a navTarget', () => {
  test('the prop types accept `navTarget({ to })` (checked by tsc)', () => {
    const to = navTarget(linkOptions({ to: '/orders' }))
    const accepted = [
      { label: 'Open', href: to } satisfies CardAction,
      { label: 'Open', href: to } satisfies CardAction,
      { id: 'a', label: 'A', href: to } satisfies InnerNavItem,
      { label: 'argo', value: 1, href: to } satisfies BarListItem,
      col<{ name: string }>().entity('name', { href: () => to }),
    ]
    const kanban: KanbanCardProps<'todo'>['href'] = to
    expect(accepted.length + (kanban === undefined ? 0 : 1)).toBe(6)
  })
})

describe('every renderer of a link prop goes through the router', () => {
  const lands = async (target: HTMLElement, router: ReturnType<typeof mount>, path: string) => {
    expect(await act(async () => clicked(target))).toBe(false)
    await waitFor(() => expect(router.state.location.pathname).toBe(path))
  }

  test('the StatCard empty action', async () => {
    const router = mount(() => (
      <StatCard
        title="Empty"
        value={null}
        empty={{ cause: 'None yet', action: { label: 'Open orders', href: '/orders' } }}
      />
    ))
    await lands(await screen.findByText('Open orders'), router, '/orders')
  })

  test('the page EmptyState action', async () => {
    const router = mount(() => (
      <EmptyState cause="No runs yet." action={{ label: 'Open orders', href: '/orders' }} />
    ))
    await lands(await screen.findByText('Open orders'), router, '/orders')
  })

  test('the chart card empty action', async () => {
    const router = mount(() => (
      <ChartCard
        title="Requests"
        chart={() => null}
        empty={{ cause: 'No data', action: { label: 'Open orders', href: '/orders' } }}
      />
    ))
    await lands(await screen.findByText('Open orders'), router, '/orders')
  })

  test('a BarList row', async () => {
    const router = mount(() => (
      <BarList title="Top" items={[{ label: 'argo', value: 3, href: '/orders' }]} />
    ))
    await lands(await screen.findByText('argo'), router, '/orders')
  })

  test('a KanbanCard', async () => {
    const router = mount(() => <KanbanCard id="c1" title="Fix it" href="/orders" move="static" />)
    await lands(await screen.findByLabelText('Fix it'), router, '/orders')
  })

  test('an InnerNav item with an href leaves the field', async () => {
    const state = pushField<'a'>(['a'], 'a', 'section')
    const router = mount(() => (
      <InnerNav
        label="Settings"
        state={state}
        groups={[{ id: 'g', label: 'G', items: [{ id: 'a', label: 'Orders', href: '/orders' }] }]}
      />
    ))
    await lands(await screen.findByText('Orders'), router, '/orders')
    expect(state.writes).toEqual([])
  })
})

describe('a standalone PageBar parent', () => {
  test('a string and a navTarget both go through the router', async () => {
    const router = mount(() => (
      <PageBar
        title="Run"
        parent={{ label: 'Orders', href: navTarget(linkOptions({ to: '/orders' })) }}
      />
    ))
    const parent = await screen.findByText('Orders')
    expect(parent.getAttribute('href')).toBe('/orders')
    expect(await act(async () => clicked(parent))).toBe(false)
    await waitFor(() => expect(router.state.location.pathname).toBe('/orders'))
  })
})
