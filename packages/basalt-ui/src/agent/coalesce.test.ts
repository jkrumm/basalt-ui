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
    // `toolName` keeps its own empty-string convention for "omitted" (unlike toolCallId, whose
    // absence is now modelled in the type) — the strict type still requires the field, hence the cast.
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

  // The SDK's raw approval-responded chunk arrives without its own toolCallId — one of the four
  // SETTLED states whose id is optional in the type (parts.ts, MaybeIdentified), so every fixture
  // below builds a legal wire shape directly, with no cast.

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
    const approvalResponded: ToolCallPart = {
      id: 'p2',
      type: 'tool',
      toolName: 'delete_file',
      state: 'approval-responded',
      input: { path: '/etc/passwd' },
      approval: { id: 'appr-1', approved: true },
    }

    const out = coalesceParts([approvalRequested, approvalResponded])
    expect(out).toHaveLength(1)
    const merged = out[0] as ToolCallPart
    expect(merged.state).toBe('approval-responded')
    // The resolved call keeps the identity the request supplied — the response had none.
    expect(merged.toolCallId).toBe('call-1')
  })

  test('a tool part unresolvable by either toolCallId or approvalId is kept as-is, never dropped', () => {
    const orphan: ToolCallPart = {
      id: 'p1',
      type: 'tool',
      toolName: 'mystery',
      state: 'approval-responded',
      input: {},
      approval: { id: 'unknown-approval', approved: true },
    }

    const out = coalesceParts([orphan])
    expect(out).toEqual([orphan])
  })

  test('an approval-responded seen BEFORE its request stays its own block — the fold never backtracks', () => {
    // The approvalId side index only holds ids seen so far, so a response arriving first cannot
    // resolve. Deliberate: reconciling backwards would let the request (the LATER arrival) win
    // under "later state wins" and re-render an already-answered call as still pending.
    const respondedFirst: ToolCallPart = {
      id: 'p1',
      type: 'tool',
      toolName: 'delete_file',
      state: 'approval-responded',
      input: { path: '/etc/passwd' },
      approval: { id: 'appr-1', approved: true },
    }
    const requestedLater: ToolCallPart = {
      id: 'p2',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'delete_file',
      state: 'approval-requested',
      input: { path: '/etc/passwd' },
      approval: { id: 'appr-1' },
    }
    const outputAvailable: ToolCallPart = {
      id: 'p3',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'delete_file',
      state: 'output-available',
      input: { path: '/etc/passwd' },
      output: { deleted: true },
    }

    const out = coalesceParts([respondedFirst, requestedLater, outputAvailable])
    expect(out).toHaveLength(2)
    // The orphan survives untouched at its original position — never dropped, never rewritten.
    expect(out[0]).toEqual(respondedFirst)
    // Everything from the request onward folds into ONE second block, not a third.
    expect((out[1] as ToolCallPart).state).toBe('output-available')
  })

  test('a failed call keeps NO stale output from the preliminary result it replaces', () => {
    // The defect a blind `{ ...existing, ...next }` spread produced: output-error has no `output`
    // key, so a spread let the preliminary result's `output`/`preliminary` ride along and any
    // consumer branching on `output` before `errorText` rendered a failed call as successful.
    const preliminaryResult: ToolCallPart = {
      id: 'p1',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'search',
      state: 'output-available',
      input: { q: 'x' },
      output: { hits: 1, partial: true },
      preliminary: true,
    }
    const failed: ToolCallPart = {
      id: 'p2',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'search',
      state: 'output-error',
      errorText: 'upstream timed out',
      durationMs: 900,
    }

    const out = coalesceParts([preliminaryResult, failed])
    expect(out).toHaveLength(1)
    const merged = out[0] as ToolCallPart
    expect(merged.state).toBe('output-error')
    expect(Object.hasOwn(merged, 'output')).toBe(false)
    expect(Object.hasOwn(merged, 'preliminary')).toBe(false)
    expect(merged).toEqual({
      id: 'p2',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'search',
      durationMs: 900,
      state: 'output-error',
      errorText: 'upstream timed out',
      // input is the one thing legitimately carried across the transition.
      input: { q: 'x' },
    })
  })

  test('a SETTLED part that arrived unidentified keeps the identity an earlier state supplied', () => {
    // `toolCallId` is optional on the four settled states (parts.ts, MaybeIdentified). A terminal
    // part that resolved only through the approvalId side index must come out of the merge WITH the
    // id the request carried — losing it here would unfold the block on the next pass.
    const approvalRequested: ToolCallPart = {
      id: 'p1',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'transfer_funds',
      state: 'approval-requested',
      input: { amount: 250 },
      approval: { id: 'appr-1' },
    }
    const unidentifiedResult: ToolCallPart = {
      id: 'p2',
      type: 'tool',
      toolName: 'transfer_funds',
      state: 'output-available',
      input: { amount: 250 },
      output: { ok: true },
      approval: { id: 'appr-1', approved: true },
    }

    const out = coalesceParts([approvalRequested, unidentifiedResult])
    expect(out).toHaveLength(1)
    const merged = out[0] as ToolCallPart
    expect(merged.state).toBe('output-available')
    expect(merged.toolCallId).toBe('call-1')
  })

  // ── never throws ───────────────────────────────────────────────────────────
  // The tool-state switch is exhaustive at COMPILE time only. coalesceParts is public, runs on the
  // render path, and folds wire data — an unrecognized state must degrade, not abort the render.

  test('an unrecognized tool state does not throw and yields a sensible merged part', () => {
    const inputAvailable: ToolCallPart = {
      id: 'p1',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'search',
      state: 'input-available',
      input: { q: 'x' },
    }
    // A state no version of the union declares — what a newer server would send to an older client.
    const futureState = {
      id: 'p2',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: '',
      state: 'output-streaming',
      output: { partial: true },
    } as unknown as ToolCallPart

    const warnings: string[] = []
    const original = console.warn
    console.warn = (...args: unknown[]) => void warnings.push(String(args[0]))
    let out: ToolCallPart[]
    try {
      out = coalesceParts([inputAvailable, futureState]) as ToolCallPart[]
    } finally {
      console.warn = original
    }

    expect(out).toHaveLength(1)
    // `state` widened to `string` — the whole point of this test is a state value the
    // `ToolCallState` union does NOT declare (a future server sending an unknown state to an
    // older client), so the real, narrower type would reject the very literal being asserted.
    const merged = out[0] as Omit<ToolCallPart, 'state'> & { output?: unknown; state: string }
    // The incoming part survives intact…
    expect(merged.state).toBe('output-streaming')
    expect(merged.output).toEqual({ partial: true })
    // …with the whitelisted carry-over fields folded in, exactly as a known state would get.
    expect(merged.toolName).toBe('search')
    expect(merged.toolCallId).toBe('call-1')
    // …and the anomaly is announced in dev rather than thrown.
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('unrecognized tool state')
  })

  test('an approval-requested that later succeeds does not carry its pending approval onto the result', () => {
    const approvalRequested: ToolCallPart = {
      id: 'p1',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'transfer_funds',
      state: 'approval-requested',
      input: { amount: 250 },
      approval: { id: 'appr-1' },
    }
    const outputAvailable: ToolCallPart = {
      id: 'p2',
      type: 'tool',
      toolCallId: 'call-1',
      toolName: 'transfer_funds',
      state: 'output-available',
      input: { amount: 250 },
      output: { ok: true },
    }

    const out = coalesceParts([approvalRequested, outputAvailable])
    expect(out).toHaveLength(1)
    // `approval` comes from `next` alone: a pending request envelope (no verdict) must not surface
    // on a settled result, where the type only admits `{ approved?: true }`.
    expect(Object.hasOwn(out[0] as object, 'approval')).toBe(false)
  })
})
