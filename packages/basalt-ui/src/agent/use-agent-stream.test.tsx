/**
 * useAgentStream — single in-flight-turn lifecycle: abort, supersede, error, AbortError handling,
 * unmount cleanup, and StrictMode double-invoke of a "send on mount" consumer effect.
 *
 * Scope: the API AS IT EXISTS TODAY (B1) — no stop-preserves-the-partial-turn semantics, no
 * `ChatMessage.finish`; those are later-release surface (see the sibling `use-agent-thread-runs.*`
 * test files' scope note).
 */
import { describe, expect, test } from 'bun:test'
import { StrictMode, useEffect } from 'react'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { useAgentStream } from './use-agent-stream'
import type { AgentTransport } from './transport'
import type { AgentPart, AgentPartDraft } from './parts'

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('useAgentStream', () => {
  test('stop() mid-stream sets status "done" and discards any parts that arrive after the abort', async () => {
    const gate = deferred<void>()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { id: 'p1', type: 'text', text: 'a' }
        await gate.promise
        // Must never be observed — the consumer's guard should discard this once aborted.
        yield { id: 'p2', type: 'text', text: 'b' }
      },
    }

    const { result } = renderHook(() => useAgentStream({ transport }))

    act(() => {
      void result.current.send('hi')
    })
    await waitFor(() => {
      expect(result.current.parts).toEqual([{ id: 'p1', type: 'text', text: 'a' }])
    })
    expect(result.current.status).toBe('streaming')

    act(() => {
      result.current.stop()
    })
    // stop() sets 'done' synchronously — never 'error', even for an in-flight stream.
    expect(result.current.status).toBe('done')

    gate.resolve(undefined)
    await waitFor(() => {
      expect(result.current.status).toBe('done')
    })
    expect(result.current.parts).toEqual([{ id: 'p1', type: 'text', text: 'a' }])
  })

  test("a second send() supersedes an in-flight one — the first stream's later parts are discarded", async () => {
    const gateFirst = deferred<void>()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream(input) {
        if (input === 'first') {
          yield { id: 'f1', type: 'text', text: 'first-1' }
          await gateFirst.promise
          // Must never be observed — 'second' has already superseded this controller.
          yield { id: 'f2', type: 'text', text: 'first-2' }
        } else {
          yield { id: 's1', type: 'text', text: 'second-1' }
        }
      },
    }

    const { result } = renderHook(() => useAgentStream({ transport }))

    act(() => {
      void result.current.send('first')
    })
    await waitFor(() => {
      expect(result.current.parts).toEqual([{ id: 'f1', type: 'text', text: 'first-1' }])
    })

    act(() => {
      void result.current.send('second')
    })
    await waitFor(() => {
      expect(result.current.parts).toEqual([{ id: 's1', type: 'text', text: 'second-1' }])
    })
    expect(result.current.status).toBe('done')

    gateFirst.resolve(undefined)
    await waitFor(() => {
      expect(result.current.status).toBe('done')
    })
    expect(result.current.parts).toEqual([{ id: 's1', type: 'text', text: 'second-1' }])
  })

  test('F1 regression: id-less drafts of different types within one send() do not destroy each other', async () => {
    // Yields id-less drafts on purpose — the whole point of this regression is that TWO drafts
    // (of different types, so a real bug wouldn't be "same id" but "no id at all") must not
    // collide via `undefined === undefined`. The cast documents that the type says AgentPart
    // (identified) while a transport is always permitted to omit id (AgentPartDraft).
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        yield { type: 'text', text: 'Hi' } as AgentPartDraft as AgentPart
        yield {
          type: 'tool',
          toolCallId: 'c1',
          toolName: 'search',
          state: 'input-available',
          input: { q: 'x' },
        } as AgentPartDraft as AgentPart
        yield { type: 'text', text: 'Bye' } as AgentPartDraft as AgentPart
      },
    }

    const { result } = renderHook(() => useAgentStream({ transport }))

    await act(async () => {
      await result.current.send('hi')
    })

    // Pre-fix: mergePart matched all three drafts on `undefined === undefined`, so text→tool→text
    // collapsed to a single (wrong-typed) entry instead of three. withPartIds stamping a distinct
    // id per draft is what keeps them apart.
    expect(result.current.parts).toHaveLength(3)
    expect(result.current.parts.map((part) => part.type)).toEqual(['text', 'tool', 'text'])
    const ids = result.current.parts.map((part) => (part as { id: string }).id)
    expect(new Set(ids).size).toBe(3)
  })

  test('a thrown (non-abort) error sets status "error" and captures the error', async () => {
    const boom = new Error('boom')
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        throw boom
        // eslint-disable-next-line no-unreachable
        yield { id: 'unreachable', type: 'text', text: 'unreachable' }
      },
    }

    const { result } = renderHook(() => useAgentStream({ transport }))

    await act(async () => {
      await result.current.send('hi')
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe(boom)
  })

  test('an AbortError thrown by the transport is ignored — it never overwrites status with "error"', async () => {
    const gate = deferred<void>()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream(_input, signal) {
        yield { id: 'p1', type: 'text', text: 'a' }
        await gate.promise
        if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
        yield { id: 'p2', type: 'text', text: 'b' }
      },
    }

    const { result } = renderHook(() => useAgentStream({ transport }))

    act(() => {
      void result.current.send('hi')
    })
    await waitFor(() => {
      expect(result.current.parts).toEqual([{ id: 'p1', type: 'text', text: 'a' }])
    })

    // stop() aborts the signal AND sets 'done' synchronously.
    act(() => {
      result.current.stop()
    })
    expect(result.current.status).toBe('done')

    // The transport now throws AbortError (asynchronously, after 'done' is already set) — this
    // must be swallowed by the catch's `err.name === 'AbortError'` guard, never flip to 'error'.
    gate.resolve(undefined)
    await waitFor(() => {
      expect(result.current.status).toBe('done')
    })
    expect(result.current.error).toBeUndefined()
  })

  test('unmount aborts the in-flight stream', async () => {
    let observedAbortedOnResume = false
    const gate = deferred<void>()
    const transport: AgentTransport<AgentPart, string> = {
      async *stream(_input, signal) {
        yield { id: 'p1', type: 'text', text: 'a' }
        await gate.promise
        observedAbortedOnResume = signal?.aborted ?? false
      },
    }

    const { result, unmount } = renderHook(() => useAgentStream({ transport }))

    act(() => {
      void result.current.send('hi')
    })
    await waitFor(() => {
      expect(result.current.parts).toEqual([{ id: 'p1', type: 'text', text: 'a' }])
    })

    unmount()

    gate.resolve(undefined)
    // Let the generator's resumed step run and observe the signal.
    await new Promise((resolveTick) => setTimeout(resolveTick, 0))
    expect(observedAbortedOnResume).toBe(true)
  })

  test('StrictMode double-invoke of a "send on mount" consumer effect: the surviving stream is the only one reflected in final state', async () => {
    // useAgentStream itself never calls transport.stream() from an effect — only send() does, and
    // send() is consumer-invoked. The realistic StrictMode hazard is therefore a consumer's own
    // `useEffect(() => { void send(x) }, [])` "send the first turn on mount" pattern, which
    // StrictMode's dev-only double-invoke runs twice against the SAME fiber. Verified empirically
    // (reported alongside this suite): transport.stream() IS called twice in that scenario — the
    // first pass's controller is aborted (both by useAgentStream's own unmount-cleanup effect
    // during the simulated unmount, and redundantly by send()'s own
    // `controllerRef.current?.abort()` at the top of the second call) — so exactly ONE stream's
    // output is ever reflected in the hook's observable state, even though the transport function
    // itself was invoked twice. That is the invariant this test pins, not a literal single
    // `transport.stream()` call count.
    let streamCalls = 0
    let capturedParts: AgentPart[] = []
    let capturedStatus = ''

    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {
        streamCalls++
        yield { id: `call-${streamCalls}`, type: 'text', text: `call-${streamCalls}` }
      },
    }

    function Consumer(): null {
      const { send, parts, status } = useAgentStream({ transport })
      capturedParts = parts
      capturedStatus = status
      useEffect(() => {
        void send('initial')
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return null
    }

    await act(async () => {
      render(
        <StrictMode>
          <Consumer />
        </StrictMode>,
      )
    })

    await waitFor(() => {
      expect(capturedStatus).toBe('done')
    })

    expect(streamCalls).toBe(2)
    // Only the SECOND (surviving) call's part made it into final state — the first is discarded.
    expect(capturedParts).toEqual([{ id: 'call-2', type: 'text', text: 'call-2' }])
  })
})
