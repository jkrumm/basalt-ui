/**
 * The telemetry seam end to end (V2-SPEC § 7): a real `BasaltProvider` over a real router, and the
 * delivery rules — synchronous, a throwing sink never breaks a render, ids/hashes/counts only.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { BasaltProvider } from './provider'
import { queryClientOf, testRouter } from './provider/test-router'
import { createLiveEmitter } from './telemetry'
import type { BasaltEvent } from './telemetry'

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
        'basalt.query.hash': '["q",1]',
        'basalt.query.failure_count': 1,
        'exception.type': 'TypeError',
        'basalt.error.kind': 'query',
      },
    })
    expect(events.find((e) => e.type === 'mutation.error')).toMatchObject({
      attributes: {
        'basalt.mutation.key': expect.stringMatching(/^[0-9a-f]+$/),
        'exception.type': 'SyntaxError',
        'basalt.error.kind': 'mutation',
      },
    })
    expect(JSON.stringify(events)).not.toContain('leaked')
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
