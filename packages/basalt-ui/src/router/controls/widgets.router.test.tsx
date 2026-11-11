/**
 * Widget scope against a memory-history router: the seven precedence cases, history, render
 * isolation, `useOverrides`, `retain` on a layout route (S8) and the definition guards. Type-level
 * negatives live in `tests/controls/golden/ctl3-widgets-types.check.tsx`.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createElement, memo } from 'react'
import { act, cleanup, render } from '@testing-library/react'
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

type Loose = {
  load(): Promise<void>
  navigate(o: object): Promise<void>
  history: { length: number }
  state: { location: { href: string; search: Record<string, unknown> } }
}

type Mountable = { validateSearch: unknown; middlewares: unknown }

type Tree = { path: string; store?: Mountable; children?: Tree[]; component?: () => unknown }

const build = (parent: unknown, trees: Tree[]): unknown[] =>
  trees.map((tree) => {
    const route = createRoute({
      getParentRoute: () => parent as never,
      path: tree.path,
      ...(tree.store
        ? {
            validateSearch: tree.store.validateSearch as never,
            search: { middlewares: tree.store.middlewares as never },
          }
        : {}),
      component: (tree.component ?? (() => createElement(Outlet))) as never,
    })
    const kids = tree.children ? build(route, tree.children) : []
    return kids.length > 0 ? route.addChildren(kids as never) : route
  })

async function mount(o: {
  root: Mountable
  tree: Tree[]
  url: string
  chrome?: () => unknown
}): Promise<{ router: Loose; entries: () => number }> {
  const root = createRootRoute({
    validateSearch: o.root.validateSearch as never,
    search: { middlewares: o.root.middlewares as never },
    component: () => createElement('div', null, o.chrome?.() as never, createElement(Outlet)),
  })
  const create = createRouter as unknown as (opts: object) => Loose
  const history = createMemoryHistory({ initialEntries: [o.url] })
  const router = create({
    routeTree: root.addChildren(build(root, o.tree) as never),
    history,
  })
  await router.load()
  render(createElement(RouterProvider as unknown as (p: { router: Loose }) => null, { router }))
  return { router, entries: () => history.length }
}

const RANGES = ['1h', '24h', '7d', '30d'] as const

function stores() {
  const globals = defineControls({
    id: 'globals',
    scope: 'global',
    fields: { range: field.enum(RANGES, '24h'), regions: field.multi(['eu', 'us'], []) },
  })
  const overview = defineControls({
    id: 'overview',
    scope: 'page',
    resets: ['page'],
    fields: { tab: field.enum(['all', 'errors'], 'all'), page: field.number({ fallback: 0 }) },
    widgets: {
      latency: { range: globals.field.range },
      errors: { range: globals.field.range },
    },
  })
  return { globals, overview }
}

const text = (id: string): string | null =>
  document.querySelector(`[data-testid="${id}"]`)?.textContent ?? null

type Renders = { pill: number; latency: number; errors: number }
const zeroRenders = (): Renders => ({ pill: 0, latency: 0, errors: 0 })

/** What the page's own components lend a test: the latency card's setter, read inside the router. */
const lent: { set: (v: never) => void } = { set: () => {} }

function chrome(s: ReturnType<typeof stores>, renders: Renders) {
  const Pill = () => {
    renders.pill += 1
    const [range] = s.globals.field.range.use()
    return createElement('span', { 'data-testid': 'pill' }, range)
  }
  const Lend = () => {
    lent.set = s.overview.widget.latency.range.use()[1] as never
    return null
  }
  return () => createElement('div', null, createElement(Pill), createElement(Lend))
}

function page(s: ReturnType<typeof stores>, renders: Renders) {
  const Card = memo(function Card({ id }: { id: 'latency' | 'errors' }) {
    renders[id] += 1
    const handle = s.overview.widget[id].range
    const [value] = handle.use()
    const { source, inherited } = handle.useSource()
    return createElement(
      'div',
      { 'data-testid': id, 'data-source': source, 'data-inherited': inherited },
      value,
    )
  })
  const Cue = () => {
    const overrides = s.overview.useOverrides()
    return createElement(
      'button',
      { 'data-testid': 'reset', onClick: overrides.clearAll },
      overrides.keys.join(','),
    )
  }
  return () =>
    createElement(
      'main',
      null,
      createElement(Card, { id: 'latency' }),
      createElement(Card, { id: 'errors' }),
      createElement(Cue),
    )
}

beforeEach(() => resetControlsOwnersForTests())
afterEach(() => cleanup())

async function overviewApp(url: string, renders: Renders = zeroRenders()) {
  const s = stores()
  const app = await mount({
    root: s.globals,
    tree: [
      { path: '/overview', store: s.overview, component: page(s, renders) as never },
      { path: '/other' },
    ],
    url,
    chrome: chrome(s, renders),
  })
  return { s, ...app }
}

