/**
 * `InnerNav` on a real `defineControls` push field under a memory-history router: every item is an
 * `<a href>` carrying the field's param, a plain click pushes it, a modified click is left to the
 * browser, and Back returns. The structural `{ href, onClick }` handle is `inner-nav.test.tsx`'s.
 */
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { defineControls, resetControlsOwnersForTests } from '../../router/controls/define'
import { field } from '../../router/controls/field'
import { InnerNav } from './inner-nav'

const GROUPS = [
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'general', label: 'General' },
      { id: 'billing', label: 'Billing' },
      { id: 'team', label: 'Team' },
    ],
  },
] as const

type Router = {
  load(): Promise<void>
  history: { back(): void }
  state: { location: { href: string } }
}

async function mount(url: string): Promise<Router> {
  const store = defineControls({
    id: 'inner-nav-router',
    scope: 'page',
    fields: { section: field.enum(['general', 'billing', 'team'], 'general', { history: 'push' }) },
  })
  const root = createRootRoute({
    validateSearch: store.validateSearch as never,
    search: { middlewares: store.middlewares as never },
    component: () => <InnerNav label="Settings" state={store.field.section} groups={GROUPS} />,
  })
  const create = createRouter as unknown as (o: object) => Router
  const router = create({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root as never, path: '/' }),
    ] as never),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  await router.load()
  render(createElement(RouterProvider as never, { router }))
  return router
}

beforeEach(resetControlsOwnersForTests)
afterEach(cleanup)

const hrefOf = (name: RegExp): string | null =>
  screen.getByRole('link', { name }).getAttribute('href')

describe('InnerNav on a defineControls push field', () => {
  test('every item is an <a href> carrying the field param; the fallback is written only when chosen', async () => {
    await mount('/')
    expect(hrefOf(/General/)).toBe('/?section=general')
    expect(hrefOf(/Billing/)).toBe('/?section=billing')
    expect(hrefOf(/Team/)).toBe('/?section=team')
    expect(screen.getByRole('link', { name: /General/ }).getAttribute('aria-current')).toBe('page')
  })

  test('a plain click pushes the section and moves aria-current; Back returns', async () => {
    const router = await mount('/')
    fireEvent.click(screen.getByRole('link', { name: /Billing/ }))
    await act(async () => {
      await router.load()
    })
    expect(router.state.location.href).toBe('/?section=billing')
    expect(screen.getByRole('link', { name: /Billing/ }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: /General/ }).getAttribute('aria-current')).toBeNull()

    fireEvent.click(screen.getByRole('link', { name: /Team/ }))
    await act(async () => {
      await router.load()
    })
    expect(router.state.location.href).toBe('/?section=team')

    await act(async () => {
      router.history.back()
      await router.load()
    })
    expect(router.state.location.href).toBe('/?section=billing')
    expect(screen.getByRole('link', { name: /Billing/ }).getAttribute('aria-current')).toBe('page')
    await act(async () => {
      router.history.back()
      await router.load()
    })
    expect(router.state.location.href).toBe('/')
  })

  test('a modified click is left to the browser', async () => {
    const router = await mount('/')
    const click = fireEvent.click(screen.getByRole('link', { name: /Billing/ }), { metaKey: true })
    await act(async () => {
      await router.load()
    })
    expect(click).toBe(true)
    expect(router.state.location.href).toBe('/')
  })

  test('the item keeps the other search params', async () => {
    await mount('/?section=team&keep=1')
    expect(hrefOf(/Billing/)).toBe('/?section=billing&keep=1')
  })
})
