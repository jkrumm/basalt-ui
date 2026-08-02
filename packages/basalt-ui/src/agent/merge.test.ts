/**
 * mergePart — the identity-addressed accumulator. The behaviour under test that matters most:
 * replaying a whole run from character offset 0 rebuilds the identical parts array it produced
 * the first time — it cannot double the content.
 */
import { describe, expect, test } from 'bun:test'
import { mergePart } from './merge'
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
})