describe('widget precedence (7 cases)', () => {
  test('1. a widget inherits the global and shows the effective value', async () => {
    await overviewApp('/overview?range=7d')
    expect(text('latency')).toBe('7d')
    expect(document.querySelector('[data-testid="latency"]')?.getAttribute('data-source')).toBe(
      'inherited',
    )
  })

  test('2. an override wins for its own card only, and writes only its w. key', async () => {
    const { router } = await overviewApp('/overview?range=7d')
    await act(async () => {
      lent.set('30d' as never)
      await router.load()
    })
    expect(router.state.location.search).toMatchObject({ range: '7d', 'w.latency.range': '30d' })
    expect(text('latency')).toBe('30d')
    expect(text('errors')).toBe('7d')
    expect(text('pill')).toBe('7d')
  })

  test('3. a global change flows to the cards without an override, not to the overridden one', async () => {
    const { router } = await overviewApp('/overview?range=7d&w.latency.range=30d')
    await act(async () => {
      await router.navigate({ to: '.', search: (prev: object) => ({ ...prev, range: '1h' }) })
    })
    expect(text('pill')).toBe('1h')
    expect(text('errors')).toBe('1h')
    expect(text('latency')).toBe('30d')
  })

  test('4. clear() drops the key and the card returns to the global', async () => {
    const { s, router } = await overviewApp('/overview?range=7d&w.latency.range=30d')
    await act(async () => {
      s.overview.widget.latency.range.clear()
      await router.load()
    })
    expect(router.state.location.search).not.toHaveProperty('w.latency.range')
    expect(text('latency')).toBe('7d')
  })

  test('5. an override equal to the global still pins', async () => {
    const { router } = await overviewApp('/overview?range=7d')
    await act(async () => {
      lent.set('7d' as never)
      await router.load()
    })
    expect(router.state.location.search).toMatchObject({ 'w.latency.range': '7d' })
    await act(async () => {
      await router.navigate({ to: '.', search: (prev: object) => ({ ...prev, range: '1h' }) })
    })
    expect(text('latency')).toBe('7d')
    expect(text('errors')).toBe('1h')
    expect(document.querySelector('[data-testid="latency"]')?.getAttribute('data-source')).toBe(
      'override',
    )
  })

  test('6. Reset overrides clears every w. key and nothing else', async () => {
    const { router } = await overviewApp(
      '/overview?range=7d&tab=errors&w.latency.range=30d&w.errors.range=1h',
    )
    expect(text('reset')).toBe('w.latency.range,w.errors.range')
    await act(async () => {
      document.querySelector<HTMLButtonElement>('[data-testid="reset"]')?.click()
      await router.load()
    })
    const search = router.state.location.search
    expect(search).toMatchObject({ range: '7d', tab: 'errors' })
    expect(search).not.toHaveProperty('w.latency.range')
    expect(search).not.toHaveProperty('w.errors.range')
    expect(text('reset')).toBe('')
  })

  test('7. a deep link with override and global both set honours the override and rewrites nothing', async () => {
    const { router, entries } = await overviewApp('/overview?range=7d&w.latency.range=30d')
    const before = router.state.location.href
    expect(text('latency')).toBe('30d')
    expect(text('pill')).toBe('7d')
    expect(document.querySelector('[data-testid="latency"]')?.getAttribute('data-inherited')).toBe(
      '7d',
    )
    expect(router.state.location.href).toBe(before)
    expect(entries()).toBe(1)
  })

  test('an invalid override or global falls through to the next layer', async () => {
    await overviewApp('/overview?range=bogus&w.latency.range=nope&w.errors.range=7d')
    expect(text('pill')).toBe('24h')
    expect(text('latency')).toBe('24h')
    expect(text('errors')).toBe('7d')
  })
})

describe('widget writes', () => {
  test('a widget write replaces history and never touches the page `resets`', async () => {
    const { router, entries } = await overviewApp('/overview?page=3')
    await act(async () => {
      lent.set('7d' as never)
      await router.load()
    })
    expect(entries()).toBe(1)
    expect(router.state.location.search).toMatchObject({ page: 3, 'w.latency.range': '7d' })
  })

  test('an override survives an unrelated page write and a link keeps it typed', async () => {
    const { s, router } = await overviewApp('/overview?w.latency.range=30d')
    expect(s.overview.widget.latency.range.link('7d')).toEqual({
      search: { 'w.latency.range': '7d' },
      replace: true,
      resetScroll: false,
    })
    await act(async () => {
      await router.navigate({ to: '.', search: (prev: object) => ({ ...prev, tab: 'errors' }) })
    })
    expect(router.state.location.search).toMatchObject({ tab: 'errors', 'w.latency.range': '30d' })
  })

  test('a widget override re-renders neither the header pill nor the sibling card', async () => {
    const renders = zeroRenders()
    const { router } = await overviewApp('/overview?range=7d', renders)
    const before = { ...renders }
    await act(async () => {
      lent.set('30d' as never)
      await router.load()
    })
    expect(renders.latency).toBeGreaterThan(before.latency)
    expect(renders.errors).toBe(before.errors)
    expect(renders.pill).toBe(before.pill)
  })
})

