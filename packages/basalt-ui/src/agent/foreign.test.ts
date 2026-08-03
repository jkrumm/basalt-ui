/**
 * foreign.ts — runtime coverage for `narrowAgentPart` (the cheap discriminator, distinct from the
 * validating `parseAgentPart`) and `definePartRenderers` (identity passthrough, the canonical
 * const-generic factory contract). Compile-time coverage for the `PartRenderers`/`ConsumerPart`
 * exhaustiveness contract lives in the playground fixture
 * (`apps/playground/src/demo/agent-part-registry.type-guard.ts`), not here.
 */
import { describe, expect, test } from 'bun:test'
import { definePartRenderers, narrowAgentPart } from './foreign'
import type { TranscriptPart } from './foreign'
import type { AgentPart } from './parts'

describe('narrowAgentPart', () => {
  // Typed AgentPart[], not TranscriptPart[]: every literal here IS a built-in variant (the whole
  // point of this fixture), and narrowAgentPart's return type is AgentPart | null — comparing it
  // against a TranscriptPart-typed element (which also admits ForeignPart) doesn't type-check.
  const BUILT_IN_SAMPLES: AgentPart[] = [
    { id: 'p1', type: 'start', runId: 'r1' },
    { id: 'p2', type: 'text', text: 'hi' },
    { id: 'p3', type: 'reasoning', text: 'thinking' },
    {
      id: 'p4',
      type: 'tool',
      toolCallId: 'c1',
      toolName: 'search',
      state: 'input-available',
      input: {},
    },
    { id: 'p5', type: 'source', url: 'https://example.com' },
    { id: 'p6', type: 'error', message: 'boom' },
  ]

  for (const part of BUILT_IN_SAMPLES) {
    test(`narrows a built-in '${part.type}' part`, () => {
      expect(narrowAgentPart(part)).toBe(part)
    })
  }

  test('returns null for a foreign part type', () => {
    const foreign: TranscriptPart = { id: 'p7', type: 'data-chart', spec: {} }
    expect(narrowAgentPart(foreign)).toBeNull()
  })
})

describe('definePartRenderers', () => {
  test('identity passthrough — returns the exact map it was given', () => {
    const renderChart = (): null => null
    const map = { 'data-chart': renderChart }
    expect(definePartRenderers(map)).toBe(map)
  })
})
