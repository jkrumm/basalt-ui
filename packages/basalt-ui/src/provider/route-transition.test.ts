import { afterEach, describe, expect, test } from 'bun:test'
import type { AnyNavGroup } from '../router-tanstack/nav'
import { guardViewTransitionRejections, routeTransitionTypes } from './route-transition'

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
      ],
    },
    { id: 'more', label: 'More', items: [item('settings', '/settings', { exact: true })] },
  ],
}

const go = (from: string | undefined, to: string, pathChanged = from !== to) =>
  routeTransitionTypes(
    {
      ...(from !== undefined && { fromLocation: { pathname: from } }),
      toLocation: { pathname: to },
      pathChanged,
    },
    nav,
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

  test('a trailing slash does not change the match', () => {
    expect(go('/charts/', '/tables/')).toEqual(['basalt-forward'])
  })

  test('first load and search/hash-only changes are no transition', () => {
    expect(go(undefined, '/charts')).toBe(false)
    expect(go('/charts', '/charts', false)).toBe(false)
  })

  test('no nav registered degrades to sibling', () => {
    expect(
      routeTransitionTypes(
        { fromLocation: { pathname: '/a' }, toLocation: { pathname: '/b' }, pathChanged: true },
        undefined,
      ),
    ).toEqual(['basalt-sibling'])
  })
})

describe('guardViewTransitionRejections', () => {
  const original = Object.getOwnPropertyDescriptor(document, 'startViewTransition')
  const restore = () => {
    if (original) Object.defineProperty(document, 'startViewTransition', original)
    else delete (document as { startViewTransition?: unknown }).startViewTransition
  }
  afterEach(restore)

  /** Promise-likes that record the handler the wrapper attaches, so the handler itself can be judged. */
  const recording = () => {
    const handlers: Array<(reason: unknown) => void> = []
    const promise = { catch: (fn: (reason: unknown) => void) => void handlers.push(fn) }
    return {
      handlers,
      transition: { ready: promise, finished: promise, updateCallbackDone: promise },
    }
  }

  /** Installs a fake `startViewTransition` handing back `transition`, guards (twice), calls it once. */
  const run = (transition: object) => {
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
    const { transition } = recording()
    const { calls, returned } = run(transition)
    expect(returned).toBe(transition as never)
    expect(calls()).toBe(1)
  })

  test('is a no-op without the API', () => {
    delete (document as { startViewTransition?: unknown }).startViewTransition
    guardViewTransitionRejections()
    expect(document.startViewTransition).toBeUndefined()
  })

  test('a catch on ready, finished and updateCallbackDone swallows a skip and rethrows anything else', () => {
    const { handlers, transition } = recording()
    run(transition)
    expect(handlers).toHaveLength(3)
    for (const handle of handlers) {
      for (const name of ['AbortError', 'InvalidStateError', 'TimeoutError'])
        expect(() => handle(new DOMException('skipped', name))).not.toThrow()
      expect(() => handle(new Error('real bug'))).toThrow('real bug')
      expect(() => handle(new DOMException('x', 'SyntaxError'))).toThrow()
    }
  })

  test('a skipped real promise never becomes an unhandled rejection', async () => {
    const skipped = () => {
      const p = Promise.reject(new DOMException('Transition was skipped', 'AbortError'))
      p.catch(() => {}) // keep the fake itself quiet; only the wrapper's own derived promises are judged
      return p
    }
    run({ ready: skipped(), finished: skipped(), updateCallbackDone: skipped() })
    // Bun fails the test on any unhandled rejection raised during this tick.
    await new Promise((r) => setTimeout(r, 10))
  })
})
