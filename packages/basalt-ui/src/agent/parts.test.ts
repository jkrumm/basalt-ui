/**
 * parseAgentPart / isStartPart / isToolCallSettled — the runtime narrowing guard over the
 * AgentPart wire format, post-1.11.0 part identity + the seven-state ToolCallPart union.
 *
 * Every AgentPart variant below is validated against parts.ts's `parseAgentPart`, `isStartPart`,
 * and `isToolCallSettled` as they read right now: `id` is required on every variant, and `tool`
 * parts are validated against the seven-state discriminated union mirroring AI SDK v7's
 * `UIToolInvocation` (see parts.ts's ToolCallPart doc for the ground-truth corrections against the
 * design spec).
 */
import { describe, expect, test } from 'bun:test'
import { isStartPart, isToolCallSettled, parseAgentPart } from './parts'
import type { AgentPart, ToolCallPart } from './parts'

/** JSON round-trip a value through JSON.stringify → JSON.parse, mirroring wire transport. */
function roundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value))
}

describe('parseAgentPart', () => {
  describe('start', () => {
    test('parses a minimal start part (no resumeToken)', () => {
      const raw = { id: 'p1', type: 'start', runId: 'run-1' }
      expect(parseAgentPart(raw)).toEqual({ id: 'p1', type: 'start', runId: 'run-1' })
    })

    test('parses a start part with resumeToken', () => {
      const raw = { id: 'p1', type: 'start', runId: 'run-1', resumeToken: 'tok-1' }
      expect(parseAgentPart(raw)).toEqual({
        id: 'p1',
        type: 'start',
        runId: 'run-1',
        resumeToken: 'tok-1',
      })
    })

    test('drops a non-string resumeToken rather than passing it through', () => {
      const raw = { id: 'p1', type: 'start', runId: 'run-1', resumeToken: 42 }
      expect(parseAgentPart(raw)).toEqual({ id: 'p1', type: 'start', runId: 'run-1' })
    })

    test('rejects a missing runId', () => {
      expect(parseAgentPart({ id: 'p1', type: 'start' })).toBeNull()
    })

    test('rejects a non-string runId', () => {
      expect(parseAgentPart({ id: 'p1', type: 'start', runId: 42 })).toBeNull()
    })

    test('rejects a missing id', () => {
      expect(parseAgentPart({ type: 'start', runId: 'run-1' })).toBeNull()
    })

    test('round-trips through JSON', () => {
      const part: AgentPart = { id: 'p1', type: 'start', runId: 'run-1', resumeToken: 'tok-1' }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })
  })

  describe('text', () => {
    test('parses a text part', () => {
      expect(parseAgentPart({ id: 'p1', type: 'text', text: 'hello' })).toEqual({
        id: 'p1',
        type: 'text',
        text: 'hello',
      })
    })

    test('parses a text part with offset', () => {
      const raw = { id: 'p1', type: 'text', text: 'llo', offset: 2 }
      expect(parseAgentPart(raw)).toEqual({ id: 'p1', type: 'text', text: 'llo', offset: 2 })
    })

    test('rejects a missing text field', () => {
      expect(parseAgentPart({ id: 'p1', type: 'text' })).toBeNull()
    })

    test('rejects a non-string text field', () => {
      expect(parseAgentPart({ id: 'p1', type: 'text', text: 1 })).toBeNull()
    })

    test('rejects a missing id', () => {
      expect(parseAgentPart({ type: 'text', text: 'hello' })).toBeNull()
    })

    test('round-trips through JSON', () => {
      const part: AgentPart = { id: 'p1', type: 'text', text: 'hello', offset: 0 }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })
  })

  describe('reasoning', () => {
    test('parses a reasoning part', () => {
      expect(parseAgentPart({ id: 'p1', type: 'reasoning', text: 'thinking...' })).toEqual({
        id: 'p1',
        type: 'reasoning',
        text: 'thinking...',
      })
    })

    test('rejects a missing text field', () => {
      expect(parseAgentPart({ id: 'p1', type: 'reasoning' })).toBeNull()
    })

    test('round-trips through JSON', () => {
      const part: AgentPart = { id: 'p1', type: 'reasoning', text: 'thinking...' }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })
  })

  describe('tool', () => {
    test('rejects a missing toolCallId', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolName: 'search',
        state: 'input-available',
        input: {},
      }
      expect(parseAgentPart(raw)).toBeNull()
    })

    test('rejects a missing toolName', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        state: 'input-available',
        input: {},
      }
      expect(parseAgentPart(raw)).toBeNull()
    })

    test('rejects a missing state', () => {
      const raw = { id: 'p1', type: 'tool', toolCallId: 'call-1', toolName: 'search', input: {} }
      expect(parseAgentPart(raw)).toBeNull()
    })

    test('rejects an unknown state', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'running',
        input: {},
      }
      expect(parseAgentPart(raw)).toBeNull()
    })

    test('rejects the pre-1.11.0 flat shape (no `state` field at all)', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolName: 'search',
        toolCallId: 'call-1',
        input: { q: 'x' },
        output: { hits: 3 },
      }
      expect(parseAgentPart(raw)).toBeNull()
    })

    // ── the seven states ────────────────────────────────────────────────────

    test('input-streaming: parses with no input', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'input-streaming',
      }
      expect(parseAgentPart(raw)).toEqual({
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'input-streaming',
      })
    })

    test('input-streaming: parses with a partial input', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'input-streaming',
        input: { q: 'x' },
      }
      expect(parseAgentPart(raw)).toEqual({
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'input-streaming',
        input: { q: 'x' },
      })
    })

    test('input-available: requires input', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'input-available',
      }
      expect(parseAgentPart(raw)).toBeNull()
    })

    test('input-available: round-trips', () => {
      const part: ToolCallPart = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'input-available',
        input: { q: 'x' },
      }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })

    test('approval-requested: round-trips', () => {
      const part: ToolCallPart = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'approval-requested',
        input: { q: 'x' },
        approval: { id: 'appr-1' },
      }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })

    test('approval-requested: rejects a missing approval', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'approval-requested',
        input: { q: 'x' },
      }
      expect(parseAgentPart(raw)).toBeNull()
    })

    test('approval-responded: round-trips with approved + reason', () => {
      const part: ToolCallPart = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'approval-responded',
        input: { q: 'x' },
        approval: { id: 'appr-1', approved: true, reason: 'looks safe' },
      }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })

    test('approval-responded: rejects a non-boolean approved', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'approval-responded',
        input: { q: 'x' },
        approval: { id: 'appr-1' },
      }
      expect(parseAgentPart(raw)).toBeNull()
    })

    test('output-denied: round-trips (approved: false)', () => {
      const part: ToolCallPart = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'output-denied',
        input: { q: 'x' },
        approval: { id: 'appr-1', approved: false, reason: 'too risky' },
      }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })

    test('output-denied: rejects approved !== false', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'output-denied',
        input: { q: 'x' },
        approval: { id: 'appr-1', approved: true },
      }
      expect(parseAgentPart(raw)).toBeNull()
    })

    test('output-available: round-trips with output + preliminary', () => {
      const part: ToolCallPart = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'output-available',
        input: { q: 'x' },
        output: { hits: 3 },
        preliminary: true,
      }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })

    test('output-available: an optional approval carries through', () => {
      const part: ToolCallPart = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'output-available',
        input: { q: 'x' },
        output: { hits: 3 },
        approval: { id: 'appr-1', approved: true },
      }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })

    test('output-available: rejects a missing output', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'output-available',
        input: { q: 'x' },
      }
      expect(parseAgentPart(raw)).toBeNull()
    })

    test('output-error: uses errorText, not error, and round-trips with rawInput', () => {
      const part: ToolCallPart = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'output-error',
        errorText: 'boom',
        rawInput: '{"q": invalid json',
      }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })

    test('output-error: rejects a missing errorText', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'output-error',
      }
      expect(parseAgentPart(raw)).toBeNull()
    })

    test('durationMs and providerExecuted carry through when present', () => {
      const part: ToolCallPart = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'output-available',
        input: { q: 'x' },
        output: { hits: 3 },
        durationMs: 42,
        providerExecuted: true,
      }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })
  })

  describe('source', () => {
    test('parses a minimal source part (no title)', () => {
      expect(parseAgentPart({ id: 'p1', type: 'source', url: 'https://example.com' })).toEqual({
        id: 'p1',
        type: 'source',
        url: 'https://example.com',
      })
    })

    test('parses a source part with title', () => {
      const raw = { id: 'p1', type: 'source', url: 'https://example.com', title: 'Example' }
      expect(parseAgentPart(raw)).toEqual({
        id: 'p1',
        type: 'source',
        url: 'https://example.com',
        title: 'Example',
      })
    })

    test('rejects a missing url', () => {
      expect(parseAgentPart({ id: 'p1', type: 'source' })).toBeNull()
    })

    test('drops a non-string title rather than passing it through', () => {
      const raw = { id: 'p1', type: 'source', url: 'https://example.com', title: 7 }
      expect(parseAgentPart(raw)).toEqual({ id: 'p1', type: 'source', url: 'https://example.com' })
    })

    test('round-trips through JSON', () => {
      const part: AgentPart = {
        id: 'p1',
        type: 'source',
        url: 'https://example.com',
        title: 'Example',
      }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })
  })

  describe('error', () => {
    test('parses an error part', () => {
      expect(parseAgentPart({ id: 'p1', type: 'error', message: 'boom' })).toEqual({
        id: 'p1',
        type: 'error',
        message: 'boom',
      })
    })

    test('rejects a missing message', () => {
      expect(parseAgentPart({ id: 'p1', type: 'error' })).toBeNull()
    })

    test('rejects a non-string message', () => {
      expect(parseAgentPart({ id: 'p1', type: 'error', message: 500 })).toBeNull()
    })

    test('round-trips through JSON', () => {
      const part: AgentPart = { id: 'p1', type: 'error', message: 'boom' }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })
  })

  describe('malformed input', () => {
    test('rejects null', () => {
      expect(parseAgentPart(null)).toBeNull()
    })

    test('rejects a non-object primitive (string)', () => {
      expect(parseAgentPart('not a part')).toBeNull()
    })

    test('rejects a non-object primitive (number)', () => {
      expect(parseAgentPart(42)).toBeNull()
    })

    test('rejects an array', () => {
      // Arrays are `typeof 'object'` but have no `type` string key — falls through the same guard.
      expect(parseAgentPart([1, 2, 3])).toBeNull()
    })

    test('rejects an object with no type field', () => {
      expect(parseAgentPart({ id: 'p1', text: 'hello' })).toBeNull()
    })

    test('rejects an object with a non-string type field', () => {
      expect(parseAgentPart({ id: 'p1', type: 1 })).toBeNull()
    })

    test('rejects an unknown type discriminant', () => {
      expect(parseAgentPart({ id: 'p1', type: 'unknown-variant', text: 'hi' })).toBeNull()
    })
  })
})

