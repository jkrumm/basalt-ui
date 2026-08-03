/**
 * F3 — the mount-reconcile / unmount-cleanup wedge in useAgentThreadRuns.
 *
 * The bug: the unmount-cleanup effect (`controllersRef.current.forEach(c => c.abort())`) aborted
 * every in-flight controller but never CLEARED the map. The mount-reconcile effect treats a thread
 * as "orphaned" (worth a resume attempt) only when `!controllersRef.current.has(thread.id)`. If
 * this fiber's effects re-run WITHOUT the fiber itself unmounting — React 19 StrictMode's
 * dev-only double-invoke, or a `<Activity>` boundary being hidden then shown again — the stale,
 * now-aborted entry survives into the second reconcile pass, `orphaned` reads `false`, no new
 * resume is attempted, and the one live consumer that WAS attempted already returned silently on
 * its AbortError (`consumeAndFinalize`'s guard at the top of its try block). The thread is left in
 * `'streaming'` forever with nothing left to resolve it.
 *
 * Both halves matter equally here:
 *
 *   (a) REFUTED — a genuine unmount + remount (a fresh component instance, not a re-run of THIS
 *       fiber's effects) gets a brand-new `useRef` Map. There is nothing for the fix to protect
 *       against here; the test exists so nobody "fixes" this non-bug later.
 *   (b) CONFIRMED — React 19 StrictMode's dev-only double-invoke reuses the SAME fiber (and thus
 *       the same ref) across a simulated unmount+remount within one commit.
 *   (c) CONFIRMED — React 19.2's `<Activity>` does the SAME thing in PRODUCTION: hiding an
 *       Activity boundary destroys the subtree's effects and re-creates them on show, while state,
 *       DOM, and ref identity survive. This is the reachable-in-prod half of the wedge, not a
 *       StrictMode-only curiosity — hence testing it directly against `<Activity>` from `react`
 *       rather than only through Mantine's `Collapse`. At the `@mantine/core` 9.3.0 pinned in THIS
 *       repo, `Collapse` has no `keepMounted` DEFAULT — with the prop unset it keeps `children`
 *       permanently mounted (the `else` branch below), so a bare `<Collapse>` cannot wedge and a
 *       default-Collapse-based test would not reproduce the bug. But a consumer writing
 *       `<Collapse keepMounted>` on this SAME 9.3.0 does hit the `<Activity>` path — read
 *       the installed `@mantine/core` 9.3.0 `Collapse.mjs` source directly: it imports
 *       `Activity` from `react` and, when `keepMounted === true`, renders
 *       `jsx(Activity, { mode: isExited ? 'hidden' : 'visible', … })` on the ordinary non-zero-
 *       duration path (only the `duration === 0` fast path carries a `&& env !== 'test'` guard). So
 *       the Activity hazard is live on THIS pinned version, not only on the 9.4.1 argo resolves —
 *       testing `<Activity>` directly is still the right call because it is what a `keepMounted`
 *       consumer actually gets here today, not because 9.3.0 is exempt.
 *
 * Verified manually while writing this file (reported alongside the test suite, not re-asserted
 * here as a runtime check): reverting the one-line `controllersRef.current.clear()` fix makes (b)
 * and (c) fail — the thread's status stays `'streaming'` instead of settling — while (a) passes
 * either way, exactly as the "refutation" framing above expects.
 *
 * Both (b) and (c) observe `resume()` invoked TWICE post-fix (once for the pass that gets aborted,
 * once for the pass that survives), not once — React's whole justification for double-invoking a
 * mount effect with a side effect (a network call here) is to surface exactly this
 * non-idempotence; a spec that anticipated "resume() attempted exactly once" for this scenario
 * does not match observed React 19.2.7 behavior. What's invariant, and what these tests assert, is
 * that the thread SETTLES (leaves `'streaming'`) rather than wedging — the resume() call count is
 * asserted too, but as an observed constant with the doubling explained, not as evidence of a
 * single attempt.
 */
import { describe, expect, test } from 'bun:test'
import { Activity, StrictMode, useState } from 'react'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { useAgentThreadRuns } from './use-agent-thread-runs'
import type { AgentThread, ThreadsStore } from './thread'
import type { AgentTransport } from './transport'
import type { AgentPart } from './parts'
import type { ChatMessage } from './history'
import type { AgentOutcome } from './outcome'

// ── test-only ThreadsStore double ────────────────────────────────────────────
//
// A plain mutable object satisfying the ThreadsStore contract — no React state, no
// localStorage/useSyncExternalStore. useAgentThreadRuns only ever reads `store.threads` and calls
// its action methods synchronously (via `storeRef.current`), so a hand-rolled mutable double gives
// the test full, synchronous, non-persisted control over what a "reload mid-stream" looked like —
// exactly what these mount-reconcile tests need to seed.
function createTestThreadsStore(initial: AgentThread<AgentPart>[] = []): ThreadsStore<AgentPart> {
  let threads = initial
  let activeId: string | null = null
  return {
    get threads() {
      return threads
    },
    get activeId() {
      return activeId
    },
    select(id) {
      activeId = id
    },
    create(opts) {
      const id = crypto.randomUUID()
      const now = Date.now()
      const thread: AgentThread<AgentPart> = {
        id,
        messages: [],
        outcome: null,
        status: 'pending',
        read: false,
        createdAt: now,
        updatedAt: now,
        ...(opts?.meta !== undefined ? { meta: opts.meta } : {}),
      }
      threads = [thread, ...threads]
      return id
    },
    appendMessage(id, message) {
      threads = threads.map((thread) =>
        thread.id === id
          ? { ...thread, messages: [...thread.messages, message], updatedAt: Date.now() }
          : thread,
      )
    },
    setOutcome(id, outcome) {
      threads = threads.map((thread) =>
        thread.id === id ? { ...thread, outcome, updatedAt: Date.now() } : thread,
      )
    },
    setStatus(id, status) {
      threads = threads.map((thread) =>
        thread.id === id ? { ...thread, status, updatedAt: Date.now() } : thread,
      )
    },
    setResumeToken(id, token) {
      threads = threads.map((thread) => {
        if (thread.id !== id) return thread
        const { resumeToken: _resumeToken, ...rest } = thread
        return {
          ...rest,
          ...(token !== undefined ? { resumeToken: token } : {}),
          updatedAt: Date.now(),
        }
      })
    },
    markRead(id) {
      threads = threads.map((thread) => (thread.id === id ? { ...thread, read: true } : thread))
    },
    remove(id) {
      threads = threads.filter((thread) => thread.id !== id)
      if (activeId === id) activeId = null
    },
    clear() {
      threads = []
      activeId = null
    },
  }
}

