/**
 * transport — `isResumable` and `edenTransport`'s opt-in `idempotentReplay` flag.
 *
 * `resume` alone is NOT enough for a transport to be treated as resumable: `isResumable` also
 * requires the literal `idempotentReplay: true` assertion, and `edenTransport` only sets it when
 * the caller opts in explicitly via a third argument — never inferred from `resumeCall` alone.
 */
import { describe, expect, test } from 'bun:test'
import { edenTransport, isResumable } from './transport'
import type { AgentTransport } from './transport'
import type { AgentPart } from './parts'

describe('isResumable', () => {
  test('false for a transport with no resume() at all', () => {
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {},
    }
    expect(isResumable(transport)).toBe(false)
  })

  test('false for a transport with resume() but WITHOUT idempotentReplay — resume alone is not enough', () => {
    const transport: AgentTransport<AgentPart, string> = {
      async *stream() {},
      async *resume() {
        yield { id: 'p1', type: 'text', text: 'resumed' }
      },
    }
    expect(isResumable(transport)).toBe(false)
  })

  test('true only once BOTH resume() and idempotentReplay: true are present', () => {
    const transport = {
      async *stream() {},
      async *resume() {
        yield { id: 'p1', type: 'text', text: 'resumed' }
      },
      idempotentReplay: true as const,
    }
    expect(isResumable(transport)).toBe(true)
  })
})

describe('edenTransport — idempotentReplay is opt-in, never inferred', () => {
  test('no resumeCall at all → the returned object has NO resume key', () => {
    const transport = edenTransport<AgentPart>(async () => ({
      data: (async function* () {})(),
      error: null,
    }))
    expect('resume' in transport).toBe(false)
    expect(isResumable(transport)).toBe(false)
  })

  test('resumeCall supplied but NO options → resume() exists but isResumable is still false', () => {
    const transport = edenTransport<AgentPart>(
      async () => ({ data: (async function* () {})(), error: null }),
      async () => ({ data: (async function* () {})(), error: null }),
    )
    expect(typeof transport.resume).toBe('function')
    expect(isResumable(transport)).toBe(false)
  })

  test('resumeCall + { idempotentReplay: true } → isResumable is true', () => {
    const transport = edenTransport<AgentPart>(
      async () => ({ data: (async function* () {})(), error: null }),
      async () => ({ data: (async function* () {})(), error: null }),
      { idempotentReplay: true },
    )
    expect(isResumable(transport)).toBe(true)
  })
})
