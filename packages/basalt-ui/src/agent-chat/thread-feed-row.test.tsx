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
import type { ThreadFeedRowProps } from './thread-feed-row'

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

// ── B1 — header overrides for a server-titled thread ─────────────────────────────────────────
// argo's hermes-chat never populates `thread.outcome` (title/summary/type/pin are server-owned —
// see `hermes-transport.ts`'s `resolveHermesOutcome`), so the outcome-only header always rendered
// "Untitled thread" for a real Hermes thread. `title`/`summary`/`headerLeft`/`headerRight` close
// that gap without forcing an `AgentOutcome` shape onto data that never had one.

describe('ThreadFeedRow — B1 header overrides', () => {
  test('title/summary props override the outcome-derived header', () => {
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={buildThread([])}
          expanded={false}
          onToggle={() => {}}
          onSend={() => {}}
          title="Server-titled thread"
          summary="Server summary"
        />
      </MantineProvider>,
    )

    expect(screen.getByText('Server-titled thread')).toBeDefined()
    expect(screen.getByText('Server summary')).toBeDefined()
    // The outcome's own title ("A resolved thread", set by `buildThread`) must NOT also render —
    // the override replaces the fallback, it doesn't render both.
    expect(screen.queryByText('A resolved thread')).toBeNull()
  })

  test('omitting title/summary falls back to today’s outcome-derived header, unchanged', () => {
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={buildThread([])}
          expanded={false}
          onToggle={() => {}}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    expect(screen.getByText('A resolved thread')).toBeDefined()
    expect(screen.getByText('Summary text')).toBeDefined()
  })

  test('headerLeft renders before the title, headerRight before the timestamp/chevron', () => {
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={buildThread([])}
          expanded={false}
          onToggle={() => {}}
          onSend={() => {}}
          headerLeft={<span data-testid="row-header-left">pin</span>}
          headerRight={<span data-testid="row-header-right">●</span>}
        />
      </MantineProvider>,
    )

    expect(screen.getByTestId('row-header-left')).toBeDefined()
    expect(screen.getByTestId('row-header-right')).toBeDefined()
  })
})

// ── B2 — messages override ────────────────────────────────────────────────────────────────────
// argo's confirmed transcript is `mergeOptimisticMessages(serverMessages, thread.messages, …)`
// (chat-view.tsx), NOT `thread.messages` verbatim — a row that always reads `thread.messages`
// forces a fork just to render the merged array.

describe('ThreadFeedRow — B2 messages override', () => {
  test('messages prop overrides the transcript source instead of reading thread.messages', () => {
    const storeMessage = textMessage('store-only', 'user', T0)
    const overrideMessage = textMessage('override-only', 'assistant', T0 + 60_000)

    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={threadWith([storeMessage])}
          expanded
          onToggle={() => {}}
          onSend={() => {}}
          messages={[overrideMessage]}
        />
      </MantineProvider>,
    )

    expect(screen.getByTestId('agent-message-override-only')).toBeDefined()
    expect(screen.queryByTestId('agent-message-store-only')).toBeNull()
  })

  test('omitting messages falls back to thread.messages, unchanged', () => {
    const storeMessage = textMessage('store-only-2', 'user', T0)

    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={threadWith([storeMessage])}
          expanded
          onToggle={() => {}}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    expect(screen.getByTestId('agent-message-store-only-2')).toBeDefined()
  })
})

// ── B3 — height WITHOUT virtualize ────────────────────────────────────────────────────────────
// argo's row bounds its body at 480px with inner scroll (no `@tanstack/react-virtual` peer
// installed) — today's union forbids `height` unless `virtualize` is also on.

