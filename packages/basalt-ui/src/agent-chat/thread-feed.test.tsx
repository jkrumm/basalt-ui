/**
 * ThreadFeed — `variant`/`renderRow` (AGENT-CHAT-SPEC.md §12, additive to the existing
 * `ThreadOutcomeCard` inbox behaviour). Covers both the reduced-motion and the animated
 * (`AnimatePresence`) render branches, since `variant`/`renderRow` have to work identically in
 * both — see `thread-feed.tsx`'s module doc for why that split exists in the first place.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { useState } from 'react'
import type { AgentThread } from '../agent'
import type { ComposerSubmit } from './composer'
import { ThreadFeed } from './thread-feed'
import type { ThreadFeedProps } from './thread-feed'
import { ThreadOutcomeCard } from './thread-outcome-card'
import type { ThreadOutcomeCardProps } from './thread-outcome-card'

afterEach(cleanup)

function buildThreads(): AgentThread[] {
  return [
    {
      id: 't1',
      messages: [],
      outcome: { title: 'First thread', summary: 'Summary one', status: 'done' },
      status: 'done',
      read: true,
      createdAt: 0,
      updatedAt: 0,
    },
  ]
}

/** Temporarily forces `useReducedMotion()`'s result for the duration of `fn` — `@mantine/hooks`'
 * `useMediaQuery` reads `window.matchMedia(query).matches` inside its mount effect, which RTL's
 * `render` flushes synchronously (wrapped in `act`) before returning. See `use-media-query.mjs`. */
function withReducedMotion<T>(matches: boolean, fn: () => T): T {
  const original = window.matchMedia
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
  try {
    return fn()
  } finally {
    window.matchMedia = original
  }
}

