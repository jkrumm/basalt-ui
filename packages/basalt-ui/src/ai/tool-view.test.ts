import { describe, expect, test } from 'bun:test'
import type { MessagePart } from './contract'
import { isToolPart, toolView } from './tool-view'
import type { ToolPart } from './tool-view'

const tool = (state: string, extra: Record<string, unknown> = {}): ToolPart =>
  ({ type: 'tool-weather', toolCallId: 'c1', state, input: { city: 'Oslo' }, ...extra }) as ToolPart

describe('toolView', () => {
  test.each([
    ['input-streaming', 'pending'],
    ['input-available', 'running'],
    ['approval-requested', 'awaiting-approval'],
    ['approval-responded', 'running'],
    ['output-available', 'done'],
    ['output-error', 'error'],
    ['output-denied', 'denied'],
  ] as const)('%s maps to %s', (wire, state) => {
    expect(toolView(tool(wire)).state).toBe(state)
  })

  test('names a static tool from its type and a dynamic tool from toolName', () => {
    expect(toolView(tool('input-available')).name).toBe('weather')
    const dynamic = {
      type: 'dynamic-tool',
      toolName: 'search',
      toolCallId: 'd',
      state: 'input-available',
    }
    expect(toolView(dynamic as ToolPart).name).toBe('search')
  })

  test('carries args always, the result only when done and the error only when failed', () => {
    expect(toolView(tool('input-available'))).toEqual({
      state: 'running',
      name: 'weather',
      args: { city: 'Oslo' },
    })
    expect(toolView(tool('output-available', { output: 7 })).result).toBe(7)
    expect(toolView(tool('output-error', { errorText: 'boom' })).error).toBe('boom')
    expect('result' in toolView(tool('input-streaming', { output: 7 }))).toBe(false)
  })

  test('denied is its own state and carries no error', () => {
    const view = toolView(tool('output-denied', { errorText: 'ignored' }))
    expect(view.state).toBe('denied')
    expect(view.error).toBeUndefined()
  })

  test('wire garbage still yields a view', () => {
    expect(toolView(tool('constructor')).state).toBe('pending')
    expect(toolView(tool('output-error', { errorText: { not: 'text' } })).error).toBeUndefined()
    expect(toolView({ type: 'tool-', state: 5 } as unknown as ToolPart).name).toBe('tool')
    expect(toolView({ type: 'dynamic-tool' } as unknown as ToolPart).name).toBe('tool')
  })

  test('isToolPart is true for tool-* and dynamic-tool only', () => {
    expect(isToolPart({ type: 'tool-x' } as unknown as MessagePart)).toBe(true)
    expect(isToolPart({ type: 'dynamic-tool' } as unknown as MessagePart)).toBe(true)
    expect(isToolPart({ type: 'text', text: '' })).toBe(false)
    expect(isToolPart({ type: 'data-tool-x', data: 1 })).toBe(false)
  })
})
