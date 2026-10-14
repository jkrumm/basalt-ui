import { afterEach, describe, expect, test } from 'bun:test'
import { defineNav } from '../router-tanstack/nav'
import type { AnyNavGroup } from '../router-tanstack/nav'
import {
  guardViewTransitionRejections,
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
  const change = (from: string, to: string) => ({
    fromLocation: { pathname: from },
    toLocation: { pathname: to },
    pathChanged: from !== to,
  })
  test('live, at navigation time', () => {
    // Before any defineNav in this process the stash may be empty or another test's: set our own.
    defineNav({ groups: nav.groups } as never)
    expect(routeViewTransition.types(change('/', '/tables') as never)).toEqual(['basalt-forward'])
    expect(routeViewTransition.types(change('/tables', '/') as never)).toEqual(['basalt-back'])
    defineNav({ groups: [] } as never)
    expect(routeViewTransition.types(change('/', '/tables') as never)).toEqual(['basalt-sibling'])
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

  test('ready swallows exactly the three skip DOMExceptions and rethrows everything else', () => {
    const { handlers, transition } = recording()
    install(transition)
    const [ready] = handlers.ready
    for (const name of ['AbortError', 'InvalidStateError', 'TimeoutError'])
      expect(() => ready?.(new DOMException('skipped', name))).not.toThrow()
    expect(() => ready?.(new DOMException('x', 'SyntaxError'))).toThrow()
    expect(() => ready?.(new Error('real bug'))).toThrow('real bug')
    // A look-alike is not a skip: same name, wrong type.
    const lookAlike = Object.assign(new Error('x'), { name: 'AbortError' })
    expect(() => ready?.(lookAlike)).toThrow()
    expect(() => ready?.('AbortError')).toThrow()
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
    process.on('unhandledRejection', (r) => seen.push(r instanceof Error ? r.message : r?.name ?? String(r)))
    const skip = () => new DOMException('Transition was skipped', 'AbortError')
    globalThis.document = {
      startViewTransition() {
        return { ready: Promise.reject(skip()), finished: Promise.reject(skip()), updateCallbackDone: Promise.resolve() }
      },
    }
    if (process.argv.at(-1) === 'guard') guardViewTransitionRejections()
    document.startViewTransition()
    await new Promise((r) => setTimeout(r, 30))
    console.log(JSON.stringify(seen))
  `
  const observe = async (mode: 'guard' | 'bare') => {
    const proc = Bun.spawn([process.execPath, '-e', SCRIPT, mode], {
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const out = await new Response(proc.stdout).text()
    await proc.exited
    return JSON.parse(out.trim().split('\n').at(-1) ?? '[]') as unknown[]
  }

  test('a skipped transition is two unhandled rejections without the guard and none with it', async () => {
    expect(await observe('bare')).toEqual(['Transition was skipped', 'Transition was skipped'])
    expect(await observe('guard')).toEqual([])
  })
})