function renderFeed(ui: ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

describe.each([
  ['animated', false],
  ['reduced motion', true],
])('ThreadFeed row selection (%s)', (_label, reducedMotion) => {
  test('variant "outcome" (default) renders ThreadOutcomeCard unchanged', () => {
    withReducedMotion(reducedMotion, () => {
      renderFeed(<ThreadFeed threads={buildThreads()} activeId={null} onSelect={() => {}} />)
    })

    expect(screen.getByText('First thread')).toBeDefined()
    expect(screen.getByText('Summary one')).toBeDefined()
  })

  test('variant "inline" renders ThreadFeedRow instead of ThreadOutcomeCard', () => {
    withReducedMotion(reducedMotion, () => {
      renderFeed(
        <ThreadFeed
          threads={buildThreads()}
          activeId={null}
          onSelect={() => {}}
          variant="inline"
        />,
      )
    })

    // ThreadFeedRow renders the same title text, but as a toggle button (role=button) rather than
    // ThreadOutcomeCard's selectable row — the observable difference between the two variants.
    expect(screen.getByText('First thread')).toBeDefined()
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false')
  })

  test('renderRow overrides BOTH variants', () => {
    withReducedMotion(reducedMotion, () => {
      renderFeed(
        <ThreadFeed
          threads={buildThreads()}
          activeId={null}
          onSelect={() => {}}
          renderRow={(thread) => <div data-testid={`custom-${thread.id}`}>{thread.id}</div>}
        />,
      )
    })

    expect(screen.getByTestId('custom-t1')).toBeDefined()
    // The default outcome-card content must NOT have rendered instead.
    expect(screen.queryByText('First thread')).toBeNull()
  })

  test('renderRow overrides the "inline" variant too', () => {
    withReducedMotion(reducedMotion, () => {
      renderFeed(
        <ThreadFeed
          threads={buildThreads()}
          activeId={null}
          onSelect={() => {}}
          variant="inline"
          renderRow={(thread) => <div data-testid={`custom-${thread.id}`}>{thread.id}</div>}
        />,
      )
    })

    expect(screen.getByTestId('custom-t1')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })
})

// ── The inline row's own collapse tracking ───────────────────────────────────────────────────
// Wiring `onToggle={onSelect}` directly (the previous shape) meant a plain, natural
// `onSelect={setActiveId}` consumer could never collapse a row: re-selecting the same id twice is
// a no-op state update, so `aria-expanded` got stuck at `true` forever. These use exactly that
// natural, non-toggling setter — the trap case — to prove the fix without leaning on a consumer
// that already special-cases re-selection.

/** A minimal natural consumer: a plain `useState` setter passed straight through as `onSelect`,
 * the exact shape the previous wiring broke. */
function NaiveSingleSelectFeed({ threads }: { threads: AgentThread[] }): ReactElement {
  const [activeId, setActiveId] = useState<string | null>(null)
  return (
    <ThreadFeed threads={threads} activeId={activeId} onSelect={setActiveId} variant="inline" />
  )
}

describe('ThreadFeed inline variant — collapse decoupled from onSelect', () => {
  test('clicking an unselected row expands it and reports the selection', () => {
    render(
      <MantineProvider>
        <NaiveSingleSelectFeed threads={buildThreads()} />
      </MantineProvider>,
    )

    const header = screen.getByRole('button')
    expect(header.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(header)

    expect(header.getAttribute('aria-expanded')).toBe('true')
  })

  test('clicking the already-selected row collapses it — the defect this fix targets', () => {
    render(
      <MantineProvider>
        <NaiveSingleSelectFeed threads={buildThreads()} />
      </MantineProvider>,
    )

    const header = screen.getByRole('button')
    fireEvent.click(header)
    expect(header.getAttribute('aria-expanded')).toBe('true')

    // The second click, on the SAME row, with a naive `setActiveId` that turns this into a no-op
    // state update — this is exactly the click the previous `onToggle={onSelect}` wiring couldn't
    // collapse from.
    fireEvent.click(header)

    expect(header.getAttribute('aria-expanded')).toBe('false')
  })

  test('re-clicking after a collapse re-expands the same row', () => {
    render(
      <MantineProvider>
        <NaiveSingleSelectFeed threads={buildThreads()} />
      </MantineProvider>,
    )

    const header = screen.getByRole('button')
    fireEvent.click(header) // expand
    fireEvent.click(header) // collapse
    fireEvent.click(header) // expand again

    expect(header.getAttribute('aria-expanded')).toBe('true')
  })
})

// ── The built-in inline row's composer: real send channel vs. visibly inert ─────────────────
// `variant='inline'` used to wire the row's composer to a hardcoded no-op — a live, enabled
// textarea + Send button that silently discarded whatever was typed into it. These assert both
// halves of the fix: `onSend` makes it actually work, and omitting `onSend` renders the composer
// disabled instead of a live dead end.

describe('ThreadFeed inline variant — composer send channel', () => {
  test('onSend is called with the thread and the composer payload on submit', () => {
    const sent: { thread: AgentThread | null; payload: ComposerSubmit | null } = {
      thread: null,
      payload: null,
    }
    const threads = buildThreads()

    render(
      <MantineProvider>
        <ThreadFeed
          threads={threads}
          activeId="t1"
          onSelect={() => {}}
          variant="inline"
          onSend={(thread, payload) => {
            sent.thread = thread
            sent.payload = payload
          }}
        />
      </MantineProvider>,
    )

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.disabled).toBe(false)

    fireEvent.change(textarea, { target: { value: 'hello there' } })
    fireEvent.click(screen.getByLabelText('Send message'))

    expect(sent.thread?.id).toBe('t1')
    expect(sent.payload?.text).toBe('hello there')
  })

  test('without onSend, the composer renders disabled rather than a live no-op', () => {
    render(
      <MantineProvider>
        <ThreadFeed threads={buildThreads()} activeId="t1" onSelect={() => {}} variant="inline" />
      </MantineProvider>,
    )

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.disabled).toBe(true)
  })
})

describe('common props (`common/props.ts`)', () => {
  test('className reaches the ThreadFeed root', () => {
    const { container } = renderFeed(
      <ThreadFeed
        threads={buildThreads()}
        activeId={null}
        onSelect={() => {}}
        className="my-feed"
      />,
    )
    expect(container.querySelector('.my-feed')).not.toBeNull()
  })

  test('className reaches the ThreadOutcomeCard root', () => {
    const thread = buildThreads()[0]
    if (thread === undefined) throw new Error('expected a thread')
    const { container } = renderFeed(
      <ThreadOutcomeCard
        thread={thread}
        selected={false}
        onSelect={() => {}}
        className="my-outcome-card"
      />,
    )
    expect(container.querySelector('.my-outcome-card')).not.toBeNull()
  })
})

describe('assertRequiredProps (F-ERR-1)', () => {
  test('ThreadFeed: a missing `threads` throws a named message, not a raw TypeError', () => {
    expect(() => {
      renderFeed(
        <ThreadFeed {...({ activeId: null, onSelect: () => {} } as unknown as ThreadFeedProps)} />,
      )
    }).toThrow('[basalt] ThreadFeed: prop "threads" is required')
  })

  test('ThreadOutcomeCard: a missing `thread` throws a named message, not a raw TypeError', () => {
    expect(() => {
      renderFeed(
        <ThreadOutcomeCard
          {...({ selected: false, onSelect: () => {} } as unknown as ThreadOutcomeCardProps)}
        />,
      )
    }).toThrow('[basalt] ThreadOutcomeCard: prop "thread" is required')
  })
})