function makeThread(overrides: Partial<AgentThread<AgentPart>> = {}): AgentThread<AgentPart> {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    messages: [],
    outcome: null,
    status: 'pending',
    read: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const resolveOutcome = (): AgentOutcome => ({ title: 'title', summary: 'summary', status: 'done' })

describe('useAgentThreadRuns — F3 mount-reconcile / unmount-cleanup wedge', () => {
  test('(a) REFUTED: a genuine unmount + remount gets a fresh controllers map — resolves to interrupted, never re-enters streaming', () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    // No `resume` on this transport: on remount, the orphaned thread must fall straight to
    // 'interrupted' with no async wait involved.
    const transport: AgentTransport<AgentPart, string> = {
      // oxlint-disable-next-line require-yield -- hangs until aborted; never has anything to yield
      async *stream(_input, signal) {
        await new Promise((resolve) => {
          signal?.addEventListener('abort', () => resolve(undefined))
        })
      },
    }

    const { result, unmount } = renderHook(() =>
      useAgentThreadRuns({ transport, store, resolveOutcome }),
    )

    act(() => {
      result.current.start(threadId, 'hello')
    })
    expect(store.threads.find((thread) => thread.id === threadId)?.status).toBe('streaming')

    unmount()

    // A brand-new component instance against the SAME store object — a fresh fiber, fresh
    // `useRef` Map. This must hold both before AND after the F3 fix.
    renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }))

    expect(store.threads.find((thread) => thread.id === threadId)?.status).toBe('interrupted')
  })

  test('(b) CONFIRMED: React 19 StrictMode double-invoke resumes the orphaned thread instead of wedging it in streaming', async () => {
    const userMessage: ChatMessage<AgentPart> = {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }],
      createdAt: Date.now(),
    }
    const thread = makeThread({
      status: 'streaming',
      resumeToken: 'resume-token-1',
      messages: [userMessage],
    })
    const store = createTestThreadsStore([thread])

    let resumeCalls = 0
    const transport = {
      async *stream() {},
      async *resume() {
        resumeCalls++
        yield { type: 'text', text: 'resumed' }
      },
      idempotentReplay: true as const,
    }

    renderHook(() => useAgentThreadRuns({ transport, store, resolveOutcome }), {
      wrapper: StrictMode,
    })

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === thread.id)?.status).toBe('done')
    })
    // Observed constant for this scenario (see file doc): the aborted first pass plus the
    // surviving second pass, not "exactly once".
    expect(resumeCalls).toBe(2)
  })

  test('(c) CONFIRMED: an <Activity> hide/show cycle resumes the orphaned thread instead of wedging it in streaming', async () => {
    const userMessage: ChatMessage<AgentPart> = {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }],
      createdAt: Date.now(),
    }
    const thread = makeThread({
      status: 'streaming',
      resumeToken: 'resume-token-2',
      messages: [userMessage],
    })
    const store = createTestThreadsStore([thread])

    // Gates the first resume() attempt so the hide happens strictly before it settles — an
    // explicit happens-before, not a scheduler coincidence a `setTimeout(…, 0)` would only
    // usually win.
    const gate = deferred<void>()

    let resumeCalls = 0
    const transport = {
      async *stream() {},
      async *resume() {
        resumeCalls++
        await gate.promise
        yield { type: 'text', text: 'resumed' }
      },
      idempotentReplay: true as const,
    }

    let externalSetMode: ((mode: 'visible' | 'hidden') => void) | undefined

    function Probe(): null {
      useAgentThreadRuns({ transport, store, resolveOutcome })
      return null
    }

    function Harness(): JSX.Element {
      const [mode, setMode] = useState<'visible' | 'hidden'>('visible')
      externalSetMode = setMode
      return (
        <Activity mode={mode}>
          <Probe />
        </Activity>
      )
    }

    await act(async () => {
      render(<Harness />)
    })

    // First resume attempt is in flight (its gate hasn't been released yet) — hide now to abort
    // it via the F3-fixed cleanup effect. `gate.resolve()` only runs after this completes, so the
    // hide is guaranteed to land before the first attempt could ever settle.
    await act(async () => {
      externalSetMode?.('hidden')
    })
    gate.resolve()
    await act(async () => {
      externalSetMode?.('visible')
    })

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === thread.id)?.status).toBe('done')
    })
    expect(resumeCalls).toBe(2)
  })
})
