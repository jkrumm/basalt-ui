/**
 * The crumb parent a shell draws (`PageCrumb`): an in-app link through the installed link in both
 * forms, and the documented `NavTarget` form (`navTarget({ to, ...field.link('') })`) that goes up from
 * a selection: it clears the selection and keeps the page's other search params.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  linkOptions,
} from '@tanstack/react-router'
import { BasaltProvider } from '../core/provider'
import { defineControls, resetControlsOwnersForTests } from '../router/controls/define'
import { field } from '../router/controls/field'
import { routerDefaults } from '../router/defaults'
import { navTarget } from '../../tests/support/router-nav'
import { PageCrumb } from './page-bar'

beforeEach(resetControlsOwnersForTests)
afterEach(cleanup)

const { link } = routerDefaults()

const services = defineControls({
  id: 'crumb-services',
  scope: 'page',
  fields: {
    service: field.string(''),
    status: field.enum(['all', 'down'], 'all'),
  },
  retain: ['status'],
})

type Loose = {
  load(): Promise<void>
  state: { location: { pathname: string; search: Record<string, unknown> } }
}

async function mount(parent: React.ComponentProps<typeof PageCrumb>['parent'], url: string) {
  const root = createRootRoute({ component: Outlet })
  const create = createRouter as unknown as (o: object) => Loose
  const router = create({
    routeTree: root.addChildren([
      createRoute({
        getParentRoute: () => root,
        path: '/services',
        validateSearch: services.validateSearch as never,
        search: { middlewares: services.middlewares as never },
        component: () => <PageCrumb title="checkout" parent={parent} />,
      }),
    ] as never),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  await router.load()
  render(
    <BasaltProvider link={link}>
      <RouterProvider router={router as never} />
    </BasaltProvider>,
  )
  return router
}

const click = (element: Element): boolean => fireEvent.click(element, { button: 0 })

describe('PageCrumb through the installed link', () => {
  test('a path string is a link that navigates in the router and keeps the document', async () => {
    const router = await mount({ label: 'Services', href: '/services' }, '/services?service=a')
    const parent = await screen.findByText('Services')
    expect(parent.getAttribute('href')).toBe('/services')
    expect(await act(async () => click(parent))).toBe(false)
    await waitFor(() => expect(router.state.location.search).toEqual({}))
  })

  test('a NavTarget is a link with its resolved href', async () => {
    const router = await mount(
      { label: 'Services', href: navTarget(linkOptions({ to: '/services' })) },
      '/services?service=a',
    )
    const parent = await screen.findByText('Services')
    expect(parent.getAttribute('href')).toBe('/services')
    expect(await act(async () => click(parent))).toBe(false)
    expect(router.state.location.pathname).toBe('/services')
  })

  test('the documented form clears the selection and keeps the params the store retains', async () => {
    const router = await mount(
      {
        label: 'Services',
        href: navTarget(linkOptions({ to: '/services', ...services.field.service.link('') })),
      },
      '/services?service=checkout&status=down',
    )
    const parent = await screen.findByText('Services')
    expect(parent.getAttribute('href')).toBe('/services?status=down')
    expect(await act(async () => click(parent))).toBe(false)
    await waitFor(() => expect(router.state.location.search).toEqual({ status: 'down' }))
  })

  test('is the way up, never the current page, on the URL its target is part of', async () => {
    for (const href of [
      '/services',
      navTarget(linkOptions({ to: '/services', ...services.field.service.link('') })),
    ]) {
      cleanup()
      await mount({ label: 'Services', href }, '/services?service=checkout&status=down')
      const parent = await screen.findByText('Services')
      expect(parent.hasAttribute('aria-current')).toBe(false)
      expect(parent.hasAttribute('data-status')).toBe(false)
    }
  })
})
