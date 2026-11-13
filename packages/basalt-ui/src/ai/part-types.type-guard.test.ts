/**
 * P4 (docs/v3/concepts/ai-mdx.md section 7): every part type `ai@7.0.166` can put in
 * `UIMessage['parts']` is assignable to `MessagePart`, checked by `tsc --noEmit`. `Unhomed` is the
 * set of wire parts with no home; it must be `never`, so removing a member of `MessagePart` (or an
 * `ai` minor adding a part type) turns `homed` into a compile error. The sample list is the same
 * claim at run time and doubles as the fixture of the render tests.
 */
import { expect, test } from 'bun:test'
import type { UIMessage } from 'ai'
import type { MessagePart } from './contract'

type WirePart = UIMessage['parts'][number]
type Unhomed = Exclude<WirePart, MessagePart>

export const homed: [Unhomed] extends [never] ? true : false = true

/** One value per wire part type, written with the wire's own types so a drifting shape fails here. */
export const wire = [
  { type: 'text', text: 'hi', state: 'done' },
  { type: 'custom', kind: 'vendor.thing' },
  { type: 'reasoning', text: 'hm', state: 'streaming' },
  { type: 'tool-weather', toolCallId: 'c1', state: 'input-streaming', input: { city: 'O' } },
  {
    type: 'tool-weather',
    toolCallId: 'c2',
    state: 'approval-requested',
    input: {},
    approval: { id: 'a1' },
  },
  { type: 'tool-weather', toolCallId: 'c3', state: 'output-available', input: {}, output: 1 },
  { type: 'tool-weather', toolCallId: 'c4', state: 'output-error', input: {}, errorText: 'no' },
  {
    type: 'tool-weather',
    toolCallId: 'c5',
    state: 'output-denied',
    input: {},
    approval: { id: 'a2', approved: false },
  },
  {
    type: 'dynamic-tool',
    toolName: 'search',
    toolCallId: 'd1',
    state: 'input-available',
    input: 1,
  },
  { type: 'source-url', sourceId: 's1', url: 'https://example.com', title: 'Example' },
  { type: 'source-document', sourceId: 's2', mediaType: 'application/pdf', title: 'Doc' },
  { type: 'file', mediaType: 'image/png', url: 'https://example.com/a.png', filename: 'a.png' },
  { type: 'reasoning-file', mediaType: 'image/png', url: 'https://example.com/r.png' },
  { type: 'data-chart', id: 'x', data: { points: [1, 2] } },
  { type: 'steering-message', id: 'm1', parts: [{ type: 'text', text: 'steer' }] },
  { type: 'step-start' },
] as const satisfies readonly WirePart[]

export const asParts: readonly MessagePart[] = wire

// @ts-expect-error a part type the wire does not have has no home
export const bogus: MessagePart = { type: 'bogus' }

test('every sample wire part type is a MessagePart type', () => {
  expect(homed).toBe(true)
  expect(new Set(asParts.map((p) => p.type.replace(/^(tool|data)-.*/, '$1-*'))).size).toBe(12)
})
