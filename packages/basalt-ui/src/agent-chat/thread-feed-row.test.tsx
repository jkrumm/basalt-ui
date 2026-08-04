/**
 * ThreadFeedRow — the lazy-mount / keep-mounted invariant this component exists to guarantee
 * (AGENT-CHAT-SPEC.md §12): never render the transcript before the first expand, never unmount it
 * after. The `effectFireCount` probe is what makes the "no effect re-fire" half of that provable —
 * a re-mount would bump it, a CSS-only hide/show never does.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import { definePartRenderers } from '../agent'
import type {
  AgentThread,
  ChatMessage,
  ForeignPart,
  PartRenderer,
  PartRenderers,
  TranscriptPart,
} from '../agent'
import { ThreadFeedRow } from './thread-feed-row'

afterEach(cleanup)

function buildThread(parts: TranscriptPart[]): AgentThread<TranscriptPart> {
  return {
    id: 'thread-1',
    messages: [{ id: 'm1', role: 'assistant', parts, createdAt: 0 }],
    outcome: { title: 'A resolved thread', summary: 'Summary text', status: 'done' },
    status: 'done',
    read: true,
    createdAt: 0,
    updatedAt: 0,
  }
}

let effectFireCount = 0

/** Mounted once per real mount of the subtree it lives in — proves whether a hide/show cycle
 * re-mounted it (increments again) or merely hid it with CSS (stays put). */
function EffectProbe(): null {
  useEffect(() => {
    effectFireCount += 1
  }, [])
  return null
}

const probeRenderers: PartRenderers = definePartRenderers({
  probe: () => <EffectProbe />,
})

/** Renders whatever `part.type` reached it — used to prove `fallbackRenderer` crossed the row's
 * seam into `ThreadTranscript`, since a dropped prop falls back to the built-in dev-only chip
 * instead (a different testid, not this one). */
const rowFallbackRenderer: PartRenderer<ForeignPart> = ({ part }) => (
  <span data-testid="row-fallback-part">{part.type}</span>
)

function renderRow(expanded: boolean) {
  const thread = buildThread([{ id: 'p1', type: 'probe' }])
  return render(
    <MantineProvider>
      <ThreadFeedRow
        thread={thread}
        expanded={expanded}
        onToggle={() => {}}
        renderers={probeRenderers}
        onSend={() => {}}
      />
    </MantineProvider>,
  )
}

