/**
 * V2-SPEC § 2: `ModalsProvider` is a SIBLING of the router, not a wrapper. Opening and closing a modal
 * re-renders the route 0 times, and a `defineOverlays` registered AFTER first render mounts the
 * sibling without remounting the route tree.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { modals } from '@mantine/modals'
import { act, useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createRootRoute } from '@tanstack/react-router'
import { BasaltProvider } from './index'
import { createBasaltRouter } from './create-router'
import { defineOverlays } from '../commands/define-overlays'
import { resetSlots } from './slots'

afterEach(cleanup)
beforeEach(resetSlots)

let routeRenders = 0
let routeMounts = 0

function Route() {
  routeRenders++
  useEffect(() => {
    routeMounts++
  }, [])
  return <div>route</div>
}

describe('ModalsProvider beside the router', () => {
  test('a late defineOverlays mounts the sibling without remounting the route; modals.* cost the route 0 renders', async () => {
    const router = createBasaltRouter({ routeTree: createRootRoute({ component: Route }) })
    render(<BasaltProvider router={router} />)
    await screen.findByText('route')
    const mountsBefore = routeMounts

    await act(async () => {
      defineOverlays({})
    })
    expect(routeMounts).toBe(mountsBefore)

    const routeBefore = routeRenders
    let id = ''
    await act(async () => {
      id = modals.open({ title: 'Title', children: 'body' })
    })
    expect(await screen.findByText('body')).toBeDefined()
    await act(async () => {
      modals.close(id)
    })

    expect(routeRenders - routeBefore).toBe(0)
  })
})
