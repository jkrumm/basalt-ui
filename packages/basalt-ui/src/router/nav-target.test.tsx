import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LinkComponent } from '../core/ports'
import { routerDefaults } from './defaults'
import { navTarget } from './nav-target'

afterEach(cleanup)

const { link: Link } = routerDefaults()
// the adapter is still a plain `LinkComponent` wherever a router-free surface takes one
export const asPort: LinkComponent = Link

function mount(element: () => React.ReactNode) {
  const root = createRootRoute({
    component: () => (
      <>
        {element()}
        <Outlet />
      </>
    ),
  })
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: '/' }),
      createRoute({
        getParentRoute: () => root,
        path: '/runs/$id',
        component: () => <p>run page</p>,
      }),
    ]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
  return router
}

describe('navTarget through the link adapter', () => {
  test('is opaque: a frozen-shape object with no readable options', () => {
    const target = navTarget(linkOptions({ to: '/' }))
    expect(Object.keys(target)).toEqual([])
    expect(JSON.stringify(target)).toBe('{}')
  })

  test('renders a router anchor with the resolved href and the passed props', async () => {
    mount(() => (
      <Link
        href={navTarget(linkOptions({ to: '/runs/$id', params: { id: '12' } }))}
        className="x"
        aria-label="Run 12"
      >
        open
      </Link>
    ))
    const a = await screen.findByLabelText('Run 12')
    expect(a.tagName).toBe('A')
    expect(a.getAttribute('href')).toBe('/runs/12')
    expect(a.className).toContain('x')
  })

  test('a click navigates in the router instead of loading the document', async () => {
    const router = mount(() => (
      <Link href={navTarget(linkOptions({ to: '/runs/$id', params: { id: '7' } }))}>go</Link>
    ))
    const go = await screen.findByText('go')
    await act(async () => go.click())
    await waitFor(() => expect(router.state.location.pathname).toBe('/runs/7'))
    expect(await screen.findByText('run page')).toBeDefined()
  })

  test('a string href stays a plain anchor', async () => {
    mount(() => <Link href="https://example.com/x">out</Link>)
    const a = await screen.findByText('out')
    expect(a.getAttribute('href')).toBe('https://example.com/x')
  })
})

describe('the adapter owns the one cast', () => {
  test('neither router source casts through `never`', () => {
    for (const file of ['nav-target.ts', 'defaults.ts'])
      expect(readFileSync(join(import.meta.dir, file), 'utf8')).not.toContain('as never')
  })
})