describe('ThreadFeedRow — lazy mount, kept mounted', () => {
  test('collapsed initially: the transcript body is not in the DOM', () => {
    renderRow(false)

    expect(screen.queryByTestId('thread-feed-row-body')).toBeNull()
  })

  test('expanding mounts the transcript body', () => {
    const { rerender } = render(
      <MantineProvider>
        <ThreadFeedRow
          thread={buildThread([{ id: 'p1', type: 'probe' }])}
          expanded={false}
          onToggle={() => {}}
          renderers={probeRenderers}
          onSend={() => {}}
        />
      </MantineProvider>,
    )
    expect(screen.queryByTestId('thread-feed-row-body')).toBeNull()

    rerender(
      <MantineProvider>
        <ThreadFeedRow
          thread={buildThread([{ id: 'p1', type: 'probe' }])}
          expanded
          onToggle={() => {}}
          renderers={probeRenderers}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    expect(screen.getByTestId('thread-feed-row-body')).toBeDefined()
  })

  test('collapsing again keeps the subtree mounted, hidden via CSS only', () => {
    const thread = buildThread([{ id: 'p1', type: 'probe' }])
    const { rerender } = render(
      <MantineProvider>
        <ThreadFeedRow
          thread={thread}
          expanded
          onToggle={() => {}}
          renderers={probeRenderers}
          onSend={() => {}}
        />
      </MantineProvider>,
    )
    expect(screen.getByTestId('thread-feed-row-body')).toBeDefined()

    rerender(
      <MantineProvider>
        <ThreadFeedRow
          thread={thread}
          expanded={false}
          onToggle={() => {}}
          renderers={probeRenderers}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    // Still present — a `queryByTestId`-returns-null assertion here would be the "unmounted"
    // behavior this test exists to rule out.
    const body = screen.getByTestId('thread-feed-row-body')
    expect(body).toBeDefined()
    expect(body.style.display).toBe('none')
  })

  test('re-expanding after a collapse does NOT re-fire the subtree effect', () => {
    effectFireCount = 0
    const thread = buildThread([{ id: 'p1', type: 'probe' }])
    const props = {
      thread,
      onToggle: () => {},
      renderers: probeRenderers,
      onSend: () => {},
    } as const

    const { rerender } = render(
      <MantineProvider>
        <ThreadFeedRow {...props} expanded />
      </MantineProvider>,
    )
    expect(effectFireCount).toBe(1)

    rerender(
      <MantineProvider>
        <ThreadFeedRow {...props} expanded={false} />
      </MantineProvider>,
    )
    rerender(
      <MantineProvider>
        <ThreadFeedRow {...props} expanded />
      </MantineProvider>,
    )

    // A re-mount (the defect this invariant guards against) would bump this to 2.
    expect(effectFireCount).toBe(1)
  })

  test('clicking the header calls onToggle with the thread id', () => {
    // A plain `let` narrows to `null` at the assertion below (TS can't prove the callback ran) —
    // a mutable holder object sidesteps that, since object property writes aren't narrowed the
    // same way across the closure boundary.
    const toggled: { id: string | null } = { id: null }
    const thread: AgentThread<TranscriptPart> = {
      ...buildThread([{ id: 'p1', type: 'text', text: 'hi' }]),
      outcome: null,
    }
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={thread}
          expanded={false}
          onToggle={(id) => {
            toggled.id = id
          }}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    screen.getByText('Untitled thread')
    screen.getByRole('button').click()

    expect(toggled.id).toBe('thread-1')
  })
})

// ── The composer half of `liveStatus` ────────────────────────────────────────────────────────
// `onStop` was documented ("shown as the composer's Stop action while liveStatus === 'streaming'")
// but never forwarded together with the `streaming` flag `Composer` actually gates on
// (`composer.tsx`'s `showStop`/`inputDisabled`) — so Stop never appeared and a second turn could
// still be typed into a live thread. These assert the composer itself reflects `liveStatus`.

describe('ThreadFeedRow — composer reflects liveStatus', () => {
  test('liveStatus="streaming" with onStop shows Stop instead of Send, and calls onStop', () => {
    let stops = 0
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={buildThread([])}
          expanded
          onToggle={() => {}}
          liveStatus="streaming"
          onStop={() => {
            stops += 1
          }}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    expect(screen.queryByLabelText('Send message')).toBeNull()
    fireEvent.click(screen.getByLabelText('Stop generating'))
    expect(stops).toBe(1)
  })

  test('liveStatus="streaming" disables the composer textarea', () => {
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={buildThread([])}
          expanded
          onToggle={() => {}}
          liveStatus="streaming"
          onStop={() => {}}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true)
  })

  test('liveStatus="done" (or unset) shows Send, not Stop, and leaves the textarea enabled', () => {
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={buildThread([])}
          expanded
          onToggle={() => {}}
          liveStatus="done"
          onStop={() => {}}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    expect(screen.getByLabelText('Send message')).toBeDefined()
    expect(screen.queryByLabelText('Stop generating')).toBeNull()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(false)
  })
})

// ── The row → transcript seam ────────────────────────────────────────────────────────────────
// `ThreadFeedRow` and `ThreadTranscript` were built in parallel: the row declared the shared
// contract (`affordances`, and later `groupConsecutive`/`virtualize`) while the transcript grew the
// props that consume it. Each half was correct alone and the pair still compiled with the row
// silently DROPPING all three on the floor — a defect no type or single-component test can see.
// These assert the forwarding itself: every one of them goes red if a prop stops being passed
// through, which is exactly the failure that shipped.

function threadWith(messages: ChatMessage<TranscriptPart>[]): AgentThread<TranscriptPart> {
  return { ...buildThread([]), messages }
}

const T0 = 1_000_000_000

function textMessage(
  id: string,
  role: ChatMessage<TranscriptPart>['role'],
  createdAt: number,
): ChatMessage<TranscriptPart> {
  return { id, role, parts: [{ id: `${id}-p1`, type: 'text', text: `body ${id}` }], createdAt }
}

describe('ThreadFeedRow forwards the transcript contract it declares', () => {
  test('affordances reach the row’s messages — a custom action renders inside the body', () => {
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={threadWith([textMessage('fm1', 'assistant', T0)])}
          expanded
          onToggle={() => {}}
          affordances={{ actions: () => <span data-testid="row-custom-action">extra</span> }}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    // Dropping the prop leaves the DEFAULT affordance row (timestamp + copy) rendering perfectly —
    // which is why the assertion is on the CONSUMER-supplied action, the one thing that cannot
    // appear unless `affordances` actually crossed the seam.
    expect(screen.getByTestId('row-custom-action')).toBeDefined()
  })

  test('affordances’ onRegenerate reaches the last assistant message', () => {
    const regenerated: { id: string | null } = { id: null }
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={threadWith([
            textMessage('fm1', 'user', T0),
            textMessage('fm2', 'assistant', T0 + 60_000),
          ])}
          expanded
          onToggle={() => {}}
          affordances={{
            onRegenerate: (id) => {
              regenerated.id = id
            },
          }}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    screen.getByText('Regenerate').click()

    expect(regenerated.id).toBe('fm2')
  })

  test('liveParts + liveStatus reach the transcript as an in-flight live message', () => {
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={threadWith([textMessage('fm1', 'user', T0)])}
          expanded
          onToggle={() => {}}
          liveParts={[{ id: 'live-p1', type: 'text', text: 'partial reply' }]}
          liveStatus="streaming"
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    // `ThreadTranscript` synthesizes a `__live__` message from `liveParts` only when it actually
    // receives both props — dropping either leaves this testid absent.
    expect(screen.getByTestId('agent-message-__live__')).toBeDefined()
    expect(screen.getByText('partial reply')).toBeDefined()
  })

  test('renderers reaches the transcript — a registered part type renders the consumer renderer', () => {
    const rowRenderers: PartRenderers = definePartRenderers({
      'row-custom': () => <span data-testid="row-custom-part">custom</span>,
    })

    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={threadWith([
            {
              id: 'fm1',
              role: 'assistant',
              parts: [{ id: 'p1', type: 'row-custom' }],
              createdAt: T0,
            },
          ])}
          expanded
          onToggle={() => {}}
          renderers={rowRenderers}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    expect(screen.getByTestId('row-custom-part')).toBeDefined()
  })

  test('fallbackRenderer reaches the transcript for an unregistered foreign part', () => {
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={threadWith([
            {
              id: 'fm1',
              role: 'assistant',
              parts: [{ id: 'p1', type: 'unregistered-foreign-type' }],
              createdAt: T0,
            },
          ])}
          expanded
          onToggle={() => {}}
          fallbackRenderer={rowFallbackRenderer}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    expect(screen.getByTestId('row-fallback-part').textContent).toBe('unregistered-foreign-type')
  })

  test('composerProps reaches the row’s Composer', () => {
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={threadWith([])}
          expanded
          onToggle={() => {}}
          onSend={() => {}}
          composerProps={{ placeholder: 'row-composer-placeholder' }}
        />
      </MantineProvider>,
    )

    expect(screen.getByPlaceholderText('row-composer-placeholder')).toBeDefined()
  })

  test('groupConsecutive={false} reaches the transcript', () => {
    const messages = [
      textMessage('fm1', 'assistant', T0),
      textMessage('fm2', 'assistant', T0 + 60_000),
    ]

    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={threadWith(messages)}
          expanded
          onToggle={() => {}}
          onSend={() => {}}
        />
      </MantineProvider>,
    )
    // Default (`true`, forwarded as `undefined` and defaulted inside the transcript): the second
    // same-role message inside the 5-minute window groups.
    expect(screen.getByTestId('agent-message-fm2').getAttribute('data-grouped')).toBe('true')

    // A fresh mount, not a `rerender` — the first tree is torn down here, so the second render
    // starts from a clean DOM and `getByTestId` can't match the stale row.
    cleanup()
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={threadWith(messages)}
          expanded
          onToggle={() => {}}
          groupConsecutive={false}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    expect(screen.getByTestId('agent-message-fm2').getAttribute('data-grouped')).toBe('false')
  })
})

