/**
 * parseAgentPart / isStartPart / isToolCallSettled — the runtime narrowing guard over the
 * AgentPart wire format, post-1.11.0 part identity + the seven-state ToolCallPart union.
 *
 * Every AgentPart variant below is validated against parts.ts's `parseAgentPart`, `isStartPart`,
 * and `isToolCallSettled` as they read right now: `id` is required on every variant, `toolCallId`
 * is required on the three in-flight tool states and optional on the four settled ones (see the
 * per-state identity block below), and `tool` parts are validated against the seven-state
 * discriminated union mirroring AI SDK v7's
 * `UIToolInvocation` (see parts.ts's ToolCallPart doc for the ground-truth corrections against the
 * design spec).
 */
import { describe, expect, test } from 'bun:test'
import { isStartPart, isToolCallSettled, parseAgentPart } from './parts'
import type { AgentPart, ToolCallPart, ToolCallState } from './parts'

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
    test('rejects a non-string toolCallId', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 42,
        toolName: 'search',
        state: 'input-available',
        input: {},
      }
      expect(parseAgentPart(raw)).toBeNull()
    })

    // ── toolCallId identity, decided per state ──────────────────────────────
    // An empty string is not a value any state accepts: '' normalizes to absent right here, so the
    // pre-1.12.0 sentinel can never reach the type or a consumer of it. What an ABSENT id then
    // means is a per-state decision (see Identified / MaybeIdentified in parts.ts):
    //   in-flight  (input-streaming, input-available, approval-requested) → REJECTED. The part
    //     exists only to be closed by a later state, which re-supplies its toolName and input;
    //     unidentified it could never be closed and would render as a forever-pending chip.
    //   settled    (approval-responded + the three terminal states)       → KEPT, unidentified.
    //     It carries the OUTCOME; dropping it would erase how the call ended (silent data loss),
    //     while keeping it costs only the fold — coalesceParts renders it as its own block.
    //
    // The `satisfies Record<ToolCallState, …>` below is an authoring-time exhaustiveness gate: add
    // a state to the union and this fixture stops typechecking until its identity behaviour is
    // decided here too. It is an EDITOR/tsc guard only — the package tsconfig excludes `*.test.ts`
    // from `bun run typecheck`, and `bun test` type-strips rather than typechecks — so the
    // "covers every state exactly once" test below backs it with a runtime check of the same claim.

    const UNIDENTIFIED_RAW = {
      'input-streaming': { toolName: 'search', state: 'input-streaming' },
      'input-available': { toolName: 'search', state: 'input-available', input: { q: 'x' } },
      'approval-requested': {
        toolName: 'search',
        state: 'approval-requested',
        input: { q: 'x' },
        approval: { id: 'appr-1' },
      },
      'approval-responded': {
        toolName: 'search',
        state: 'approval-responded',
        input: { q: 'x' },
        approval: { id: 'appr-1', approved: true },
      },
      'output-available': {
        toolName: 'search',
        state: 'output-available',
        input: { q: 'x' },
        output: { hits: 3 },
      },
      'output-error': { toolName: 'search', state: 'output-error', errorText: 'boom' },
      'output-denied': {
        toolName: 'search',
        state: 'output-denied',
        input: { q: 'x' },
        approval: { id: 'appr-1', approved: false },
      },
    } satisfies Record<ToolCallState, Record<string, unknown>>

    const IN_FLIGHT_STATES = [
      'input-streaming',
      'input-available',
      'approval-requested',
    ] as const satisfies readonly ToolCallState[]

    const SETTLED_STATES = [
      'approval-responded',
      'output-available',
      'output-error',
      'output-denied',
    ] as const satisfies readonly ToolCallState[]

    test('the in-flight/settled split covers every tool state exactly once', () => {
      // Object.keys() is always typed string[] regardless of the object's key type — cast back to
      // ToolCallState[], which every key of UNIDENTIFIED_RAW genuinely is (used as
      // UNIDENTIFIED_RAW[state] elsewhere in this file).
      expect([...IN_FLIGHT_STATES, ...SETTLED_STATES].toSorted()).toEqual(
        (Object.keys(UNIDENTIFIED_RAW) as ToolCallState[]).toSorted(),
      )
    })

    for (const state of IN_FLIGHT_STATES) {
      test(`${state}: rejects a missing toolCallId — an in-flight part that could never be closed`, () => {
        expect(parseAgentPart({ id: 'p1', type: 'tool', ...UNIDENTIFIED_RAW[state] })).toBeNull()
      })

      test(`${state}: rejects an empty-string toolCallId identically (it means absent)`, () => {
        const raw = { id: 'p1', type: 'tool', toolCallId: '', ...UNIDENTIFIED_RAW[state] }
        expect(parseAgentPart(raw)).toBeNull()
      })
    }

    for (const state of SETTLED_STATES) {
      test(`${state}: a missing toolCallId keeps the part UNIDENTIFIED — it is never dropped`, () => {
        const parsed = parseAgentPart({ id: 'p1', type: 'tool', ...UNIDENTIFIED_RAW[state] })
        expect(parsed).not.toBeNull()
        expect((parsed as ToolCallPart).state).toBe(state)
        expect(Object.hasOwn(parsed as object, 'toolCallId')).toBe(false)
      })

      test(`${state}: an empty-string toolCallId normalizes to absent, never to ""`, () => {
        const raw = { id: 'p1', type: 'tool', toolCallId: '', ...UNIDENTIFIED_RAW[state] }
        const parsed = parseAgentPart(raw)
        expect(parsed).not.toBeNull()
        expect(Object.hasOwn(parsed as object, 'toolCallId')).toBe(false)
      })

      test(`${state}: a real toolCallId still carries through`, () => {
        const raw = { id: 'p1', type: 'tool', toolCallId: 'call-1', ...UNIDENTIFIED_RAW[state] }
        expect((parseAgentPart(raw) as ToolCallPart | null)?.toolCallId).toBe('call-1')
      })
    }

    test('approval-responded: a real toolCallId round-trips through JSON', () => {
      const part: ToolCallPart = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'delete_file',
        state: 'approval-responded',
        input: { path: '/tmp/x' },
        approval: { id: 'appr-1', approved: true },
      }
      expect(parseAgentPart(roundTrip(part))).toEqual(part)
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

    test('approval-requested: rejects an approval that already carries approved (a verdict, not a pending request)', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'approval-requested',
        input: { q: 'x' },
        approval: { id: 'appr-1', approved: true },
      }
      expect(parseAgentPart(raw)).toBeNull()
    })

    test('approval-requested: rejects an approval that already carries a reason', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'approval-requested',
        input: { q: 'x' },
        approval: { id: 'appr-1', reason: 'too risky' },
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

    test('output-available: rejects approval.approved === false (a denial masquerading as output)', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'output-available',
        input: { q: 'x' },
        output: { hits: 3 },
        approval: { id: 'appr-1', approved: false },
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

    test('output-error: rejects approval.approved === false (a denial masquerading as an error)', () => {
      const raw = {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'output-error',
        errorText: 'boom',
        approval: { id: 'appr-1', approved: false },
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
