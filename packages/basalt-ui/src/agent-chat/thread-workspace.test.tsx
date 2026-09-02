/**
 * ThreadWorkspace — hydration gating (D1).
 *
 * A store built with `createAdapterThreadsStore` starts `!hydrated` until its first `listThreads`
 * succeeds. Before this fix, `ThreadWorkspace` read only `threads.length` to decide between the
 * feed and the empty state, so a server-backed store with real threads (a database, a real API)
 * would render "no threads yet" for the whole initial round trip, then swap to the populated feed
 * once it landed — a defect invisible in the playground's demo only because that demo's in-memory
 * adapter seeds an empty Map, so there is nothing to flash to.
 *
 * These tests drive `ThreadWorkspace` directly against a hand-built `ThreadsStore` (not a real
 * `createAdapterThreadsStore` instance) so each case can assert one exact `{ hydrated, threads }`
 * combination without racing a real async adapter.
 */
import { DEFAULT_THEME, MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { AgentThread, AgentTransport, OutcomeResolver, ThreadsStore } from '../agent'
import { createThreadsStore } from '../agent'
import { ThreadDetailPanel } from './thread-detail-panel'
import { ThreadWorkspace } from './thread-workspace'
import type { ThreadWorkspaceProps } from './thread-workspace'

afterEach(cleanup)

// `useMediaQuery` reads `window.matchMedia` inside a mount effect RTL flushes synchronously —
// force the wide-viewport branch so every case renders the feed pane (same idiom as
// thread-feed.test.tsx's `withReducedMotion`).
function withWideViewport<T>(fn: () => T): T {
  const original = window.matchMedia
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
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

function noop(): void {}

/** A transport that never resolves — no case here calls `start()`, so `stream` is never invoked. */
const stubTransport: AgentTransport<never, string> = {
  stream: (): AsyncGenerator<never> => {
    throw new Error('stubTransport.stream must not be called by these tests')
  },
}

const stubResolveOutcome: OutcomeResolver = async (thread) => ({
  title: thread.id,
  summary: '',
  status: 'done',
})

function buildThread(id: string): AgentThread {
  return {
    id,
    messages: [],
    outcome: { title: id, summary: '', status: 'done' },
    status: 'done',
    read: true,
    createdAt: 0,
    updatedAt: 0,
  }
}

/** A minimal fixed `ThreadsStore` — every mutator is a no-op since no case here calls one. */
function makeStore(overrides: Partial<ThreadsStore>): ThreadsStore {
  return {
    threads: [],
    activeId: null,
    hydrated: true,
    error: undefined,
    select: noop,
    create: () => 'unused',
    appendMessage: noop,
    setOutcome: noop,
    setStatus: noop,
    setResumeToken: noop,
    markRead: noop,
    remove: noop,
    clear: noop,
    ...overrides,
  }
}

function renderWorkspace(store: ThreadsStore): ReactElement {
  return (
    <MantineProvider>
      <ThreadWorkspace
        useThreads={() => store}
        transport={stubTransport}
        resolveOutcome={stubResolveOutcome}
      />
    </MantineProvider>
  )
}

describe('ThreadWorkspace hydration gating', () => {
  test('hydrating + empty: renders the hydrating hold, never the empty-state copy', () => {
    withWideViewport(() => {
      render(renderWorkspace(makeStore({ hydrated: false, threads: [] })))
    })

    expect(screen.getByTestId('thread-workspace-hydrating')).toBeDefined()
    expect(screen.queryByText('No threads yet')).toBeNull()
  })

  test('hydrating + already-populated: renders the feed content, not the hydrating hold', () => {
    withWideViewport(() => {
      render(renderWorkspace(makeStore({ hydrated: false, threads: [buildThread('cached-1')] })))
    })

    expect(screen.getByText('cached-1')).toBeDefined()
    expect(screen.queryByTestId('thread-workspace-hydrating')).toBeNull()
  })

  test('failed load: renders the error state, never the hydrating hold', () => {
    withWideViewport(() => {
      render(
        renderWorkspace(
          makeStore({ hydrated: false, error: new Error('listThreads failed'), threads: [] }),
        ),
      )
    })

    expect(screen.getByTestId('thread-workspace-error')).toBeDefined()
    expect(screen.queryByTestId('thread-workspace-hydrating')).toBeNull()
  })

  test('hydrated + empty: renders the empty state (no threads really is the truth)', () => {
    withWideViewport(() => {
      render(renderWorkspace(makeStore({ hydrated: true, threads: [] })))
    })

    expect(screen.getByText('No threads yet')).toBeDefined()
    expect(screen.queryByTestId('thread-workspace-hydrating')).toBeNull()
  })

  test('real synchronous createThreadsStore: never shows the hydrating hold, even on first render', () => {
    // The real localStorage-backed store (hydrated pinned `true` — see thread.test.ts), not the
    // hand-built stub above, so this proves the gate reads a genuine ThreadsStore correctly and
    // does not regress the synchronous path with a permanent skeleton.
    const useThreads = createThreadsStore({ key: 'thread-workspace-sync-empty', version: 1 })

    withWideViewport(() => {
      render(
        <MantineProvider>
          <ThreadWorkspace
            useThreads={useThreads}
            transport={stubTransport}
            resolveOutcome={stubResolveOutcome}
          />
        </MantineProvider>,
      )
    })

    expect(screen.getByText('No threads yet')).toBeDefined()
    expect(screen.queryByTestId('thread-workspace-hydrating')).toBeNull()
  })
})

describe('common props (`common/props.ts`)', () => {
  test('className reaches the wide-layout root; classNames.feed reaches the feed pane', () => {
    const { container } = withWideViewport(() =>
      render(
        <MantineProvider>
          <ThreadWorkspace
            useThreads={() => makeStore({ hydrated: true, threads: [] })}
            transport={stubTransport}
            resolveOutcome={stubResolveOutcome}
            className="my-workspace"
            classNames={{ feed: 'my-feed-pane' }}
          />
        </MantineProvider>,
      ),
    )
    expect(container.querySelector('.my-workspace')).not.toBeNull()
    expect(container.querySelector('.my-feed-pane')).not.toBeNull()
  })

  test('ThreadDetailPanel: className reaches the empty-state root', () => {
    const { container } = render(
      <MantineProvider>
        <ThreadDetailPanel
          thread={null}
          onSend={noop}
          onStop={noop}
          onClose={noop}
          className="my-detail-panel"
        />
      </MantineProvider>,
    )
    expect(container.querySelector('.my-detail-panel')).not.toBeNull()
  })
})

describe('assertRequiredProps (F-ERR-1)', () => {
  test('a missing `useThreads` throws a named message, not a raw TypeError', () => {
    expect(() => {
      render(
        <MantineProvider>
          <ThreadWorkspace
            {...({
              transport: stubTransport,
              resolveOutcome: stubResolveOutcome,
            } as unknown as ThreadWorkspaceProps)}
          />
        </MantineProvider>,
      )
    }).toThrow('[basalt] ThreadWorkspace: prop "useThreads" is required')
  })
})

describe('the narrow breakpoint (shell/page-aside.tsx parity)', () => {
  test('is derived from theme.breakpoints.sm, not a hardcoded pixel value', () => {
    const recordedQueries: string[] = []
    const original = window.matchMedia
    window.matchMedia = (query: string): MediaQueryList => {
      recordedQueries.push(query)
      return {
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as MediaQueryList
    }
    try {
      render(
        <MantineProvider>
          <ThreadWorkspace
            useThreads={() => makeStore({ hydrated: true, threads: [] })}
            transport={stubTransport}
            resolveOutcome={stubResolveOutcome}
          />
        </MantineProvider>,
      )
    } finally {
      window.matchMedia = original
    }
    expect(recordedQueries).toContain(
      `(max-width: calc(${DEFAULT_THEME.breakpoints.sm} - 0.00625em))`,
    )
  })
})