describe('ThreadFeedRow forwards virtualize/height to the transcript', () => {
  let originalOffsetHeight: PropertyDescriptor | undefined

  beforeEach(() => {
    originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
    // Same reason as thread-message.test.tsx's virtualization block: happy-dom has no layout
    // engine, so an unpatched offsetHeight of 0 makes TanStack Virtual compute an empty viewport.
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 300 })
  })

  afterEach(() => {
    if (originalOffsetHeight !== undefined) {
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight)
    } else {
      delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
    }
  })

  test('an expanded row with virtualize windows its thread instead of rendering every message', async () => {
    const messages = Array.from({ length: 120 }, (_, i) =>
      // 10 minutes apart — never groups, keeping this orthogonal to the grouping seam above.
      textMessage(`vfm${i}`, i % 2 === 0 ? 'user' : 'assistant', T0 + i * 10 * 60_000),
    )

    const { container } = render(
      <MantineProvider>
        <ThreadFeedRow
          thread={threadWith(messages)}
          expanded
          onToggle={() => {}}
          virtualize
          height={300}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    // Deliberately asserts WINDOWING, not which end is anchored. `waitFor` also rides out the
    // lazy `@tanstack/react-virtual` import: until it resolves, the Suspense fallback renders all
    // 120 rows unwindowed — the same count a row that DROPPED `virtualize` would render forever,
    // which is what makes the timeout a real failure rather than a slow pass.
    await waitFor(() => {
      const rendered = container.querySelectorAll('[data-testid^="agent-message-"]').length
      expect(rendered).toBeGreaterThan(0)
      expect(rendered).toBeLessThan(120)
    })
  })
})
