import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { flattenNav } from '../router-tanstack/nav'
import type { AnyNavGroup } from '../router-tanstack/nav'
import { defineNav, restoreActiveNav, savedActiveNav } from '../../tests/support/nav-test-utils'
import {
  guardViewTransitionRejections,
  navIndexOf,
  routeTransitionTypes,
  routeViewTransition,
} from './route-transition'

const item = (id: string, to: string, extra: object = {}) => ({
  id,
  label: id,
  link: { to },
  ...extra,
})
const nav: { groups: ReadonlyArray<AnyNavGroup> } = {
  groups: [
    {
      id: 'main',
      label: 'Main',
      items: [
        item('home', '/', { exact: true }),
        item('charts', '/charts', { children: [item('line', '/charts/line')] }),
        item('tables', '/tables'),
        item('users', '/users/$userId'),
        item('docs', '/docs/$', { children: [item('docs-api', '/docs/api')] }),
      ],
    },
    { id: 'more', label: 'More', items: [item('settings', '/settings', { exact: true })] },
  ],
}

type Nav = Parameters<typeof routeTransitionTypes>[1]
const change = (from: string, to: string, pathChanged = from !== to) => ({
  fromLocation: { pathname: from },
  toLocation: { pathname: to },
  pathChanged,
})
const go = (from: string | undefined, to: string, pathChanged = from !== to, using: Nav = nav) =>
  routeTransitionTypes(
    {
      ...(from !== undefined && { fromLocation: { pathname: from } }),
      toLocation: { pathname: to },
      pathChanged,
    },
    using,
  )

describe('routeTransitionTypes', () => {
  test.each([
    ['/', '/charts', 'basalt-forward'],
    ['/tables', '/charts', 'basalt-back'],
    ['/charts', '/charts/line', 'basalt-forward'],
    ['/settings', '/', 'basalt-back'],
    ['/charts/line', '/tables', 'basalt-forward'],
  ])('%s → %s is %s', (from, to, type) => {
    expect(go(from, to)).toEqual([type])
  })

  test('same item, or either side outside the nav, is sibling', () => {
    expect(go('/charts/line/42', '/charts/line/43')).toEqual(['basalt-sibling'])
    expect(go('/nowhere', '/charts')).toEqual(['basalt-sibling'])
    expect(go('/charts', '/nowhere')).toEqual(['basalt-sibling'])
    // `exact` and `'/'` do not claim descendants.
    expect(go('/settings/x', '/tables')).toEqual(['basalt-sibling'])
    expect(go('/anything', '/tables')).toEqual(['basalt-sibling'])
  })

  test('a parameterized item matches any value and its descendants, as the sidebar does', () => {
    expect(go('/tables', '/users/42')).toEqual(['basalt-forward'])
    expect(go('/users/42', '/users/43')).toEqual(['basalt-sibling'])
    expect(go('/users/42/posts', '/charts')).toEqual(['basalt-back'])
    expect(go('/users', '/charts')).toEqual(['basalt-sibling'])
    expect(go('/USERS/42', '/charts')).toEqual(['basalt-back'])
    expect(go('/docs/a/b/c', '/tables')).toEqual(['basalt-back'])
  })

  test('the most specific item wins, as in the sidebar', () => {
    // `/docs/api` and `/docs/$` tie on segments; the first in definition order (the splat) keeps it.
    expect(go('/docs/api', '/tables')).toEqual(['basalt-back'])
    // `/charts/line` (2 segments) beats `/charts` (1) for a path beneath it.
    expect(go('/charts/line/x', '/charts')).toEqual(['basalt-back'])
  })

  test('a duplicate `to` keeps the first item', () => {
    const twice = {
      groups: [
        {
          id: 'g',
          label: 'G',
          items: [item('a', '/same'), item('b', '/same'), item('c', '/other')],
        },
      ],
    }
    expect(go('/same', '/other', true, twice)).toEqual(['basalt-forward'])
    expect(go('/other', '/same', true, twice)).toEqual(['basalt-back'])
  })

  test('a deeply nested item is addressable', () => {
    const deep = {
      groups: [
        {
          id: 'g',
          label: 'G',
          items: [
            item('a', '/a', {
              children: [item('b', '/a/b', { children: [item('c', '/a/b/c')] })],
            }),
            item('z', '/z'),
          ],
        },
      ],
    }
    expect(go('/a/b/c/d', '/z', true, deep)).toEqual(['basalt-forward'])
    expect(go('/z', '/a/b/c', true, deep)).toEqual(['basalt-back'])
    expect(go('/a/b/c', '/a/b', true, deep)).toEqual(['basalt-back'])
  })

  test('a trailing slash does not change the match', () => {
    expect(go('/charts/', '/tables/')).toEqual(['basalt-forward'])
  })

  test('first load and search/hash-only changes are no transition', () => {
    expect(go(undefined, '/charts')).toBe(false)
    expect(go('/charts', '/charts', false)).toBe(false)
  })

  test('no nav, or an empty one, degrades to sibling', () => {
    expect(go('/a', '/b', true, undefined)).toEqual(['basalt-sibling'])
    expect(go('/a', '/b', true, { groups: [] })).toEqual(['basalt-sibling'])
  })
})

