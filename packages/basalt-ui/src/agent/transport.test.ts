/**
 * transport — `isResumable` requires `resume` AND the literal `idempotentReplay: true` assertion.
 */
import { describe, expect, test } from 'bun:test'
import { isResumable } from './transport'
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
