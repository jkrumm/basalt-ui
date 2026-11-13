/**
 * `partView`: the untrusted pin (P2 through the part path), the exhaustive dispatch over every wire
 * part type, the tool rail and its fold, and wire data that must never throw.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { MessagePart, ToolView } from './contract'
import { partView } from './part-view'
import { wire } from './part-types.type-guard.test'

afterEach(cleanup)

const text = (t: string, state?: 'streaming' | 'done'): MessagePart => ({
  type: 'text',
  text: t,
  ...(state && { state }),
})
const tool = (name: string, state: string, extra: Record<string, unknown> = {}): MessagePart =>
  ({
    type: `tool-${name}`,
    toolCallId: `${name}-${state}`,
    state,
    input: {},
    ...extra,
  }) as MessagePart

describe('partView — text and trust', () => {
  test('an attacker image yields no <img> and no preload link', () => {
    for (const src of [
      '//attacker.example/a.png',
      'https://attacker.example/a.png',
      'data:image/png;base64,AA==',
    ]) {
      const { container } = render(<>{partView([text(`![x](${src})`)])}</>)
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('link')).toBeNull()
      expect(container.innerHTML).not.toContain('attacker.example')
      cleanup()
    }
  })

  test('raw HTML and script links are inert', () => {
    const html = renderToStaticMarkup(
      <>
        {partView([
          text('<img src=x onerror=alert(1)> <script>alert(1)</script> [x](javascript:alert(1))'),
        ])}
      </>,
    )
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('javascript:')
  })

  test('markdown renders inside ai-text', () => {
    const { container } = render(<>{partView([text('**bold**')])}</>)
    expect(container.querySelector('[data-slot="ai-text"] strong')?.textContent).toBe('bold')
  })

  test('a streaming tail is repaired, a settled message is not', () => {
    const open = '```ts\nconst a = 1'
    const streaming = render(<>{partView([text(open)], { settled: false })}</>)
    expect(streaming.container.textContent).toContain('const a = 1')
    cleanup()
    const done = render(<>{partView([text('**half', 'done')], { settled: false })}</>)
    expect(done.container.textContent).toContain('**half')
  })
})

describe('partView — dispatch', () => {
  test('every wire part type renders without throwing', () => {
    expect(() =>
      renderToStaticMarkup(<>{partView(wire as readonly MessagePart[])}</>),
    ).not.toThrow()
  })

  test('non-text, non-tool parts get a quiet fallback and never a link or image', () => {
    const fallbacks = wire.filter(
      (p) => !['text', 'step-start'].includes(p.type) && !/^(tool|dynamic)/.test(p.type),
    )
    const { container } = render(<>{partView(fallbacks as readonly MessagePart[])}</>)
    expect(container.querySelectorAll('[data-slot="ai-part"]')).toHaveLength(fallbacks.length)
    expect(container.querySelector('a, img, iframe')).toBeNull()
    expect(container.textContent).toContain('Example')
    expect(container.textContent).toContain('a.png')
  })

  test('step-start renders nothing', () => {
    const { container } = render(<>{partView([{ type: 'step-start' }])}</>)
    expect(container.innerHTML).toBe('')
  })

  test('malformed wire parts do not throw', () => {
    const bad = [
      null,
      undefined,
      5,
      'str',
      {},
      { type: 5 },
      { type: 'text' },
      { type: 'text', text: { a: 1 } },
      { type: 'tool-x' },
      { type: 'tool-x', state: {}, input: 1n },
      { type: 'dynamic-tool', toolName: {} },
      { type: 'file' },
      { type: 'source-url' },
      { type: 'data-x' },
      { type: 'from-the-future', payload: 1 },
    ] as unknown as readonly MessagePart[]
    expect(() => renderToStaticMarkup(<>{partView(bad)}</>)).not.toThrow()
    expect(() => renderToStaticMarkup(<>{partView(bad, { settled: false })}</>)).not.toThrow()
    expect(partView(null as unknown as readonly MessagePart[])).toBeNull()
    expect(partView([])).toBeNull()
  })

  test('an unknown future part type is named, not dropped', () => {
    const { container } = render(
      <>{partView([{ type: 'from-the-future' } as unknown as MessagePart])}</>,
    )
    expect(container.textContent).toBe('from-the-future')
  })
})

describe('partView — tools', () => {
  test('tools gather into one rail under the answer', () => {
    const { container } = render(
      <>
        {partView([tool('a', 'input-available'), text('answer'), tool('b', 'input-streaming')], {
          settled: false,
        })}
      </>,
    )
    const slots = [...container.children].map((c) => c.getAttribute('data-slot'))
    expect(slots).toEqual(['ai-text', 'ai-tools'])
    expect(container.querySelectorAll('[data-slot="ai-tool"]')).toHaveLength(2)
  })

  test('awaiting-approval shows its label and no buttons; denied is not failed', () => {
    const { container } = render(
      <>{partView([tool('pay', 'approval-requested'), tool('del', 'output-denied')])}</>,
    )
    expect(container.textContent).toContain('Awaiting approval')
    expect(container.textContent).toContain('Denied')
    expect(container.querySelector('button')).toBeNull()
    const denied = container.querySelector('[data-state="denied"]')
    expect(denied?.querySelector('[class*="before:bg-bad"]')).toBeNull()
  })

  test('an unresolved tool keeps the rail open after the message settled', () => {
    const { container } = render(<>{partView([text('x'), tool('pay', 'approval-requested')])}</>)
    expect(container.querySelector('[data-slot="collapsible"]')).toBeNull()
    expect(container.textContent).toContain('pay')
  })

  test('a settled rail with every tool resolved folds under "N steps"', () => {
    const { container } = render(
      <>
        {partView([
          tool('a', 'output-available'),
          tool('b', 'output-error', { errorText: 'boom' }),
        ])}
      </>,
    )
    const trigger = container.querySelector('[data-slot="collapsible-trigger"]')
    expect(trigger?.textContent).toBe('2 steps')
    expect(container.textContent).not.toContain('boom')
    fireEvent.click(trigger!)
    expect(container.textContent).toContain('boom')
  })

  test('a rail watched streaming then settled reports its seconds', async () => {
    const parts = [tool('a', 'output-available')]
    const { container, rerender } = render(<>{partView(parts, { settled: false })}</>)
    expect(container.querySelector('[data-slot="collapsible"]')).toBeNull()
    await act(async () => {
      rerender(<>{partView(parts, { settled: true })}</>)
    })
    expect(container.querySelector('[data-slot="collapsible-trigger"]')?.textContent).toBe(
      '1 step · 1 s',
    )
  })

  test('toolRenderers replace the default row by tool name, own keys only', () => {
    const seen: ToolView[] = []
    const renderers = {
      pay: (v: ToolView) => {
        seen.push(v)
        return <b data-testid="custom">custom {v.state}</b>
      },
    }
    const { container } = render(
      <>
        {partView([tool('pay', 'approval-requested'), tool('constructor', 'input-available')], {
          toolRenderers: renderers,
          settled: false,
        })}
      </>,
    )
    expect(container.querySelector('[data-testid="custom"]')?.textContent).toBe(
      'custom awaiting-approval',
    )
    expect(seen).toHaveLength(1)
    expect(container.textContent).toContain('constructor')
  })

  test('an error row prints the model text as text', () => {
    const { container } = render(
      <>{partView([tool('x', 'output-error', { errorText: '<b>bad</b>' })], { settled: false })}</>,
    )
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<b>bad</b>')
  })
})