describe('routeViewTransition.types reads the nav defineNav registered', () => {
  const before = savedActiveNav()
  afterAll(() => restoreActiveNav(before))

  test('live, at navigation time', () => {
    defineNav({ groups: nav.groups })
    expect(routeViewTransition.types(change('/', '/tables'))).toEqual(['basalt-forward'])
    expect(routeViewTransition.types(change('/tables', '/'))).toEqual(['basalt-back'])
    defineNav({ groups: [] })
    expect(routeViewTransition.types(change('/', '/tables'))).toEqual(['basalt-sibling'])
  })
})

describe('the matcher agrees with the router (the sidebar uses router.matchRoute)', () => {
  const corpusNav: { groups: ReadonlyArray<AnyNavGroup> } = {
    groups: [
      {
        id: 'g',
        label: 'G',
        items: [
          item('home', '/', { exact: true }),
          item('dash', '/dashboard', { children: [item('rev', '/dashboard/revenue')] }),
          item('ex', '/exact', { exact: true }),
          item('ann', '/users/$userId', {
            link: { to: '/users/$userId', params: { userId: 'ann' } },
          }),
          item('users', '/users/$userId'),
          item('files', '/files/$'),
          item('xs', '/xs/$', { exact: true }),
          item('opt', '/opt/{-$lang}/about'),
          item('dup1', '/dup'),
          item('dup2', '/dup'),
          item('sp', '/Case/Sensitive'),
        ],
      },
    ],
  }
  const paths = [
    '/',
    '/dashboard',
    '/dashboard/',
    '/dashboard/revenue',
    '/dashboard/revenue/x',
    '/exact',
    '/exact/x',
    '/users',
    '/users/bob',
    '/users/ann',
    '/users/ann/posts',
    '/users/ANN',
    '/files',
    '/files/a',
    '/files/a/b/c',
    '/opt/about',
    '/opt/en/about',
    '/opt/en/about/more',
    '/dup',
    '/dup/x',
    '/case/sensitive',
    '/Case/Sensitive',
    '/nowhere',
  ]
  const flat = flattenNav(corpusNav)

  /** The sidebar's own resolution (`use-nav.ts`): router.matchRoute per item, most specific wins, first on a tie. */
  async function sidebarWinner(pathname: string): Promise<number> {
    const root = createRootRoute()
    const leaf = (path: string) =>
      createRoute({ getParentRoute: () => root, path, component: () => null })
    const router = createRouter({
      routeTree: root.addChildren([
        leaf('/'),
        leaf('/dashboard'),
        leaf('/dashboard/revenue'),
        leaf('/exact'),
        leaf('/users/$userId'),
        leaf('/users/$userId/posts'),
        leaf('/files/$'),
        leaf('/xs/$'),
        leaf('/opt/{-$lang}/about'),
        leaf('/dup'),
        leaf('/Case/Sensitive'),
      ]),
      history: createMemoryHistory({ initialEntries: [pathname] }),
    })
    await router.load()
    let winner = -1
    let specificity = -1
    for (const [index, it] of flat.entries()) {
      const params = it.link.params as Record<string, string> | undefined
      const matched = router.matchRoute(
        { to: it.link.to, ...(params !== undefined && { params }) } as never,
        { fuzzy: it.exact !== true && it.link.to !== '/' },
      )
      const count = it.link.to.split('/').filter(Boolean).length
      if (matched && count > specificity) {
        winner = index
        specificity = count
      }
    }
    return winner
  }

  test.each(paths)('%s picks the same item as the router', async (pathname) => {
    expect(navIndexOf(flat, pathname)).toBe(await sidebarWinner(pathname))
  })
})

