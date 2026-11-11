/**
 * Widget scope under SSR: the server renders the override from the URL alone, and hydrating that
 * HTML reports zero recoverable errors (a negative control proves the detector bites).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { act, cleanup } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { defineControls, resetControlsOwnersForTests } from './define'
import { field } from './field'

const globals = () =>
  defineControls({
    id: 'globals',
    scope: 'global',
    fields: { range: field.enum(['1h', '24h', '7d', '30d'], '24h') },
  })

type Loose = { load(): Promise<void> }

async function makeRouter(url: string): Promise<Loose> {
  const g = globals()
  const overview = defineControls({
    id: 'overview',
    scope: 'page',
    fields: {},
    widgets: { latency: { range: g.field.range }, errors: { range: g.field.range } },
  })
  const Card = ({ id }: { id: 'latency' | 'errors' }) => {
    const handle = overview.widget[id].range
    const [value] = handle.use()
    return createElement('i', { id, 'data-source': handle.useSource().source }, value)
  }
  const root = createRootRoute({
    validateSearch: g.validateSearch as never,
    search: { middlewares: g.middlewares as never },
    component: () => createElement(Outlet),
  })
  const page = createRoute({
    getParentRoute: () => root as never,
    path: '/overview',
    validateSearch: overview.validateSearch as never,
    search: { middlewares: overview.middlewares as never },
    component: () =>
      createElement(
        'main',
        null,
        createElement(Card, { id: 'latency' }),
        createElement(Card, { id: 'errors' }),
      ),
  })
  const create = createRouter as unknown as (o: object) => Loose
  const router = create({
    routeTree: root.addChildren([page] as never),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  await router.load()
  return router
}

const App = (router: Loose) =>
  createElement(RouterProvider as unknown as (p: { router: Loose }) => null, { router })

beforeEach(() => resetControlsOwnersForTests())
afterEach(() => cleanup())

describe('widget scope under SSR', () => {
  const URL = '/overview?range=7d&w.latency.range=30d'

  test('the server renders the override and the inherited value from the URL', async () => {
    const html = renderToString(App(await makeRouter(URL)))
    expect(html).toContain('id="latency" data-source="override">30d<')
    expect(html).toContain('id="errors" data-source="inherited">7d<')
  })

  const hydrate = async (html: string): Promise<unknown[]> => {
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.append(container)
    const errors: unknown[] = []
    const router = await makeRouter(URL)
    await act(async () => {
      hydrateRoot(container, App(router), { onRecoverableError: (e) => errors.push(e) })
    })
    return errors
  }

  test('hydrating an overridden widget reports zero recoverable errors', async () => {
    const html = renderToString(App(await makeRouter(URL)))
    resetControlsOwnersForTests()
    expect(await hydrate(html)).toHaveLength(0)
  })

  test('negative control: a tampered server HTML is flagged', async () => {
    const html = renderToString(App(await makeRouter(URL))).replace('>30d<', '>MISMATCH<')
    resetControlsOwnersForTests()
    expect((await hydrate(html)).length).toBeGreaterThan(0)
  })
})