describe('retain on a layout route (S8)', () => {
  test('six children keep the globals and strip defaults; leaving drops page keys', async () => {
    const globals = defineControls({
      id: 'globals',
      scope: 'global',
      fields: { range: field.enum(RANGES, '24h'), regions: field.multi(['eu', 'us'], []) },
    })
    const fin = defineControls({
      id: 'fin',
      scope: 'page',
      retain: ['month', 'q'],
      fields: {
        month: field.enum(['2025-01', '2025-02'], '2025-01'),
        q: field.string(''),
        x: field.string(''),
      },
    })
    const kids = ['a', 'b', 'c', 'd', 'e', 'f'].map((path) => ({ path }))
    const { router } = await mount({
      root: globals,
      tree: [{ path: '/fin', store: fin, children: kids }, { path: '/away' }],
      url: '/fin/a?range=7d&month=2025-02&q=acme&x=gone',
    })
    for (const kid of kids) {
      await act(async () => {
        await router.navigate({ to: `/fin/${kid.path}` })
      })
      expect(router.state.location.search).toMatchObject({
        range: '7d',
        month: '2025-02',
        q: 'acme',
      })
      expect(router.state.location.href).not.toContain('regions')
      expect(router.state.location.href).not.toContain('x=')
    }
    await act(async () => {
      await router.navigate({ to: '/away' })
    })
    expect(router.state.location.search).toEqual({ range: '7d' })
  })

  test('clear() unsets a retained key with an explicit undefined', async () => {
    const globals = defineControls({
      id: 'globals',
      scope: 'global',
      fields: { env: field.enum(['prod', 'staging'], 'prod') },
    })
    const { router } = await mount({
      root: globals,
      tree: [{ path: '/a' }],
      url: '/a?env=staging',
      chrome: () =>
        createElement(() => {
          globals.field.env.use()
          return null
        }),
    })
    await act(async () => {
      globals.field.env.clear()
      await router.load()
    })
    expect(router.state.location.search).not.toHaveProperty('env')
  })
})

describe('middlewares', () => {
  test('a global is [strip, retain]; a page store retains nothing unless asked', () => {
    const globals = defineControls({ id: 'g', scope: 'global', fields: { r: field.string('') } })
    const page = defineControls({ id: 'p', scope: 'page', fields: { q: field.string('') } })
    const retaining = defineControls({
      id: 'p2',
      scope: 'page',
      retain: ['q'],
      fields: { q: field.string('') },
    })
    expect(globals.middlewares).toHaveLength(2)
    expect(page.middlewares).toHaveLength(1)
    expect(retaining.middlewares).toHaveLength(2)
  })
})

describe('definition guards', () => {
  const ranges = () =>
    defineControls({ id: 'g', scope: 'global', fields: { range: field.enum(RANGES, '24h') } })

  test('widgets on a global, a reused widget id, a bad id and an unknown retain key throw', () => {
    const g = ranges()
    expect(() =>
      defineControls({
        id: 'x',
        scope: 'global',
        fields: {},
        widgets: { w: { range: g.field.range } },
      }),
    ).toThrow('widgets belong on a page store')
    defineControls({
      id: 'p1',
      scope: 'page',
      fields: {},
      widgets: { w: { range: g.field.range } },
    })
    expect(() =>
      defineControls({
        id: 'p2',
        scope: 'page',
        fields: {},
        widgets: { w: { range: g.field.range } },
      }),
    ).toThrow('app-unique')
    expect(() =>
      defineControls({
        id: 'p3',
        scope: 'page',
        fields: {},
        widgets: { 'a.b': { range: g.field.range } },
      }),
    ).toThrow('plain identifier')
    expect(() => defineControls({ id: 'p4', scope: 'page', fields: {}, retain: ['nope'] })).toThrow(
      'not a URL param',
    )
  })

  test('a redefinition under the same store id replaces its widget claims', () => {
    const g = ranges()
    const def = () =>
      defineControls({
        id: 'p',
        scope: 'page',
        fields: {},
        widgets: { w: { range: g.field.range } },
      })
    def()
    expect(def).not.toThrow()
  })

  test('a device field cannot be a widget source', () => {
    const device = defineControls({
      id: 'dev',
      scope: 'page',
      fields: { density: field.enum(['a', 'b'], 'a', { url: false }) },
    })
    expect(() =>
      defineControls({
        id: 'p',
        scope: 'page',
        fields: {},
        widgets: { w: { density: device.field.density } },
      }),
    ).toThrow('scalar URL handle')
  })
})