describe('guardViewTransitionRejections', () => {
  const original = Object.getOwnPropertyDescriptor(document, 'startViewTransition')
  const restore = () => {
    if (original) Object.defineProperty(document, 'startViewTransition', original)
    else delete (document as { startViewTransition?: unknown }).startViewTransition
  }
  afterEach(restore)

  /** Promise-likes that record the handler the wrapper attaches, so each handler can be judged. */
  const recording = () => {
    const handlers = { ready: [], finished: [], updateCallbackDone: [] } as Record<
      'ready' | 'finished' | 'updateCallbackDone',
      Array<(reason: unknown) => void>
    >
    const promiseFor = (key: keyof typeof handlers) => ({
      catch: (fn: (reason: unknown) => void) => void handlers[key].push(fn),
    })
    return {
      handlers,
      transition: {
        ready: promiseFor('ready'),
        finished: promiseFor('finished'),
        updateCallbackDone: promiseFor('updateCallbackDone'),
      },
    }
  }

  const install = (transition: object) => {
    let calls = 0
    document.startViewTransition = (() => {
      calls++
      return transition
    }) as never
    guardViewTransitionRejections()
    guardViewTransitionRejections()
    const returned = document.startViewTransition(() => {})
    return { calls: () => calls, returned }
  }

  test('wraps once, calls through once per start, and returns the original transition', () => {
    const { transition, handlers } = recording()
    const { calls, returned } = install(transition)
    expect(returned).toBe(transition as never)
    expect(calls()).toBe(1)
    expect(handlers.ready).toHaveLength(1)
    expect(handlers.finished).toHaveLength(1)
  })

  test('is a no-op without the API', () => {
    delete (document as { startViewTransition?: unknown }).startViewTransition
    guardViewTransitionRejections()
    expect(document.startViewTransition).toBeUndefined()
  })

  test('is a no-op on the server (no document)', () => {
    const doc = globalThis.document
    // @ts-expect-error simulating a server
    delete globalThis.document
    try {
      expect(() => guardViewTransitionRejections()).not.toThrow()
    } finally {
      globalThis.document = doc
    }
  })

  test('ready swallows exactly the three skip DOMExceptions and reports everything else once', () => {
    const reports: unknown[] = []
    const realReportError = globalThis.reportError
    globalThis.reportError = (reason: unknown) => void reports.push(reason)
    try {
      const { handlers, transition } = recording()
      install(transition)
      const [ready] = handlers.ready
      for (const name of ['AbortError', 'InvalidStateError', 'TimeoutError'])
        expect(() => ready?.(new DOMException('skipped', name))).not.toThrow()
      expect(reports).toEqual([])
      const syntax = new DOMException('x', 'SyntaxError')
      const bug = new Error('real bug')
      // A look-alike is not a skip: same name, wrong type.
      const lookAlike = Object.assign(new Error('x'), { name: 'AbortError' })
      for (const reason of [syntax, bug, lookAlike, 'AbortError'])
        expect(() => ready?.(reason)).not.toThrow()
      expect(reports).toEqual([syntax, bug, lookAlike, 'AbortError'])
    } finally {
      globalThis.reportError = realReportError
    }
  })

  test('finished never re-raises, and updateCallbackDone is left to the router', () => {
    const { handlers, transition } = recording()
    install(transition)
    const [finished] = handlers.finished
    expect(() => finished?.(new Error('real bug'))).not.toThrow()
    expect(handlers.updateCallbackDone).toHaveLength(0)
  })

  // Real rejected promises, observed through `unhandledRejection` in a child process: the
  // in-process runner fails a test on any unhandled rejection, so the "without the guard" control
  // cannot run here.
  const SCRIPT = `
    import { guardViewTransitionRejections } from ${JSON.stringify(import.meta.dir + '/route-transition.ts')}
    const seen = []
    const reported = []
    globalThis.reportError = (r) => reported.push(r.message)
    process.on('unhandledRejection', (r) => seen.push(r instanceof Error ? r.message : r?.name ?? String(r)))
    const skip = () => new DOMException('Transition was skipped', 'AbortError')
    globalThis.document = {
      startViewTransition() {
        if (process.argv.at(-2) === 'real') {
          const bug = () => new Error('callback threw')
          return { ready: Promise.reject(bug()), finished: Promise.reject(bug()), updateCallbackDone: Promise.reject(bug()) }
        }
        return { ready: Promise.reject(skip()), finished: Promise.reject(skip()), updateCallbackDone: Promise.resolve() }
      },
    }
    if (process.argv.at(-1) === 'guard') guardViewTransitionRejections()
    const transition = document.startViewTransition()
    // The router awaits updateCallbackDone itself; it must still see the real error.
    let routerSaw = null
    try { await transition.updateCallbackDone } catch (e) { routerSaw = e.message }
    await new Promise((r) => setTimeout(r, 30))
    console.log(JSON.stringify({ seen, reported, routerSaw }))
  `
  const observe = async (scenario: 'skip' | 'real', mode: 'guard' | 'bare') => {
    const proc = Bun.spawn([process.execPath, '-e', SCRIPT, scenario, mode], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const out = await new Response(proc.stdout).text()
    await proc.exited
    return JSON.parse(out.trim().split('\n').at(-1) ?? '{}') as {
      seen: unknown[]
      reported: unknown[]
      routerSaw: string | null
    }
  }

  test('a skipped transition is two unhandled rejections without the guard and none with it', async () => {
    const skipped = ['Transition was skipped', 'Transition was skipped']
    expect((await observe('skip', 'bare')).seen).toEqual(skipped)
    const guarded = await observe('skip', 'guard')
    expect(guarded.seen).toEqual([])
    expect(guarded.reported).toEqual([])
  })

  test('a real error is reported exactly once, and the router still sees it on updateCallbackDone', async () => {
    const guarded = await observe('real', 'guard')
    expect(guarded.reported).toEqual(['callback threw'])
    expect(guarded.routerSaw).toBe('callback threw')
    // Nothing is left unhandled: ready and finished are handled, updateCallbackDone was awaited.
    expect(guarded.seen).toEqual([])
  })
})