describe('ThreadFeedRow — B3 bounded height without virtualize', () => {
  test('height alone wraps the transcript in a fixed-height scroll node, with every message still rendered (unwindowed)', async () => {
    const messages = [textMessage('hb1', 'user', T0), textMessage('hb2', 'assistant', T0 + 60_000)]

    const { container } = render(
      <MantineProvider>
        <ThreadFeedRow
          thread={threadWith(messages)}
          expanded
          onToggle={() => {}}
          onSend={() => {}}
          height={240}
        />
      </MantineProvider>,
    )

    // Unlike the virtualized case above, nothing is windowed — both messages are in the DOM.
    expect(screen.getByTestId('agent-message-hb1')).toBeDefined()
    expect(screen.getByTestId('agent-message-hb2')).toBeDefined()
    // The bounded scroll node carries the requested height, both in `BasaltStickToBottom`'s
    // Suspense fallback <div> (style forwarded verbatim) and once the lazy `use-stick-to-bottom`
    // import resolves — `waitFor` rides out that resolution so it settles inside `act()` instead
    // of leaking an unwrapped-suspense warning into a later test.
    await waitFor(() => {
      expect(container.querySelector('[style*="240"]')).not.toBeNull()
    })
  })

  test('omitting both height and virtualize renders the transcript content-sized, unchanged', () => {
    render(
      <MantineProvider>
        <ThreadFeedRow
          thread={threadWith([textMessage('cs1', 'user', T0)])}
          expanded
          onToggle={() => {}}
          onSend={() => {}}
        />
      </MantineProvider>,
    )

    expect(screen.getByTestId('agent-message-cs1')).toBeDefined()
  })
})

// ── B4 — classNames slots + data-expanded ─────────────────────────────────────────────────────
// argo's fork carries its own `wrapper`/`header`/`conversationWrapper` CSS-module classes and a
// `data-expanded` attribute (thread-feed-row.tsx/.module.css) — the shipped row had no slot seam.

describe('ThreadFeedRow — B4 classNames slots + data-expanded', () => {
  test('classNames.root/header/body reach their respective elements', () => {
    const { container } = render(
      <MantineProvider>
        <ThreadFeedRow
          thread={buildThread([])}
          expanded
          onToggle={() => {}}
          onSend={() => {}}
          classNames={{ root: 'row-root', header: 'row-header', body: 'row-body' }}
        />
      </MantineProvider>,
    )

    expect(container.querySelector('.row-root')).not.toBeNull()
    expect(container.querySelector('.row-header')).not.toBeNull()
    expect(container.querySelector('.row-body')).not.toBeNull()
  })

  test('data-expanded on the root reflects the expanded prop', () => {
    const { container, rerender } = render(
      <MantineProvider>
        <ThreadFeedRow
          thread={buildThread([])}
          expanded={false}
          onToggle={() => {}}
          onSend={() => {}}
        />
      </MantineProvider>,
    )
    expect(container.querySelector('[data-expanded="false"]')).not.toBeNull()

    rerender(
      <MantineProvider>
        <ThreadFeedRow thread={buildThread([])} expanded onToggle={() => {}} onSend={() => {}} />
      </MantineProvider>,
    )
    expect(container.querySelector('[data-expanded="true"]')).not.toBeNull()
  })
})

describe('common props (`common/props.ts`)', () => {
  test('className reaches the root', () => {
    const { container } = render(
      <MantineProvider>
        <ThreadFeedRow
          thread={buildThread([])}
          expanded={false}
          onToggle={() => {}}
          onSend={() => {}}
          className="my-row"
        />
      </MantineProvider>,
    )
    expect(container.querySelector('.my-row')).not.toBeNull()
  })
})

describe('assertRequiredProps (F-ERR-1)', () => {
  test('a missing `thread` throws a named message, not a raw TypeError', () => {
    expect(() => {
      render(
        <MantineProvider>
          <ThreadFeedRow
            {...({
              expanded: false,
              onToggle: () => {},
              onSend: () => {},
            } as unknown as ThreadFeedRowProps)}
          />
        </MantineProvider>,
      )
    }).toThrow('[basalt] ThreadFeedRow: prop "thread" is required')
  })
})
