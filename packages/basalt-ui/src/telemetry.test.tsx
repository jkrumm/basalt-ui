/**
 * The telemetry seam end to end (V2-SPEC § 7): a real `BasaltProvider` over a real router, and the
 * delivery rules — synchronous, a throwing sink never breaks a render, ids/hashes/counts only.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { BasaltProvider } from './provider'
import { queryClientOf, testRouter } from './provider/test-router'
import { bindRouteError, createLiveEmitter, devConsoleSink, groupingId } from './telemetry'
import type { BasaltEvent, RouterHook } from './telemetry'

afterEach(cleanup)

describe('createLiveEmitter', () => {
  test('calls the sink synchronously', () => {
    const seen: string[] = []
    const emit = createLiveEmitter(() => (e) => void seen.push(e.type))
    emit({ type: 'route.error', failed: true, start: 0, attributes: failure() })
    expect(seen).toEqual(['route.error'])
  })

  test('a throwing sink is swallowed', () => {
    const emit = createLiveEmitter(() => () => {
      throw new Error('sink bug')
    })
    expect(() =>
      emit({ type: 'route.error', failed: true, start: 0, attributes: failure() }),
    ).not.toThrow()
  })

  test('no sink, no events', () => {
    expect(() =>
      createLiveEmitter(() => undefined)({
        type: 'route.error',
        failed: true,
        start: 0,
        attributes: failure(),
      }),
    ).not.toThrow()
  })
})

function failure() {
  return {
    'basalt.route.id': '__root__',
    'exception.type': 'Error',
    'basalt.error.kind': 'route' as const,
  }
}

const GROUP_SAVE = '2473c7c2'
const GROUP_Q1 = '7d3c17af'
const quiet = () => spyOn(console, 'error').mockImplementation(() => {})

describe('BasaltProvider telemetry', () => {
  test('a throwing sink never breaks the render', async () => {
    const restore = quiet()
    try {
      render(
        <BasaltProvider
          router={testRouter('still here')}
          telemetry={() => {
            throw new Error('sink bug')
          }}
        />,
      )
      expect(await screen.findByText('still here')).toBeDefined()
      expect(() =>
        window.dispatchEvent(new ErrorEvent('error', { error: new RangeError('x') })),
      ).not.toThrow()
    } finally {
      restore.mockRestore()
    }
  })

  test('window error and unhandledrejection → window.error with source and error name only', async () => {
    const restore = quiet()
    const events: BasaltEvent[] = []
    try {
      render(<BasaltProvider router={testRouter()} telemetry={(e) => events.push(e)} />)
      await screen.findByText('content')
      window.dispatchEvent(new ErrorEvent('error', { error: new RangeError('private') }))
      const rejection = new Event('unhandledrejection') as Event & { reason: unknown }
      rejection.reason = 'a string reason'
      window.dispatchEvent(rejection)
    } finally {
      restore.mockRestore()
    }
    const windowEvents = events.filter((e) => e.type === 'window.error')
    expect(windowEvents).toHaveLength(2)
    expect(windowEvents[0]).toMatchObject({
      failed: true,
      attributes: {
        'exception.type': 'RangeError',
        'basalt.error.kind': 'window',
        'basalt.error.source': 'error',
      },
    })
    expect(windowEvents[1]).toMatchObject({
      attributes: {
        'exception.type': 'Error',
        'basalt.error.kind': 'unhandledrejection',
        'basalt.error.source': 'unhandledrejection',
      },
    })
    expect(JSON.stringify(events)).not.toContain('private')
  })

  test('query.error carries the hash and failure count; mutation.error the key; neither the message', async () => {
    const events: BasaltEvent[] = []
    const router = testRouter()
    render(<BasaltProvider router={router} telemetry={(e) => events.push(e)} />)
    await screen.findByText('content')
    const client = queryClientOf(router)

    await client
      .query({
        queryKey: ['q', 1],
        retry: 0,
        queryFn: () => {
          throw new TypeError('row 42 leaked')
        },
      })
      .catch(() => {})
    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ['save'],
        mutationFn: () => Promise.reject(new SyntaxError('body leaked')),
      })
      .execute(undefined)
      .catch(() => {})

    expect(events.find((e) => e.type === 'query.error')).toMatchObject({
      failed: true,
      attributes: {
        'basalt.query.hash': groupingId('["q",1]'),
        'basalt.query.failure_count': 1,
        'exception.type': 'TypeError',
        'basalt.error.kind': 'query',
      },
    })
    expect(events.find((e) => e.type === 'mutation.error')).toMatchObject({
      attributes: {
        'basalt.mutation.key': groupingId('["save"]'),
        'exception.type': 'SyntaxError',
        'basalt.error.kind': 'mutation',
      },
    })
    expect(JSON.stringify(events)).not.toContain('leaked')
  })

  test('with no sink, a mutation failure is logged to the console in dev too', async () => {
    const log = quiet()
    const router = testRouter()
    render(<BasaltProvider router={router} />)
    await screen.findByText('content')
    const client = queryClientOf(router)
    await client
      .getMutationCache()
      .build(client, { mutationKey: ['m'], mutationFn: () => Promise.reject(new Error('x')) })
      .execute(undefined)
      .catch(() => {})
    const calls = log.mock.calls.filter((c) => c[0] === '[basalt] mutation.error')
    log.mockRestore()
    expect(calls).toHaveLength(1)
  })

  test('an explicit sink silences the console default', async () => {
    const log = quiet()
    const router = testRouter()
    render(<BasaltProvider router={router} telemetry={() => {}} />)
    await screen.findByText('content')
    await queryClientOf(router)
      .query({ queryKey: ['q'], retry: 0, queryFn: () => Promise.reject(new Error('x')) })
      .catch(() => {})
    const calls = log.mock.calls.filter((c) => String(c[0]).startsWith('[basalt] query'))
    log.mockRestore()
    expect(calls).toHaveLength(0)
  })

  test('in production an unset sink is silent', async () => {
    const env = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const log = quiet()
    try {
      const router = testRouter()
      render(<BasaltProvider router={router} />)
      await screen.findByText('content')
      await queryClientOf(router)
        .query({ queryKey: ['q'], retry: 0, queryFn: () => Promise.reject(new Error('x')) })
        .catch(() => {})
      expect(log.mock.calls.filter((c) => String(c[0]).startsWith('[basalt] query'))).toHaveLength(
        0,
      )
    } finally {
      log.mockRestore()
      process.env.NODE_ENV = env ?? 'test'
    }
  })

  test('with no sink, a query/mutation failure is logged to the console in dev', async () => {
    const log = quiet()
    const router = testRouter()
    render(<BasaltProvider router={router} />)
    await screen.findByText('content')
    await queryClientOf(router)
      .query({ queryKey: ['q'], retry: 0, queryFn: () => Promise.reject(new TypeError('x')) })
      .catch(() => {})
    const calls = log.mock.calls.filter((c) => c[0] === '[basalt] query.error')
    log.mockRestore()
    expect(calls).toHaveLength(1)
    expect(JSON.stringify(calls[0])).not.toContain('"x"')
  })

  test('no event attribute carries a raw mutation key segment', async () => {
    const events: BasaltEvent[] = []
    const router = testRouter()
    render(<BasaltProvider router={router} telemetry={(e) => events.push(e)} />)
    await screen.findByText('content')
    const client = queryClientOf(router)
    await client
      .getMutationCache()
      .build(client, {
        mutationKey: ['knot', 'private-slug-42', 'update'],
        mutationFn: () => Promise.reject(new Error('x')),
      })
      .execute(undefined)
      .catch(() => {})
    const mutation = events.find((e) => e.type === 'mutation.error')
    expect(mutation).toBeDefined()
    for (const segment of ['knot', 'private-slug-42', 'update']) {
      expect(JSON.stringify(mutation)).not.toContain(segment)
    }
  })

  test('failed:false events carry neither exception.type nor basalt.error.kind', async () => {
    const events: BasaltEvent[] = []
    const router = testRouter()
    render(<BasaltProvider router={router} telemetry={(e) => events.push(e)} />)
    await screen.findByText('content')
    await router.navigate({ to: '/other' } as never)
    const ok = events.filter((e) => !e.failed)
    expect(ok.length).toBeGreaterThan(0)
    for (const e of ok) {
      expect(e.attributes).not.toHaveProperty('exception.type')
      expect(e.attributes).not.toHaveProperty('basalt.error.kind')
      expect('duration' in e).toBe(true)
    }
  })
})

describe('groupingId', () => {
  test('pins exact outputs (an id format change is a visible diff)', () => {
    expect(groupingId('')).toBe('1505')
    expect(groupingId('["save"]')).toBe(GROUP_SAVE)
    expect(groupingId('["q",1]')).toBe(GROUP_Q1)
  })

  test('the same segments in another order group apart', () => {
    expect(groupingId('["a","b"]')).not.toBe(groupingId('["b","a"]'))
  })

  test('distinct keys group apart; the same key groups together', () => {
    const ids = new Set(['["a"]', '["b"]', '["a","1"]', '["a","2"]', 'null'].map(groupingId))
    expect(ids.size).toBe(5)
    expect(groupingId('["a"]')).toBe(groupingId('["a"]'))
  })
})

describe('devConsoleSink', () => {
  const event = {
    type: 'query.error',
    failed: true,
    start: 0,
    attributes: {
      'basalt.query.hash': 'abc',
      'basalt.query.failure_count': 1,
      'exception.type': 'Error',
      'basalt.error.kind': 'query',
    },
  } as const satisfies BasaltEvent

  test('logs query and mutation failures, nothing else', () => {
    const log = quiet()
    devConsoleSink(event)
    devConsoleSink({
      type: 'route.error',
      failed: true,
      start: 0,
      attributes: failure(),
    })
    const calls = log.mock.calls
    log.mockRestore()
    expect(calls).toEqual([['[basalt] query.error', event.attributes]])
  })
})

describe('bindRouteError', () => {
  const routerWith = (hook: RouterHook | undefined) => ({
    options: { context: hook ? { __basalt: hook } : {} },
  })

  test('the latest binding wins; a stale unbind never clears a newer one', () => {
    const hook: RouterHook = {}
    const router = routerWith(hook)
    const a = () => {}
    const b = () => {}
    const unbindA = bindRouteError(router, a)
    const unbindB = bindRouteError(router, b)
    expect(hook.onRouteError).toBe(b)
    unbindA()
    expect(hook.onRouteError).toBe(b)
    unbindB()
    expect(hook.onRouteError).toBeUndefined()
  })

  test('two providers, one unmounts: the other keeps reporting only if it bound last', () => {
    const hook: RouterHook = {}
    const router = routerWith(hook)
    const first = () => {}
    const second = () => {}
    const unbindFirst = bindRouteError(router, first)
    bindRouteError(router, second)
    unbindFirst()
    expect(hook.onRouteError).toBe(second)
  })

  test('a remount rebinds after an unbind', () => {
    const hook: RouterHook = {}
    const router = routerWith(hook)
    const handler = () => {}
    bindRouteError(router, handler)()
    expect(hook.onRouteError).toBeUndefined()
    bindRouteError(router, handler)
    expect(hook.onRouteError).toBe(handler)
  })

  test('a router without the hook warns in dev and unbinds harmlessly', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const unbind = bindRouteError(routerWith(undefined), () => {})
    expect(() => unbind()).not.toThrow()
    const calls = warn.mock.calls
    warn.mockRestore()
    expect(calls).toHaveLength(1)
    expect(String(calls[0]?.[0])).toContain('basaltRouterOptions')
  })

  test('in production the missing-hook warning fires once per document', async () => {
    const env = process.env.NODE_ENV
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      // dev has warned already in this file; production only adds one if it never has — so assert
      // the later binds add none.
      process.env.NODE_ENV = 'production'
      bindRouteError(routerWith(undefined), () => {})
      const afterFirst = warn.mock.calls.length
      bindRouteError(routerWith(undefined), () => {})
      bindRouteError(routerWith(undefined), () => {})
      expect(warn.mock.calls.length).toBe(afterFirst)
    } finally {
      warn.mockRestore()
      process.env.NODE_ENV = env ?? 'test'
    }
  })

  test('a malformed hook (not an object) is treated as missing', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const router = { options: { context: { __basalt: 'nope' } } }
    expect(() => bindRouteError(router, () => {})()).not.toThrow()
    warn.mockRestore()
  })
})