describe('isStartPart', () => {
  test('returns true for a StartPart', () => {
    expect(isStartPart({ id: 'p1', type: 'start', runId: 'run-1' })).toBe(true)
  })

  test('returns false for a non-start AgentPart', () => {
    expect(isStartPart({ id: 'p1', type: 'text', text: 'hi' })).toBe(false)
  })

  test('returns false for null', () => {
    expect(isStartPart(null)).toBe(false)
  })

  test('returns false for a non-object primitive', () => {
    expect(isStartPart('start')).toBe(false)
  })

  test('returns false for an object with no type field', () => {
    expect(isStartPart({ runId: 'run-1' })).toBe(false)
  })
})

describe('isToolCallSettled', () => {
  const base = { id: 'p1', type: 'tool', toolCallId: 'call-1', toolName: 'search' } as const

  test('false for input-streaming', () => {
    expect(isToolCallSettled({ ...base, state: 'input-streaming' })).toBe(false)
  })

  test('false for input-available', () => {
    expect(isToolCallSettled({ ...base, state: 'input-available', input: {} })).toBe(false)
  })

  test('false for approval-requested', () => {
    expect(
      isToolCallSettled({
        ...base,
        state: 'approval-requested',
        input: {},
        approval: { id: 'appr-1' },
      }),
    ).toBe(false)
  })

  test('false for approval-responded', () => {
    expect(
      isToolCallSettled({
        ...base,
        state: 'approval-responded',
        input: {},
        approval: { id: 'appr-1', approved: true },
      }),
    ).toBe(false)
  })

  test('true for output-available', () => {
    expect(isToolCallSettled({ ...base, state: 'output-available', input: {}, output: {} })).toBe(
      true,
    )
  })

  test('true for output-error', () => {
    expect(isToolCallSettled({ ...base, state: 'output-error', errorText: 'boom' })).toBe(true)
  })

  test('true for output-denied', () => {
    expect(
      isToolCallSettled({
        ...base,
        state: 'output-denied',
        input: {},
        approval: { id: 'appr-1', approved: false },
      }),
    ).toBe(true)
  })
})
