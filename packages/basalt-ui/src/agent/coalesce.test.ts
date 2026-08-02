/**
 * coalesceParts — merges a rendered turn's parts for display: consecutive text/reasoning runs,
 * and tool parts by toolCallId regardless of adjacency (later state wins, input/toolName from an
 * earlier state survive a later state that omits them, first-occurrence position is kept). An
 * approval-bearing part with no directly usable toolCallId resolves via the approvalId side index.
 */
import { describe, expect, test } from 'bun:test'
import { coalesceParts } from './coalesce'
import type { AgentPart, ToolCallPart } from './parts'

describe('coalesceParts', () => {
  test('merges consecutive text parts into one', () => {
    const parts: AgentPart[] = [
      { id: 'p1', type: 'text', text: 'Hel' },
      { id: 'p2', type: 'text', text: 'lo' },
    ]
    expect(coalesceParts(parts)).toEqual([{ id: 'p2', type: 'text', text: 'Hello' }])
  })

  test('merges consecutive reasoning parts into one', () => {
    const parts: AgentPart[] = [
      { id: 'p1', type: 'reasoning', text: 'thinking' },
      { id: 'p2', type: 'reasoning', text: ' more' },
    ]
    expect(coalesceParts(parts)).toEqual([{ id: 'p2', type: 'reasoning', text: 'thinking more' }])
  })

  test('does not merge text across a non-text part (a tool call interleaved)', () => {
    const parts: AgentPart[] = [
      { id: 'p1', type: 'text', text: 'a' },
      {
        id: 'p2',
        type: 'tool',
        toolCallId: 'call-1',
        toolName: 'search',
        state: 'input-available',
        input: {},
      },
      { id: 'p3', type: 'text', text: 'b' },
    ]
    const out = coalesceParts(parts)
    expect(out).toHaveLength(3)
    expect(out[0]?.type).toBe('text')
    expect(out[2]?.type).toBe('text')
  })

  test('merges tool parts by toolCallId across NON-ADJACENT positions', () => {
    const inputAvailable: ToolCallPart = {
      id: 'p1',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'search',
      state: 'input-available',
      input: { q: 'x' },
    }
    const outputAvailable: ToolCallPart = {
      id: 'p3',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'search',
      state: 'output-available',
      input: { q: 'x' },
      output: { hits: 3 },
    }
    const parts: AgentPart[] = [
      inputAvailable,
      { id: 'p2', type: 'text', text: 'meanwhile...' },
      outputAvailable,
    ]

    const out = coalesceParts(parts)
    expect(out).toHaveLength(2)
    // The merged tool part keeps the position of its FIRST occurrence.
    expect(out[0]?.type).toBe('tool')
    expect((out[0] as ToolCallPart).state).toBe('output-available')
    expect(out[1]?.type).toBe('text')
  })

  test('the later terminal state wins over an earlier one for the same toolCallId', () => {
    const outputAvailable: ToolCallPart = {
      id: 'p1',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'search',
      state: 'output-available',
      input: { q: 'x' },
      output: { hits: 3 },
    }
    const outputError: ToolCallPart = {
      id: 'p2',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'search',
      state: 'output-error',
      errorText: 'timed out',
    }
    const out = coalesceParts([outputAvailable, outputError])
    expect(out).toHaveLength(1)
    expect((out[0] as ToolCallPart).state).toBe('output-error')
  })

  test('input from an earlier state survives a later state that omits it', () => {
    const inputAvailable: ToolCallPart = {
      id: 'p1',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'search',
      state: 'input-available',
      input: { q: 'x' },
    }
    // Simulates the wire shape where `tool-output-available` carries only `output` — a raw
    // pre-normalization shape our strict type doesn't allow, hence the cast.
    const outputAvailableNoInput = {
      id: 'p2',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'search',
      state: 'output-available',
      output: { hits: 3 },
    } as unknown as ToolCallPart

    const out = coalesceParts([inputAvailable, outputAvailableNoInput])
    expect(out).toHaveLength(1)
    const merged = out[0] as ToolCallPart & { output: unknown }
    expect(merged.state).toBe('output-available')
    expect(merged.input).toEqual({ q: 'x' })
    expect(merged.output).toEqual({ hits: 3 })
  })

  test('toolName from an earlier state survives a later state that omits it', () => {
    const inputAvailable: ToolCallPart = {
      id: 'p1',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'search',
      state: 'input-available',
      input: { q: 'x' },
    }
    const outputAvailableNoToolName = {
      id: 'p2',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: '',
      state: 'output-available',
      input: { q: 'x' },
      output: { hits: 3 },
    } as unknown as ToolCallPart

    const out = coalesceParts([inputAvailable, outputAvailableNoToolName])
    expect((out[0] as ToolCallPart).toolName).toBe('search')
  })

  test('an approval-responded part with no toolCallId is resolved via the approvalId side index', () => {
    const approvalRequested: ToolCallPart = {
      id: 'p1',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'delete_file',
      state: 'approval-requested',
      input: { path: '/etc/passwd' },
      approval: { id: 'appr-1' },
    }
    // The SDK's raw approval-responded chunk arrives without its own toolCallId — resolved by
    // reverse lookup on approval.id instead.
    const approvalResponded = {
      id: 'p2',
      type: 'tool',
      toolCallId: '',
      toolName: 'delete_file',
      state: 'approval-responded',
      input: { path: '/etc/passwd' },
      approval: { id: 'appr-1', approved: true },
    } as unknown as ToolCallPart

    const out = coalesceParts([approvalRequested, approvalResponded])
    expect(out).toHaveLength(1)
    expect((out[0] as ToolCallPart).state).toBe('approval-responded')
  })

  test('a tool part unresolvable by either toolCallId or approvalId is kept as-is, never dropped', () => {
    const orphan = {
      id: 'p1',
      type: 'tool',
      toolCallId: '',
      toolName: 'mystery',
      state: 'approval-responded',
      input: {},
      approval: { id: 'unknown-approval', approved: true },
    } as unknown as ToolCallPart

    const out = coalesceParts([orphan])
    expect(out).toEqual([orphan])
  })
})
