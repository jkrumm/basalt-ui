/**
 * P11 (docs/v3/concepts/ai-mdx.md section 7, I9): the ai-sdk-tools recipe on a mock model with
 * `ai` 7. `show` streams `input-streaming`, then renders through `Block`; a hostile URL in the
 * input never reaches `render`.
 */
import { readUIMessageStream, streamText } from 'ai'
import type { UIMessage } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, spyOn, test } from 'bun:test'
import { Fragment, createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { catalog } from './ai-blocks'
import { POST, show, view } from './ai-sdk-tools'

const html = (parts: Parameters<typeof view>[0], settled = true): string =>
  renderToStaticMarkup(createElement(Fragment, null, view(parts, settled)))

const part = (state: string, input: unknown) =>
  ({ type: 'tool-show', toolCallId: 'c1', state, input }) as const

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 0, reasoning: 0 },
}
const SPEC = JSON.stringify({ spec: { block: 'stat', label: 'Shipped', value: 388 } })

/** A model that streams one `show` call in four JSON fragments, then finishes with tool-calls. */
const mockModel = () =>
  new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(c) {
          c.enqueue({ type: 'stream-start', warnings: [] })
          c.enqueue({ type: 'tool-input-start', id: 'c1', toolName: 'show' })
          for (let i = 0; i < SPEC.length; i += 20)
            c.enqueue({ type: 'tool-input-delta', id: 'c1', delta: SPEC.slice(i, i + 20) })
          c.enqueue({ type: 'tool-input-end', id: 'c1' })
          c.enqueue({ type: 'tool-call', toolCallId: 'c1', toolName: 'show', input: SPEC })
          c.enqueue({
            type: 'finish',
            finishReason: { unified: 'tool-calls', raw: undefined },
            usage,
          })
          c.close()
        },
      }),
    }),
  })

describe('P11: show on a mock model', () => {
  test('streams input-streaming, then renders the stat block through Block', async () => {
    const result = streamText({ model: mockModel(), tools: { show }, prompt: 'headline' })
    const states: string[] = []
    let last: UIMessage | undefined
    for await (const message of readUIMessageStream({ stream: result.toUIMessageStream() })) {
      last = message
      const p = message.parts.find((x) => x.type === 'tool-show')
      if (p && 'state' in p) {
        states.push(p.state)
        expect(() => html([p as never], false)).not.toThrow()
      }
    }
    expect(states).toContain('input-streaming')
    expect(states.at(-1)).toBe('output-available')
    const done = last?.parts.find((x) => x.type === 'tool-show')
    expect(html([done as never])).toContain('Shipped')
  })

  test('the route handler streams the UI message response', async () => {
    const body = JSON.stringify({
      messages: [{ id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
    })
    const res = await POST(
      new Request('http://x.invalid/chat', { method: 'POST', body }),
      mockModel(),
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('tool-input-start')
  })
})

describe('validate runs in Block before any render', () => {
  test('a tool input with href //h yields the unavailable text and render is never called', () => {
    const spies = catalog.blocks.map((b) => spyOn(b, 'render'))
    const input = { spec: { block: 'stat', label: 'x', value: 1, href: '//h' } }
    expect(html([part('output-available', input)])).toContain('could not be displayed')
    for (const spy of spies) expect(spy).not.toHaveBeenCalled()
    for (const spy of spies) spy.mockRestore()
  })

  test('an input still streaming (partial or absent) renders without throwing', () => {
    for (const input of [undefined, {}, { spec: {} }, { spec: { block: 'stat', label: 'Sh' } }]) {
      expect(() => html([part('input-streaming', input)], false)).not.toThrow()
    }
  })
})
