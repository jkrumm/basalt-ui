/**
 * A relationship card's link is a plain address: with `usePeek` mounted and the record's kind
 * declared, a click on the card opens the record in the peek instead of navigating.
 */
import { afterEach, beforeEach, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { createElement, useEffect } from 'react'
import { defineControls, resetControlsOwnersForTests } from '../router/controls/define'
import { field } from '../router/controls/field'
import { usePeek } from '../router/peek'
import type { PeekState } from '../router/peek'
import { RelationshipCard } from './relationship-card'

type Loose = {
  load(): Promise<void>
  state: { location: { pathname: string; search: Record<string, unknown> } }
}

let peek: PeekState | undefined
let globals: ReturnType<typeof makeGlobals>
const makeGlobals = () =>
  defineControls({ id: 'globals', scope: 'global', fields: { peek: field.string('') } })

function Probe(): null {
  const state = usePeek({ field: globals.field.peek, kinds: { part: '/ref/part/$id' } })
  useEffect(() => {
    peek = state
  })
  return null
}

async function mount(): Promise<Loose> {
  const root = createRootRoute({
    validateSearch: globals.validateSearch as never,
    search: { middlewares: globals.middlewares as never },
    component: () =>
      createElement(
        'div',
        null,
        createElement(Probe),
        createElement(RelationshipCard, { title: 'Hex bolt M8', href: '/ref/part/hb-m8' }),
        createElement(Outlet),
      ),
  })
  const page = (path: string) => createRoute({ getParentRoute: () => root as never, path })
  const create = createRouter as unknown as (o: object) => Loose
  const router = create({
    routeTree: root.addChildren([page('/'), page('/ref/part/$id')] as never),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(createElement(RouterProvider as never, { router }))
  return router
}

beforeEach(() => {
  ;(window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
    'http://localhost/',
  )
  resetControlsOwnersForTests()
  globals = makeGlobals()
  peek = undefined
})
afterEach(cleanup)

test('a click on the card opens its record in the peek and stays on the page', async () => {
  const router = await mount()
  const link = document.querySelector<HTMLElement>('[data-slot="relationship-link"]')!
  await act(async () => {
    fireEvent.click(link, { button: 0 })
    await Promise.resolve()
  })
  expect(peek?.open).toEqual({ kind: 'part', id: 'hb-m8' })
  expect(peek?.fullPage).toBe('/ref/part/hb-m8')
  expect(router.state.location.pathname).toBe('/')
})
