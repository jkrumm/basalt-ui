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
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { AgentThread, AgentTransport, OutcomeResolver, ThreadsStore } from '../agent'
import { createThreadsStore } from '../agent'
import { ThreadWorkspace } from './thread-workspace'

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
