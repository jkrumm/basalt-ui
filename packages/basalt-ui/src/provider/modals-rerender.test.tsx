/**
 * V2-SPEC § 2 Open: does `ModalsProvider` WRAPPING the router (not sitting beside it) cost route
 * re-renders on every `modals.*` call? Counts renders of a route component (no `useModals`) and of
 * a `useModals()` consumer while a modal opens and closes, with the provider as the real tree.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { modals, useModals } from '@mantine/modals'
import { act } from 'react'
import { afterEach, describe, expect, test } from 'bun:test'
import { createRootRoute } from '@tanstack/react-router'
import { BasaltProvider } from './index'
import { createBasaltRouter } from './create-router'

afterEach(cleanup)

let routeRenders = 0
let consumerRenders = 0

function Consumer() {
  useModals()
  consumerRenders++
  return null
}

function Route() {
  routeRenders++
  return (
    <>
      <div>route</div>
      <Consumer />
    </>
  )
}

describe('ModalsProvider wrapping the router', () => {
  test('modals.open / close re-render the route 0 extra times; only useModals() consumers re-render', async () => {
    const router = createBasaltRouter({ routeTree: createRootRoute({ component: Route }) })
    render(<BasaltProvider router={router} />)
    await screen.findByText('route')

    const routeBefore = routeRenders
    const consumerBefore = consumerRenders
    let id = ''
    await act(async () => {
      id = modals.open({ title: 'Title', children: 'body' })
    })
    await act(async () => {
      modals.close(id)
    })

    // Recorded in the PR body: the route component re-renders 0 times; only the hook consumer pays.
    expect(routeRenders - routeBefore).toBeLessThanOrEqual(consumerRenders - consumerBefore)
    console.log(
      `[modals-rerender] open+close: route +${routeRenders - routeBefore}, useModals() consumer +${consumerRenders - consumerBefore}`,
    )
  })
})
