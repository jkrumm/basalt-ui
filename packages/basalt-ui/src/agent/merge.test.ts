/**
 * mergePart — the identity-addressed accumulator. The behaviour under test that matters most:
 * replaying a whole run from character offset 0 rebuilds the identical parts array it produced
 * the first time — it cannot double the content.
 */
import { describe, expect, test } from 'bun:test'
import { mergePart } from './merge'
import type { TranscriptPart } from './foreign'
import type { AgentPart, TextPart, ToolCallPart } from './parts'

describe('mergePart', () => {
  test('appends a part whose id is not yet present', () => {
    const parts: AgentPart[] = [{ id: 'p1', type: 'text', text: 'Hi' }]
    const next: AgentPart = { id: 'p2', type: 'text', text: 'there' }
    expect(mergePart(parts, next)).toEqual([
      { id: 'p1', type: 'text', text: 'Hi' },
      { id: 'p2', type: 'text', text: 'there' },
    ])
  })

  test('an undefined offset splices at the tail (append)', () => {
    const parts: TextPart[] = [{ id: 'p1', type: 'text', text: 'Hel' }]
    const next: TextPart = { id: 'p1', type: 'text', text: 'lo' }
    const [merged] = mergePart(parts, next)
    expect(merged?.text).toBe('Hello')
  })

  test('splices an explicit offset into the middle of the existing text', () => {
    const parts: TextPart[] = [{ id: 'p1', type: 'text', text: 'Hello world' }]
    // Replace the 5-char span starting at offset 6 ("world") with "there"
    const next: TextPart = { id: 'p1', type: 'text', text: 'there', offset: 6 }
    const [merged] = mergePart(parts, next)
    expect(merged?.text).toBe('Hello there')
  })

  test('reasoning splices the same way as text', () => {
    const parts = [{ id: 'p1', type: 'reasoning' as const, text: 'thinking' }]
    const next = { id: 'p1', type: 'reasoning' as const, text: ' more' }
    const [merged] = mergePart(parts, next)
    expect(merged?.text).toBe('thinking more')
  })

  test('offset-0 full replay rebuilds an identical array — it does not double the content', () => {
    // First pass: two deltas building "Hello world" from nothing.
    let parts: TextPart[] = []
    parts = mergePart(parts, { id: 'p1', type: 'text', text: 'Hello' })
    parts = mergePart(parts, { id: 'p1', type: 'text', text: ' world', offset: 5 })
    expect(parts).toHaveLength(1)
    expect(parts[0]?.text).toBe('Hello world')
    const firstPassResult = parts

    // Replay from character 0: the whole run resent as one delta at offset 0.
    const replayed = mergePart(parts, { id: 'p1', type: 'text', text: 'Hello world', offset: 0 })

    expect(replayed).toHaveLength(1)
    expect(replayed[0]?.text).toBe('Hello world')
    expect(replayed).toEqual(firstPassResult.map((p) => ({ ...p, offset: 0 })))
  })

  // ── out-of-range offsets ───────────────────────────────────────────────────
  // spliceText supports exactly two shapes (append at the end, in-range replace). Everything else
  // is CLAMPED into [0, existing.text.length] with a dev warning — never thrown on, because a
  // throw on the render path turns a transient wire anomaly into a permanently dead transcript.

  test('an offset past the end of the existing text clamps to the tail (appends, leaves no hole)', () => {
    const parts: TextPart[] = [{ id: 'p1', type: 'text', text: 'Hi' }]
    const [merged] = mergePart(parts, { id: 'p1', type: 'text', text: '!', offset: 10 })
    expect(merged?.text).toBe('Hi!')
  })

  test('a negative offset clamps to 0 rather than slicing from the end', () => {
    const parts: TextPart[] = [{ id: 'p1', type: 'text', text: 'Hello world' }]
    const [merged] = mergePart(parts, { id: 'p1', type: 'text', text: 'Hey', offset: -3 })
    expect(merged?.text).toBe('Heylo world')
  })

  test('an out-of-order (already-covered) offset replaces in place — it never re-appends', () => {
    // 'Hello world' is fully accumulated; a straggler delta for offset 6 arrives after the tail
    // has moved past it. In-range, so it is honoured as a replace, not clamped.
    const parts: TextPart[] = [{ id: 'p1', type: 'text', text: 'Hello world' }]
    const [merged] = mergePart(parts, { id: 'p1', type: 'text', text: 'WORLD', offset: 6 })
    expect(merged?.text).toBe('Hello WORLD')
  })

  test('a non-finite offset clamps to the tail rather than blanking the part', () => {
    const parts: TextPart[] = [{ id: 'p1', type: 'text', text: 'Hi' }]
    const [merged] = mergePart(parts, { id: 'p1', type: 'text', text: '!', offset: Number.NaN })
    expect(merged?.text).toBe('Hi!')
  })

  test('a FIRST insertion with a nonzero offset clamps and warns like any other out-of-range one', () => {
    // A first insertion splices against an EMPTY existing text, so the offset is out of range
    // [0, 0]: mergePart never invents the 2 missing characters, it stores what arrived — but the
    // anomaly is announced, exactly as it is for an existing part. One contract, one code path.
    const warnings: string[] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => void warnings.push(String(args[0]))
    let first: TextPart[]
    try {
      first = mergePart<TextPart>([], { id: 'p1', type: 'text', text: 'llo', offset: 2 })
    } finally {
      console.warn = original
    }
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('out of range [0, 0]')
    expect(first).toEqual([{ id: 'p1', type: 'text', text: 'llo', offset: 2 }])

    // The offset rides along inert; the next delta for this id splices relative to the STORED text.
    const [merged] = mergePart(first, { id: 'p1', type: 'text', text: ' there' })
    expect(merged?.text).toBe('llo there')
  })

  test('a FIRST insertion with an in-range (0 or undefined) offset stays silent and stores the text as-is', () => {
    const warnings: string[] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => void warnings.push(String(args[0]))
    try {
      expect(mergePart<TextPart>([], { id: 'p1', type: 'text', text: 'Hello', offset: 0 })).toEqual(
        [{ id: 'p1', type: 'text', text: 'Hello', offset: 0 }],
      )
      expect(mergePart<TextPart>([], { id: 'p2', type: 'text', text: 'Hello' })).toEqual([
        { id: 'p2', type: 'text', text: 'Hello' },
      ])
    } finally {
      console.warn = original
    }
    expect(warnings).toHaveLength(0)
  })

  test('warns in dev on an out-of-range offset, and stays silent on an in-range one', () => {
    const warnings: string[] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => void warnings.push(String(args[0]))
    try {
      const parts: TextPart[] = [{ id: 'p1', type: 'text', text: 'Hi' }]
      mergePart(parts, { id: 'p1', type: 'text', text: '!', offset: 1 })
      expect(warnings).toHaveLength(0)

      mergePart(parts, { id: 'p1', type: 'text', text: '!', offset: 10 })
      expect(warnings).toHaveLength(1)
      expect(warnings[0]).toContain('out of range')
    } finally {
      console.warn = original
    }
  })

  test('non-text/reasoning variants replace wholesale rather than merging fields', () => {
    const parts: ToolCallPart[] = [
      {
        id: 'p1',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'input-available',
        input: { q: 'x' },
      },
    ]
    const next: ToolCallPart = {
      id: 'p1',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'search',
      state: 'output-available',
      input: { q: 'x' },
      output: { hits: 3 },
    }
    expect(mergePart(parts, next)).toEqual([next])
  })

  test('a rewrite keeps the original position — ordering is stable', () => {
    const parts: AgentPart[] = [
      { id: 'a', type: 'text', text: 'first' },
      { id: 'b', type: 'text', text: 'second' },
      { id: 'c', type: 'text', text: 'third' },
    ]
    const next: AgentPart = { id: 'b', type: 'text', text: '!!', offset: 6 }
    const merged = mergePart(parts, next)
    expect(merged.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect((merged[1] as TextPart).text).toBe('second!!')
  })

  // B2 convergence fix: mergePart is constrained on PartLike (structural `id` + `type`), not the
  // closed AgentPart union, precisely so a ForeignPart (never text-like) flows through the same
  // accumulator. This is the compile-time contract `useAgentThreadRuns<TranscriptPart>` depends on.
  test('a foreign part (never text-like) survives a round trip unchanged', () => {
    const parts: TranscriptPart[] = []
    const first = mergePart(parts, {
      id: 'f1',
      type: 'data-toolProgress',
      tool: 'search',
      message: 'searching',
    })
    expect(first).toEqual([
      { id: 'f1', type: 'data-toolProgress', tool: 'search', message: 'searching' },
    ])
  })

  test('a replayed foreign part (same id) replaces wholesale rather than duplicating', () => {
    let parts: TranscriptPart[] = []
    parts = mergePart(parts, { id: 'f1', type: 'data-toolProgress', message: 'searching' })
    parts = mergePart(parts, { id: 'f1', type: 'data-toolProgress', message: 'done' })

    expect(parts).toHaveLength(1)
    expect(parts).toEqual([{ id: 'f1', type: 'data-toolProgress', message: 'done' }])
  })
})
