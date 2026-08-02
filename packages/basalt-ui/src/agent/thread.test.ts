/**
 * createThreadsStore — ring-buffer caps (maxThreads/maxMessagesPerThread), newest-first ordering,
 * setResumeToken's delete-the-key-on-undefined semantics, and same-tick action accumulation.
 *
 * Uses the REAL localStorage-backed store (happy-dom provides `window.localStorage`), so every
 * test uses its own unique `key` — the same convention as
 * `router-tanstack/multi-search-param-store.test.ts` — to avoid cross-test bleed through the
 * shared localStorage instance the process-wide DOM registration provides.
 */
import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { createThreadsStore } from './thread'
import type { ChatMessage } from './history'

function makeMessage(id: string): ChatMessage {
  return { id, role: 'user', parts: [{ type: 'text', text: id }], createdAt: Date.now() }
}

describe('createThreadsStore', () => {
  test('caps at 50 threads, dropping the oldest (tail) when exceeded', () => {
    const useThreads = createThreadsStore({ key: 'thread-cap-a', version: 1 })
    const { result } = renderHook(() => useThreads())

    const ids: string[] = []
    act(() => {
      for (let i = 0; i < 51; i++) {
        ids.push(result.current.create())
      }
    })

    expect(result.current.threads).toHaveLength(50)
    // The very first created thread is the oldest — it must have been dropped.
    expect(result.current.threads.some((t) => t.id === ids[0])).toBe(false)
    // The very last created thread is the newest — it must be retained, at index 0.
    expect(result.current.threads[0]?.id).toBe(ids[50])
  })

  test('caps at 100 messages per thread, dropping the oldest first', () => {
    const useThreads = createThreadsStore({ key: 'thread-cap-b', version: 1 })
    const { result } = renderHook(() => useThreads())

    let threadId = ''
    act(() => {
      threadId = result.current.create()
    })

    act(() => {
      for (let i = 0; i < 101; i++) {
        result.current.appendMessage(threadId, makeMessage(`m${i}`))
      }
    })

    const thread = result.current.threads.find((t) => t.id === threadId)
    expect(thread?.messages).toHaveLength(100)
    // m0 (the oldest) must have been dropped; m1..m100 survive.
    expect(thread?.messages[0]?.id).toBe('m1')
    expect(thread?.messages.at(-1)?.id).toBe('m100')
  })

  test('threads are stored newest-first: the most recently created thread is always index 0', () => {
    const useThreads = createThreadsStore({ key: 'thread-order-a', version: 1 })
    const { result } = renderHook(() => useThreads())

    let idA = ''
    let idB = ''
    let idC = ''
    act(() => {
      idA = result.current.create()
    })
    act(() => {
      idB = result.current.create()
    })
    act(() => {
      idC = result.current.create()
    })

    expect(result.current.threads.map((t) => t.id)).toEqual([idC, idB, idA])
  })

  test('setResumeToken(id, undefined) deletes the key rather than assigning undefined', () => {
    const useThreads = createThreadsStore({ key: 'thread-resume-a', version: 1 })
    const { result } = renderHook(() => useThreads())

    let threadId = ''
    act(() => {
      threadId = result.current.create()
    })

    act(() => {
      result.current.setResumeToken(threadId, 'token-1')
    })
    const withToken = result.current.threads.find((t) => t.id === threadId)
    expect(withToken?.resumeToken).toBe('token-1')
    expect('resumeToken' in (withToken ?? {})).toBe(true)
    // JSON round-trip: the key is present and serialized.
    expect(JSON.parse(JSON.stringify(withToken)).resumeToken).toBe('token-1')

    act(() => {
      result.current.setResumeToken(threadId, undefined)
    })
    const cleared = result.current.threads.find((t) => t.id === threadId)
    // The distinction this test pins: the key is ABSENT, not present-with-value-undefined —
    // observable via `in` (survives a plain assignment of `undefined`) and via JSON round-trip
    // (an `undefined`-valued key would also vanish from JSON, so `in` is the load-bearing check).
    expect('resumeToken' in (cleared ?? {})).toBe(false)
    expect(cleared?.resumeToken).toBeUndefined()
    expect(JSON.stringify(cleared)).not.toContain('resumeToken')
  })

  test('two synchronous actions called in the same tick accumulate rather than one clobbering the other', () => {
    const useThreads = createThreadsStore({ key: 'thread-accumulate-a', version: 1 })
    const { result } = renderHook(() => useThreads())

    let threadId = ''
    act(() => {
      // Both calls happen before React re-renders and hands back a fresh `result.current` — the
      // second call must still observe the first's effect via the ref mirror (thread.ts:178-190),
      // not the stale pre-render `state` closure.
      threadId = result.current.create()
      result.current.appendMessage(threadId, makeMessage('accumulated'))
    })

    const thread = result.current.threads.find((t) => t.id === threadId)
    expect(thread).toBeDefined()
    expect(thread?.messages).toHaveLength(1)
    expect(thread?.messages[0]?.id).toBe('accumulated')
  })

  test('two synchronous setStatus + setResumeToken calls in one tick both land, not just the last', () => {
    const useThreads = createThreadsStore({ key: 'thread-accumulate-b', version: 1 })
    const { result } = renderHook(() => useThreads())

    let threadId = ''
    act(() => {
      threadId = result.current.create()
    })

    act(() => {
      result.current.setStatus(threadId, 'streaming')
      result.current.setResumeToken(threadId, 'tok-accum')
    })

    const thread = result.current.threads.find((t) => t.id === threadId)
    expect(thread?.status).toBe('streaming')
    expect(thread?.resumeToken).toBe('tok-accum')
  })
})
