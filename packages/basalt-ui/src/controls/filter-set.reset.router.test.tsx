/**
 * The desktop row's `Reset all` (state cycle 1, state-1.7) against a REAL search store under a real
 * memory-history router: it shows while a filter is off its default, and one press unsets every
 * spec in a single navigate.
 */
import type { ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { defineControls, resetControlsOwnersForTests } from '../router/controls/define'
import { field } from '../router/controls/field'
import { FilterSet } from './filter-set'
import { spec } from './spec'

afterEach(cleanup)
beforeEach(resetControlsOwnersForTests)

const store = defineControls({
  id: 'filter-set-row-reset',
  scope: 'page',
  fields: {
    currency: field.enum(['USD', 'EUR'], 'USD'),
    region: field.enum(['all', 'eu'], 'all'),
  },
})

type Loose = {
  navigate(o: object): Promise<void>
  state: { status: string; location: { search: unknown } }
}

async function mount(entry: string, page: () => ReactNode): Promise<Loose> {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const pageRoute = createRoute({
    getParentRoute: () => rootRoute as never,
    path: '/dashboard',
    validateSearch: store.validateSearch as never,
    search: { middlewares: store.middlewares as never },
    component: page,
  })
  const create = createRouter as unknown as (o: object) => Loose
  const router = create({
    routeTree: rootRoute.addChildren([pageRoute] as never),
    history: createMemoryHistory({ initialEntries: [entry] }),
  })
  render(
    <MantineProvider>
      <RouterProvider router={router as never} />
    </MantineProvider>,
  )
  await waitFor(() => expect(router.state.status).toBe('idle'))
  return router
}

const Page = (): ReactNode => (
  <FilterSet specs={[spec(store.field.currency, 'Currency'), spec(store.field.region, 'Region')]} />
)

describe('the desktop row Reset all', () => {
  test('is absent while every filter is at its default', async () => {
    await mount('/dashboard', Page)
    expect(
      document.querySelector('[data-slot="filter-pills"] ~ [data-slot="filter-reset"]'),
    ).toBeNull()
    expect(document.querySelector('[data-slot="filter-reset"]')).toBeNull()
  })

  test('unsets every active spec in one navigate', async () => {
    const router = await mount('/dashboard?currency=EUR&region=eu', Page)
    const reset = await waitFor(() => {
      const el = document.querySelector<HTMLButtonElement>('[data-slot="filter-reset"]')
      expect(el).not.toBeNull()
      return el!
    })
    expect(reset.closest('[data-slot="filter-pills"]')).toBeNull()
    let navigates = 0
    const navigate = router.navigate.bind(router)
    router.navigate = (o) => {
      navigates += 1
      return navigate(o)
    }

    await act(async () => {
      fireEvent.click(reset)
    })
    await waitFor(() => {
      expect(router.state.location.search).toEqual({})
    })
    expect(navigates).toBe(1)
    expect(screen.queryByText('Reset all')).toBeNull()
  })
})
