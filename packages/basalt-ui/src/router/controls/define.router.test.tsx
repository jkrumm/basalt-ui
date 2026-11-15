/**
 * `defineControls` against a memory-history router: brand ownership, the global-on-root dev check,
 * `resets`, aliases (golden `cases.json`), `extend()`, the device and memory lanes, the census hooks
 * and `toWindow`. The 2.x invariants live in `tests/controls/golden/ctl2-*`.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import cases from './fixtures/cases.json'
import { BRAND, brandOf } from './brand'
import type { StandardSchemaV1 } from './brand'
import { defineControls, resetControlsOwnersForTests } from './define'
import { field } from './field'

type Loose = {
  load(): Promise<void>
  navigate(o: object): Promise<void>
  state: { location: { href: string; search: Record<string, unknown> } }
}

type Mountable = { validateSearch: unknown; middlewares: unknown }

async function mount(o: {
  root?: Mountable
  pages: Record<string, Mountable | undefined>
  url: string
  probe?: () => void
}): Promise<Loose> {
  const root = createRootRoute({
    ...(o.root
      ? {
          validateSearch: o.root.validateSearch as never,
          search: { middlewares: o.root.middlewares as never },
        }
      : {}),
    component: () => {
      o.probe?.()
      return createElement(Outlet)
    },
  })
  const children = Object.entries(o.pages).map(([path, store]) =>
    createRoute({
      getParentRoute: () => root as never,
      path,
      ...(store
        ? {
            validateSearch: store.validateSearch as never,
            search: { middlewares: store.middlewares as never },
          }
        : {}),
    }),
  )
  const create = createRouter as unknown as (o: object) => Loose
  const router = create({
    routeTree: root.addChildren(children as never),
    history: createMemoryHistory({ initialEntries: [o.url] }),
  })
  await router.load()
  render(createElement(RouterProvider as never, { router }))
  return router
}

afterEach(cleanup)
beforeEach(resetControlsOwnersForTests)

describe('defineControls: brand and ownership', () => {
  test('validateSearch and extend() carry the brand; a hand wrapper does not', () => {
    const store = defineControls({ id: 'brand-a', scope: 'page', fields: { q: field.string('') } })
    const schema: StandardSchemaV1<{ item?: string }, { item?: string }> = {
      '~standard': {
        version: 1,
        vendor: 'test',
        validate: (v) => {
          const { item } = v as { item?: string }
          return { value: item === undefined ? {} : { item } }
        },
      },
    }
    const extended = store.extend(schema)
    expect(brandOf(store.validateSearch)).toEqual({ id: 'brand-a', scope: 'page' })
    expect(extended[BRAND]).toBe(store.validateSearch[BRAND])
    expect(extended['~standard'].validate({ q: 7, item: 'x' }).value).toEqual({ q: '7', item: 'x' })
    const wrapper = (raw: Record<string, unknown>) =>
      store.validateSearch['~standard'].validate(raw)
    expect(brandOf(wrapper)).toBeUndefined()
  })

  test('a page store refuses a write from a route that does not run it', async () => {
    const page = defineControls({
      id: 'own-page',
      scope: 'page',
      fields: { tab: field.enum(['a', 'b'], 'a') },
    })
    let set: (v: 'a' | 'b') => void = () => {}
    const router = await mount({
      pages: { '/mine': page, '/other': undefined },
      url: '/other',
      probe: () => {
        set = page.field.tab.use()[1]
      },
    })
    expect(() => set('b')).toThrow(/does not run the store/)
    await act(() => router.navigate({ to: '/mine' }))
    await act(async () => {
      set('b')
      await router.load()
    })
    expect(router.state.location.href).toBe('/mine?tab=b')
  })

  test('a global store mounted on a non-root route throws in dev', async () => {
    const global = defineControls({
      id: 'misplaced',
      scope: 'global',
      fields: { env: field.enum(['prod', 'dev'], 'prod') },
    })
    let set: (v: 'prod' | 'dev') => void = () => {}
    const error = console.error
    console.error = () => {}
    try {
      await mount({
        pages: { '/x': global },
        url: '/x',
        probe: () => {
          set = global.field.env.use()[1]
        },
      })
    } finally {
      console.error = error
    }
    expect(() => set('dev')).toThrow(/mounts on the root route only/)
  })

  test('a "w." param is reserved', () => {
    expect(() =>
      defineControls({
        id: 'reserved',
        scope: 'page',
        fields: { 'w.card.range': field.string('') },
      }),
    ).toThrow(/reserved/)
  })

  test('persist on a URL field is refused', () => {
    expect(() => field.string('', { persist: true } as never)).toThrow(/url: false/)
  })
})

describe('defineControls: a param a global store owns', () => {
  test('defining the page store does not throw; its mount names the fix, and other routes render', async () => {
    const globals = defineControls({
      id: 'overview-globals',
      scope: 'global',
      fields: { range: field.enum(['24h', '7d'], '24h') },
    })
    const defined = () =>
      defineControls({ id: 'overview', scope: 'page', fields: { range: field.string('') } })
    expect(defined).not.toThrow()
    const page = defined()

    const root = createRootRoute({
      validateSearch: globals.validateSearch as never,
      search: { middlewares: globals.middlewares as never },
      component: () => createElement(Outlet),
    })
    const Bad = () => {
      page.field.range.use()
      return createElement('p', null, 'bad page')
    }
    const routes = [
      createRoute({
        getParentRoute: () => root as never,
        path: '/ok',
        component: () => createElement('p', null, 'fine page'),
      }),
      createRoute({
        getParentRoute: () => root as never,
        path: '/bad',
        validateSearch: page.validateSearch as never,
        component: Bad,
        errorComponent: ({ error }: { error: unknown }) =>
          createElement('p', null, error instanceof Error ? error.message : String(error)),
      }),
    ]
    const create = createRouter as unknown as (o: object) => Loose
    const router = create({
      routeTree: root.addChildren(routes as never),
      history: createMemoryHistory({ initialEntries: ['/ok'] }),
    })
    await router.load()
    const view = render(createElement(RouterProvider as never, { router }))
    expect(view.container.textContent).toContain('fine page')
    await act(() => router.navigate({ to: '/bad' }))
    const text = view.container.textContent ?? ''
    expect(text).toContain(
      'the param "range" is already owned by the global store "overview-globals"',
    )
    expect(text).toContain('Rename the field in "overview"')
    expect(text).toContain('externalField(overview-globals.field.range)')
  })
})

describe('defineControls: values and writes', () => {
  test('aliases from the golden cases resolve before the codec', () => {
    for (const c of cases.aliases) {
      const store = defineControls({
        id: `alias-${c.store}`,
        scope: 'page',
        fields: {
          [c.field]: field.enum(['24h', '7d', 'storage', 'general'], c.to as never, {
            aliases: { [c.from]: c.to as never },
          }),
        },
      })
      const value: Record<string, unknown> = store.validateSearch['~standard'].validate({
        [c.field]: c.from,
      }).value
      expect(value).toEqual({ [c.field]: c.to })
    }
  })

  test('resets unset sibling params in the same navigate', async () => {
    const list = defineControls({
      id: 'resets-list',
      scope: 'page',
      resets: ['page'],
      fields: { status: field.enum(['open', 'closed'], 'open') },
    })
    let set: (v: 'open' | 'closed') => void = () => {}
    const router = await mount({
      pages: { '/list': list },
      url: '/list?page=4',
      probe: () => {
        set = list.field.status.use()[1]
      },
    })
    await act(async () => {
      set('closed')
      await router.load()
    })
    expect(router.state.location.href).toBe('/list?status=closed')
  })

  test('push fields add a history entry, replace fields do not', async () => {
    const store = defineControls({
      id: 'history-modes',
      scope: 'page',
      fields: {
        section: field.enum(['general', 'billing'], 'general', { history: 'push' }),
        q: field.string(''),
      },
    })
    const writes: { section?: (v: 'general' | 'billing') => void; q?: (v: string) => void } = {}
    const history = createMemoryHistory({ initialEntries: ['/s'] })
    const root = createRootRoute({
      component: () => {
        writes.section = store.field.section.use()[1]
        writes.q = store.field.q.use()[1]
        return createElement(Outlet)
      },
    })
    const s = createRoute({
      getParentRoute: () => root,
      path: '/s',
      validateSearch: store.validateSearch,
      search: { middlewares: store.middlewares },
    })
    const router = createRouter({ routeTree: root.addChildren([s]), history })
    await router.load()
    render(createElement(RouterProvider as never, { router }))
    const length = history.length
    await act(async () => {
      writes.q?.('x')
      await router.load()
    })
    expect(history.length).toBe(length)
    await act(async () => {
      writes.section?.('billing')
      await router.load()
    })
    expect(history.length).toBe(length + 1)
    expect(router.state.location.href).toBe('/s?q=x&section=billing')
  })

  test("clear() leaves a push field's close as its own entry; a replace field's clear() replaces", async () => {
    const store = defineControls({
      id: 'history-clear',
      scope: 'page',
      fields: {
        record: field.string('', { history: 'push' }),
        q: field.string(''),
      },
    })
    const history = createMemoryHistory({ initialEntries: ['/s'] })
    const root = createRootRoute({
      component: () => {
        store.field.record.use()
        store.field.q.use()
        return createElement(Outlet)
      },
    })
    const s = createRoute({
      getParentRoute: () => root,
      path: '/s',
      validateSearch: store.validateSearch,
      search: { middlewares: store.middlewares },
    })
    const router = createRouter({ routeTree: root.addChildren([s]), history })
    await router.load()
    render(createElement(RouterProvider as never, { router }))
    const run = async (fn: () => void): Promise<void> => {
      await act(async () => {
        fn()
        await router.load()
      })
    }
    const href = (): string => router.state.location.href

    // Open by a push, close by clear(): the close is its own entry and Back returns to the record.
    await run(() => router.navigate({ to: '.', search: { record: 'inv-1' } }) as unknown as void)
    const open = history.length
    await run(() => store.field.record.clear())
    expect(href()).toBe('/s')
    expect(history.length).toBe(open + 1)
    await run(() => history.back())
    expect(href()).toBe('/s?record=inv-1')

    // clear({ replace: true }) overwrites the open entry (a cleanup, not a user close).
    const before = history.length
    await run(() => store.field.record.clear({ replace: true }))
    expect(href()).toBe('/s')
    expect(history.length).toBe(before)

    // A record that came with the document load still closes and unsets the field.
    await run(
      () =>
        router.navigate({ to: '.', search: { record: 'inv-2' }, replace: true }) as unknown as void,
    )
    await run(() => store.field.record.clear())
    expect(href()).toBe('/s')

    // A replace field's clear() stays a replace.
    await run(() => router.navigate({ to: '.', search: { q: 'x' } }) as unknown as void)
    const len = history.length
    await run(() => store.field.q.clear())
    expect(href()).toBe('/s')
    expect(history.length).toBe(len)
  })

  test('useReset({ only }) unsets the named fields in one navigate and keeps the rest', async () => {
    const store = defineControls({
      id: 'reset-only',
      scope: 'page',
      fields: {
        q: field.string(''),
        flagged: field.boolean(false),
        view: field.enum(['table', 'chart'], 'table', { history: 'push' }),
        order: field.string('', { history: 'push' }),
      },
    })
    let reset = () => {}
    let resetAll = () => {}
    const router = await mount({
      root: store,
      pages: { '/o': undefined },
      url: '/o?q=zzz&flagged=true&view=chart&order=7',
      probe: () => {
        const { q, flagged } = store.field
        reset = store.useReset({ only: [q, flagged] })
        resetAll = store.useReset()
      },
    })
    let navigates = 0
    const navigate = router.navigate.bind(router)
    router.navigate = (o) => {
      navigates += 1
      return navigate(o)
    }
    await act(async () => {
      reset()
      await router.load()
    })
    expect(navigates).toBe(1)
    expect(router.state.location.search).toEqual({ view: 'chart', order: '7' })
    await act(async () => {
      resetAll()
      await router.load()
    })
    expect(router.state.location.href).toBe('/o')
  })

  test('useReset({ only }) refuses a handle of another store', async () => {
    const mine = defineControls({
      id: 'reset-mine',
      scope: 'global',
      fields: { a: field.string('') },
    })
    const other = defineControls({
      id: 'reset-other',
      scope: 'global',
      fields: { b: field.string('') },
    })
    let thrown: unknown
    await mount({
      root: mine,
      pages: { '/t': undefined },
      url: '/t',
      probe: () => {
        try {
          mine.useReset({ only: [other.field.b as never] })
        } catch (error) {
          thrown = error
        }
      },
    })
    expect(String(thrown)).toContain('not a field of this store')
  })

  test('link() gives typed Link props with only the field params', () => {
    const store = defineControls({
      id: 'link-props',
      scope: 'page',
      fields: {
        section: field.enum(['general', 'billing'], 'general', { history: 'push' }),
        window: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }),
      },
    })
    expect(store.field.section.link('billing')).toEqual({
      search: { section: 'billing' },
      replace: false,
      resetScroll: false,
    })
    expect(
      store.field.window.link({ preset: 'custom', from: '2025-01-01', to: '2025-01-31' }).search,
    ).toEqual({ window: 'custom', from: '2025-01-01', to: '2025-01-31' })
  })

  test('useActiveCount counts moved fields across lanes; useReset unsets them all', async () => {
    const store = defineControls({
      id: 'census',
      scope: 'global',
      fields: {
        a: field.enum(['x', 'y'], 'x'),
        b: field.multi(['m', 'n'], []),
        dense: field.boolean(false, { url: false, persist: false }),
      },
    })
    let count = -1
    let reset = () => {}
    let setDense: (v: boolean) => void = () => {}
    const router = await mount({
      root: store,
      pages: { '/c': undefined },
      url: '/c?a=y&b=m',
      probe: () => {
        count = store.useActiveCount()
        reset = store.useReset()
        setDense = store.field.dense.use()[1]
      },
    })
    expect(count).toBe(2)
    act(() => setDense(true))
    expect(count).toBe(3)
    expect(store.field.dense.isDefault).toBe(false)
    await act(async () => {
      reset()
      await router.load()
    })
    expect(count).toBe(0)
    expect(router.state.location.href).toBe('/c')
    expect(store.field.a.isDefault).toBe(true)
  })

  test('a device field persists under basalt:<id> and may have a thunk fallback', async () => {
    localStorage.removeItem('basalt:device-lane')
    const store = defineControls({
      id: 'device-lane',
      scope: 'global',
      fields: { day: field.string(() => '2025-01-01', { url: false }) },
    })
    let value = ''
    let set: (v: string) => void = () => {}
    await mount({
      root: store,
      pages: { '/d': undefined },
      url: '/d',
      probe: () => {
        ;[value, set] = store.field.day.use()
      },
    })
    expect(value).toBe('2025-01-01')
    act(() => set('2025-03-04'))
    expect(value).toBe('2025-03-04')
    expect(JSON.parse(localStorage.getItem('basalt:device-lane') ?? '{}')).toEqual({
      v: 1,
      value: { day: '2025-03-04' },
    })
    act(() => store.field.day.clear())
    expect(value).toBe('2025-01-01')
    expect(store.keys).toEqual([])
  })
})

describe('defineControls: range', () => {
  const store = defineControls({
    id: 'range-window',
    scope: 'page',
    fields: {
      window: field.range({
        presets: ['7d', '30d', '3m'],
        fallback: '30d',
        custom: true,
        params: { preset: 'span', from: 'start', to: 'end' },
        window: { '3m': () => ({ from: '2025-01-01', to: '2025-03-31' }) },
      }),
    },
  })

  test('toWindow: preset, resolver, custom', () => {
    const { toWindow } = store.field.window
    expect(toWindow({ preset: '7d' })).toEqual({ window: '7d' })
    expect(toWindow({ preset: '3m' })).toEqual({ from: '2025-01-01', to: '2025-03-31' })
    expect(toWindow({ preset: 'custom', from: '2025-02-01', to: '2025-02-10' })).toEqual({
      from: '2025-02-01',
      to: '2025-02-10',
    })
  })

  test('useValues returns a range as its RangeValue and a multi as its array', async () => {
    const values = defineControls({
      id: 'values-whole',
      scope: 'page',
      fields: {
        opened: field.range({
          presets: ['7d', '30d'],
          fallback: '30d',
          custom: true,
          window: { '7d': () => ({ from: '2025-01-01', to: '2025-01-07' }) },
        }),
        tags: field.multi(['a', 'b'], []),
        q: field.string(''),
      },
    })
    const seen: unknown[] = []
    const probe = (): void => {
      seen.push(values.useValues())
    }
    await mount({
      pages: { '/': values },
      url: '/?opened=custom&from=2025-02-01&to=2025-02-10&tags=a',
      probe,
    })
    const last = seen.at(-1) as ReturnType<typeof values.useValues>
    expect(last).toEqual({
      opened: { preset: 'custom', from: '2025-02-01', to: '2025-02-10' },
      tags: ['a'],
      q: '',
    })
    expect(values.field.opened.toWindow(last.opened)).toEqual({
      from: '2025-02-01',
      to: '2025-02-10',
    })
  })

  test('toWindow reads a custom value without both dates as the fallback', () => {
    const { toWindow } = store.field.window
    expect(toWindow({ preset: 'custom' })).toEqual({ window: '30d' })
    expect(toWindow({ preset: 'custom', from: '2025-02-01' })).toEqual({ window: '30d' })
    expect(toWindow({ preset: 'custom', from: '2025-02-10', to: '2025-02-01' })).toEqual({
      window: '30d',
    })
  })

  test('renamed params decode and own their names', () => {
    expect(store.keys).toEqual(['span', 'start', 'end'])
    const value = store.validateSearch['~standard'].validate({
      span: 'custom',
      start: '2025-01-01',
      end: '2025-01-02',
    }).value
    expect(value).toEqual({ span: 'custom', start: '2025-01-01', end: '2025-01-02' })
    expect(store.validateSearch['~standard'].validate({ span: 'custom' }).value).toEqual({
      span: '30d',
      start: undefined,
      end: undefined,
    })
  })
})
