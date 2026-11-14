/**
 * The ai-external-runtime recipe: one fixture message per runtime (TanStack AI 1.3, AG-UI 1.0,
 * assistant-ui 0.15) maps to `MessagePart`s that `partView` renders. The exhaustive `satisfies never`
 * ending of each mapper is the compile-time half (the playground typecheck).
 */
import { partView } from 'basalt-ui/ai'
import type { MessagePart } from 'basalt-ui/ai'
import { describe, expect, test } from 'bun:test'
import { Fragment, createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { fromAgUi, fromAssistantUi, fromTanStack } from './ai-external-runtime'

const html = (parts: MessagePart[]): string =>
  renderToStaticMarkup(createElement(Fragment, null, partView(parts, { settled: true })))

describe('mappers', () => {
  test('TanStack AI: a call joins its sibling result, a denial is denied', () => {
    const parts = fromTanStack([
      { type: 'thinking', content: 'Plan.' },
      { type: 'text', content: 'Looking.' },
      { type: 'tool-call', id: 'a', name: 'show', input: { x: 1 }, state: 'complete' },
      { type: 'tool-result', toolCallId: 'a', content: 'ok' },
      { type: 'tool-call', id: 'b', name: 'rm', input: {}, state: 'complete' },
      { type: 'tool-result', toolCallId: 'b', content: 'no', outcome: 'denied' },
      { type: 'tool-call', id: 'c', name: 'rm', input: {}, state: 'approval-requested' },
    ])
    expect(parts.map((p) => p.type)).toEqual([
      'reasoning',
      'text',
      'tool-show',
      'tool-rm',
      'tool-rm',
    ])
    expect(parts.map((p) => ('state' in p ? p.state : ''))).toEqual([
      '',
      '',
      'output-available',
      'output-denied',
      'approval-requested',
    ])
    expect(html(parts)).toContain('Looking.')
  })

  test('AG-UI: toolCalls on the assistant take their result from the tool message', () => {
    const parts = fromAgUi([
      { role: 'user' },
      {
        role: 'assistant',
        content: 'Hello',
        toolCalls: [
          { id: 'a', function: { name: 'show', arguments: '{"x":1}' } },
          { id: 'b', function: { name: 'show', arguments: '{"x"' } },
        ],
      },
      { role: 'tool', toolCallId: 'a', content: 'done' },
    ])
    expect(parts).toEqual([
      { type: 'text', text: 'Hello' },
      {
        type: 'tool-show',
        toolCallId: 'a',
        state: 'output-available',
        input: { x: 1 },
        output: 'done',
      },
      {
        type: 'tool-show',
        toolCallId: 'b',
        state: 'input-available',
        input: undefined,
        output: undefined,
      },
    ])
    expect(html(parts)).toContain('Hello')
  })

  test('assistant-ui: the result and isError sit on the call; a string is one text part', () => {
    expect(fromAssistantUi('Hi')).toEqual([{ type: 'text', text: 'Hi' }])
    const parts = fromAssistantUi([
      { type: 'reasoning', text: 'Think.' },
      { type: 'tool-call', toolName: 'show', args: { x: 1 }, result: 'ok' },
      { type: 'tool-call', toolCallId: 'e', toolName: 'show', result: 'bad', isError: true },
      { type: 'source', sourceType: 'url', id: 's', url: 'https://example.com' },
    ])
    expect(parts.map((p) => ('state' in p ? p.state : p.type))).toEqual([
      'reasoning',
      'output-available',
      'output-error',
      'source-url',
    ])
    expect(html(parts).length).toBeGreaterThan(0)
  })
})
