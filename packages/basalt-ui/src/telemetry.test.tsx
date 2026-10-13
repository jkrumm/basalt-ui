/**
 * The telemetry seam end to end (V2-SPEC § 7): a real `BasaltProvider` over a real router, and the
 * delivery rules — synchronous, a throwing sink never breaks a render, ids/hashes/counts only.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { BasaltProvider } from './provider'
import { queryClientOf, testRouter } from './provider/test-router'
import { createEmitter } from './telemetry'
import type { BasaltEvent } from './telemetry'

afterEach(cleanup)

describe('createEmitter', () => {
  test('calls the sink synchronously', () => {
    const seen: string[] = []
    const emit = createEmitter((e) => seen.push(e.type))
    emit({ type: 'route.error', failed: true, start: 0, attributes: failure() })
    expect(seen).toEqual(['route.error'])
  })

  test('a throwing sink is swallowed', () => {
    const emit = createEmitter(() => {
      throw new Error('sink bug')
    })
    expect(() =>
      emit({ type: 'route.error', failed: true, start: 0, attributes: failure() }),
    ).not.toThrow()
  })

  test('no sink, no events', () => {
    expect(() =>
      createEmitter(undefined)({
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
      .fetchQuery({
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
        'basalt.mutation.key': '["save"]',
        'exception.type': 'SyntaxError',
        'basalt.error.kind': 'mutation',
      },
    })
    expect(JSON.stringify(events)).not.toContain('leaked')
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
