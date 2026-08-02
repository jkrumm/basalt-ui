/**
 * parseAgentPart / isStartPart — the runtime narrowing guard over the AgentPart wire format.
 *
 * Scope: the parser AS IT EXISTS TODAY (B1) — no required `id`/`toolCallId`, no `AgentPartDraft`,
 * no seven-state ToolCallPart union; those are 1.10.0 part-identity work landing on top of this
 * currently-untested parser (see the sibling `ai-sdk-transport.test.ts`'s scope note for the same
 * cutoff). Every AgentPart variant below is validated against parts.ts:87's `parseAgentPart` and
 * parts.ts:134's `isStartPart` as they read right now.
 */
import { describe, expect, test } from 'bun:test'
import { isStartPart, parseAgentPart } from './parts'
import type { AgentPart } from './parts'

/** JSON round-trip a value through JSON.stringify → JSON.parse, mirroring wire transport. */
function roundTrip(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value))
}

describe('parseAgentPart', () => {
  describe('start', () => {
    test('parses a minimal start part (no resumeToken)', () => {
      const raw = { type: 'start', runId: 'run-1' }
      expect(parseAgentPart(raw)).toEqual({ type: 'start', runId: 'run-1' })
    })

    test('parses a start part with resumeToken', () => {
      const raw = { type: 'start', runId: 'run-1', resumeToken: 'tok-1' }
      expect(parseAgentPart(raw)).toEqual({
        type: 'start',
        runId: 'run-1',
        resumeToken: 'tok-1',
      })
    })

    test('drops a non-string resumeToken rather than passing it through', () => {
      const raw = { type: 'start', runId: 'run-1', resumeToken: 42 }
      expect(parseAgentPart(raw)).toEqual({ type: 'start', runId: 'run-1' })
    })

    test('rejects a missing runId', () => {
      expect(parseAgentPart({ type: 'start' })).toBeNull()
    })

    test('rejects a non-string runId', () => {
      expect(parseAgentPart({ type: 'start', runId: 42 })).toBeNull()
    })

    test('round-trips through JSON', () => {
      const part: AgentPart = { type: 'start', runId: 'run-1', resumeToken: 'tok-1' }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })
  })

  describe('text', () => {
    test('parses a text part', () => {
      expect(parseAgentPart({ type: 'text', text: 'hello' })).toEqual({
        type: 'text',
        text: 'hello',
      })
    })

    test('rejects a missing text field', () => {
      expect(parseAgentPart({ type: 'text' })).toBeNull()
    })

    test('rejects a non-string text field', () => {
      expect(parseAgentPart({ type: 'text', text: 1 })).toBeNull()
    })

    test('round-trips through JSON', () => {
      const part: AgentPart = { type: 'text', text: 'hello' }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })
  })

  describe('reasoning', () => {
    test('parses a reasoning part', () => {
      expect(parseAgentPart({ type: 'reasoning', text: 'thinking...' })).toEqual({
        type: 'reasoning',
        text: 'thinking...',
      })
    })

    test('rejects a missing text field', () => {
      expect(parseAgentPart({ type: 'reasoning' })).toBeNull()
    })

    test('round-trips through JSON', () => {
      const part: AgentPart = { type: 'reasoning', text: 'thinking...' }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })
  })

  describe('tool', () => {
    test('parses a minimal tool part (input only, no output/toolCallId)', () => {
      const raw = { type: 'tool', toolName: 'search', input: { q: 'x' } }
      expect(parseAgentPart(raw)).toEqual({
        type: 'tool',
        toolName: 'search',
        input: { q: 'x' },
      })
    })

    test('parses a tool part with output and toolCallId', () => {
      const raw = {
        type: 'tool',
        toolName: 'search',
        input: { q: 'x' },
        output: { hits: 3 },
        toolCallId: 'call-1',
      }
      expect(parseAgentPart(raw)).toEqual({
        type: 'tool',
        toolName: 'search',
        input: { q: 'x' },
        output: { hits: 3 },
        toolCallId: 'call-1',
      })
    })

    test('rejects a missing toolName', () => {
      expect(parseAgentPart({ type: 'tool', input: {} })).toBeNull()
    })

    test('rejects a non-string toolName', () => {
      expect(parseAgentPart({ type: 'tool', toolName: 1, input: {} })).toBeNull()
    })

    test('rejects a missing input key entirely (undefined input is a valid value, absent key is not)', () => {
      expect(parseAgentPart({ type: 'tool', toolName: 'search' })).toBeNull()
    })

    test('accepts an explicit `input: undefined` (the key is present)', () => {
      const raw = { type: 'tool', toolName: 'search', input: undefined }
      expect(parseAgentPart(raw)).toEqual({ type: 'tool', toolName: 'search', input: undefined })
    })

    test('drops a non-string toolCallId rather than passing it through', () => {
      const raw = { type: 'tool', toolName: 'search', input: {}, toolCallId: 7 }
      expect(parseAgentPart(raw)).toEqual({ type: 'tool', toolName: 'search', input: {} })
    })

    test('round-trips through JSON', () => {
      const part: AgentPart = {
        type: 'tool',
        toolName: 'search',
        input: { q: 'x' },
        output: { hits: 3 },
        toolCallId: 'call-1',
      }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })
  })

  describe('source', () => {
    test('parses a minimal source part (no title)', () => {
      expect(parseAgentPart({ type: 'source', url: 'https://example.com' })).toEqual({
        type: 'source',
        url: 'https://example.com',
      })
    })

    test('parses a source part with title', () => {
      const raw = { type: 'source', url: 'https://example.com', title: 'Example' }
      expect(parseAgentPart(raw)).toEqual({
        type: 'source',
        url: 'https://example.com',
        title: 'Example',
      })
    })

    test('rejects a missing url', () => {
      expect(parseAgentPart({ type: 'source' })).toBeNull()
    })

    test('drops a non-string title rather than passing it through', () => {
      const raw = { type: 'source', url: 'https://example.com', title: 7 }
      expect(parseAgentPart(raw)).toEqual({ type: 'source', url: 'https://example.com' })
    })

    test('round-trips through JSON', () => {
      const part: AgentPart = { type: 'source', url: 'https://example.com', title: 'Example' }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
    })
  })

  describe('error', () => {
    test('parses an error part', () => {
      expect(parseAgentPart({ type: 'error', message: 'boom' })).toEqual({
        type: 'error',
        message: 'boom',
      })
    })

    test('rejects a missing message', () => {
      expect(parseAgentPart({ type: 'error' })).toBeNull()
    })

    test('rejects a non-string message', () => {
      expect(parseAgentPart({ type: 'error', message: 500 })).toBeNull()
    })

    test('round-trips through JSON', () => {
      const part: AgentPart = { type: 'error', message: 'boom' }
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
      expect(parseAgentPart({ text: 'hello' })).toBeNull()
    })

    test('rejects an object with a non-string type field', () => {
      expect(parseAgentPart({ type: 1 })).toBeNull()
    })

    test('rejects an unknown type discriminant', () => {
      expect(parseAgentPart({ type: 'unknown-variant', text: 'hi' })).toBeNull()
    })
  })
})

describe('isStartPart', () => {
  test('returns true for a StartPart', () => {
    expect(isStartPart({ type: 'start', runId: 'run-1' })).toBe(true)
  })

  test('returns false for a non-start AgentPart', () => {
    expect(isStartPart({ type: 'text', text: 'hi' })).toBe(false)
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
