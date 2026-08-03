/**
 * ThreadTranscript — the open part-renderer registry's resolution order, the dev/prod fallback
 * contract, and the `MessageBlock` memoization budget from AGENT-CHAT-SPEC.md §9.
 *
 * `messageBlockRenderCounter` is imported directly from `./thread-message` (bypassing the
 * `agent-chat` barrel on purpose — it is not part of the public surface) to prove the memo
 * boundary in a controlled render-count harness.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { definePartRenderers } from '../agent'
import type { ChatMessage, TranscriptPart } from '../agent'
import { messageBlockRenderCounter, ThreadTranscript } from './thread-message'

afterEach(cleanup)

function withNodeEnv<T>(value: string, fn: () => T): T {
  const original = process.env['NODE_ENV']
  process.env['NODE_ENV'] = value
  try {
    return fn()
  } finally {
    process.env['NODE_ENV'] = original
  }
}

function buildMessages(count: number): ChatMessage<TranscriptPart>[] {
  return Array.from({ length: count }, (_, i) => {
    const role: ChatMessage<TranscriptPart>['role'] = i % 2 === 0 ? 'user' : 'assistant'
    return {
      id: `m${i}`,
      role,
      parts: [{ id: `m${i}-p1`, type: 'text', text: `message ${i}` }],
      createdAt: i,
    }
  })
}

describe('resolution order', () => {
  test('a registered consumer renderer wins over the built-in union', () => {
    const renderers = definePartRenderers({
      'data-chart': () => <div data-testid="chart" />,
    })
    const messages: ChatMessage<TranscriptPart>[] = [
      {
        id: 'm1',
        role: 'assistant',
        parts: [{ id: 'p1', type: 'data-chart', spec: {} }],
        createdAt: 0,
      },
    ]

    render(
      <MantineProvider>
        <ThreadTranscript messages={messages} renderers={renderers} />
      </MantineProvider>,
    )

    expect(screen.getByTestId('chart')).toBeDefined()
  })

  test('a built-in AgentPart type still routes through PartList when unclaimed by renderers', () => {
    const messages: ChatMessage<TranscriptPart>[] = [
      {
        id: 'm1',
        role: 'assistant',
        parts: [{ id: 'p1', type: 'text', text: 'hello' }],
        createdAt: 0,
      },
    ]

    render(
      <MantineProvider>
        <ThreadTranscript messages={messages} />
      </MantineProvider>,
    )

    expect(screen.getByText('hello')).toBeDefined()
  })
})

describe('unknown-part fallback — never throws, dev-visible, prod-silent', () => {
  const messages: ChatMessage<TranscriptPart>[] = [
    {
      id: 'm1',
      role: 'assistant',
      parts: [{ id: 'p1', type: 'data-chart', spec: {} }],
      createdAt: 0,
    },
  ]

  test('renders a visible UnknownPartChip outside production', () => {
    withNodeEnv('development', () => {
      expect(() =>
        render(
          <MantineProvider>
            <ThreadTranscript messages={messages} />
          </MantineProvider>,
        ),
      ).not.toThrow()
      expect(screen.getByText(/Unknown part: data-chart/)).toBeDefined()
    })
  })

  test('renders nothing in production, and still never throws', () => {
    withNodeEnv('production', () => {
      expect(() =>
        render(
          <MantineProvider>
            <ThreadTranscript messages={messages} />
          </MantineProvider>,
        ),
      ).not.toThrow()
      expect(screen.queryByText(/Unknown part/)).toBeNull()
    })
  })
})

function messageWithFinish(
  finish: ChatMessage<TranscriptPart>['finish'],
): ChatMessage<TranscriptPart>[] {
  return [
    {
      id: 'm1',
      role: 'assistant',
      parts: [{ id: 'p1', type: 'text', text: 'hello' }],
      createdAt: 0,
      ...(finish === undefined ? {} : { finish }),
    },
  ]
}

describe('finish indicator (AGENT-CHAT-SPEC.md §10)', () => {
  test('finish: stopped renders an indicator with accessible text', () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={messageWithFinish('stopped')} />
      </MantineProvider>,
    )

    expect(screen.getByText('Stopped')).toBeDefined()
  })

  test('finish: error renders an indicator with accessible text', () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={messageWithFinish('error')} />
      </MantineProvider>,
    )

    expect(screen.getByText('Error')).toBeDefined()
  })

  test('finish: complete renders no indicator', () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={messageWithFinish('complete')} />
      </MantineProvider>,
    )

    expect(screen.queryByText('Stopped')).toBeNull()
    expect(screen.queryByText('Error')).toBeNull()
    expect(screen.queryByText('Complete')).toBeNull()
  })

  test("finish absent renders no indicator, identical to today's output", () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={messageWithFinish(undefined)} />
      </MantineProvider>,
    )

    expect(screen.getByText('hello')).toBeDefined()
    expect(screen.queryByText('Stopped')).toBeNull()
    expect(screen.queryByText('Error')).toBeNull()
  })
})

describe('MessageBlock memoization (AGENT-CHAT-SPEC.md §9)', () => {
  test('a streamed delta re-renders exactly one MessageBlock on a 50-message thread', () => {
    const messages = buildMessages(50)
    const { rerender } = render(
      <MantineProvider>
        <ThreadTranscript
          messages={messages}
          liveParts={[{ id: 'live', type: 'text', text: 'a' }]}
          liveStatus="streaming"
        />
      </MantineProvider>,
    )

    // Mount executes every MessageBlock once (nothing to bail out against yet) — that is not the
    // measurement. Reset the counter once the initial render has settled.
    messageBlockRenderCounter.count = 0

    // Same `messages` array reference (unchanged settled history) + a NEW `liveParts` array
    // reference (the streamed delta) — the one prop a delta actually changes.
    rerender(
      <MantineProvider>
        <ThreadTranscript
          messages={messages}
          liveParts={[{ id: 'live', type: 'text', text: 'ab' }]}
          liveStatus="streaming"
        />
      </MantineProvider>,
    )

    expect(messageBlockRenderCounter.count).toBe(1)
  })
})
