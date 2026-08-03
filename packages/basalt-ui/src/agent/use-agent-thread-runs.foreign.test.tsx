/**
 * useAgentThreadRuns — foreign-part round trip (B2 convergence fix).
 *
 * The open part registry (./foreign) only serves its headline purpose — a transport streaming an
 * app-specific part type (`data-toolProgress`, `data-chart`, …) reaching `ThreadTranscript` — if a
 * ForeignPart can flow all the way through this hook's mergePart accumulator: transport →
 * consumeAndFinalize → runs.get(id).parts → the persisted assistant ChatMessage. This file proves
 * that path end to end with `useAgentThreadRuns<TranscriptPart>`, which was a tsc error before
 * mergePart's constraint was widened from `AgentPart` to the structural `PartLike`.
 */
import { describe, expect, test } from 'bun:test'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useAgentThreadRuns } from './use-agent-thread-runs'
import type { AgentThread, ThreadsStore } from './thread'
import type { AgentTransport } from './transport'
import type { TranscriptPart } from './foreign'
import type { AgentOutcome, OutcomeResolver } from './outcome'

// ── test-only ThreadsStore double, typed over TranscriptPart ─────────────────────────────────────
function createTestThreadsStore(): ThreadsStore<TranscriptPart> {
  let threads: AgentThread<TranscriptPart>[] = []
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
    create(createOpts) {
      const id = crypto.randomUUID()
      const now = Date.now()
      const thread: AgentThread<TranscriptPart> = {
        id,
        messages: [],
        outcome: null,
        status: 'pending',
        read: false,
        createdAt: now,
        updatedAt: now,
        ...(createOpts?.meta !== undefined ? { meta: createOpts.meta } : {}),
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
    // Always-hydrated, never-erroring — mirrors the localStorage-backed store's real values
    // (see ThreadsStore.hydrated/.error doc comments); this double is a synchronous in-memory
    // stand-in with no async load path to fail.
    hydrated: true,
    error: undefined,
  }
}

const resolveOutcome: OutcomeResolver<TranscriptPart> = (): AgentOutcome => ({
  title: 'title',
  summary: 'summary',
  status: 'done',
})

describe('useAgentThreadRuns<TranscriptPart> — foreign part round trip', () => {
  test('a foreign part survives accumulation and a replay replaces rather than duplicates', async () => {
    const store = createTestThreadsStore()
    const threadId = store.create()

    const transport: AgentTransport<TranscriptPart, string> = {
      async *stream() {
        yield { id: 'progress-1', type: 'data-toolProgress', message: 'searching' }
        // Same id, second delta — must REPLACE the first entry, not duplicate it.
        yield { id: 'progress-1', type: 'data-toolProgress', message: 'done' }
        yield { id: 'text-1', type: 'text', text: 'Found it.' }
      },
    }

    const { result } = renderHook(() =>
      useAgentThreadRuns<TranscriptPart>({ transport, store, resolveOutcome }),
    )

    act(() => {
      result.current.start(threadId, 'go find it')
    })

    await waitFor(() => {
      expect(store.threads.find((t) => t.id === threadId)?.status).toBe('done')
    })

    const assistantMessage = store.threads
      .find((t) => t.id === threadId)
      ?.messages.find((m) => m.role === 'assistant')

    expect(assistantMessage?.parts).toEqual([
      { id: 'progress-1', type: 'data-toolProgress', message: 'done' },
      { id: 'text-1', type: 'text', text: 'Found it.' },
    ])
  })
})
