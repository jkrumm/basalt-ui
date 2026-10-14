/**
 * AgentOutcome — the distilled feed projection of a finished AgentThread.
 *
 * A thread's raw transcript (prompt text, reasoning, tool calls) must never render in a
 * multi-thread feed — only a short, past-tense summary of what happened. AgentOutcome is
 * that DIFFERENT, smaller shape: a title, a one-line summary, and a status. Producing one
 * is the job of an OutcomeResolver (typically an LLM-backed summarizer wired by the
 * consumer).
 *
 * @example
 * import type { AgentOutcome } from 'basalt-ui/agent'
 *
 * const outcome: AgentOutcome = {
 *   title: 'Refactor auth middleware',
 *   summary: 'Extracted the token check into a shared guard and added tests.',
 *   status: 'done',
 * }
 */
import type { AgentPart } from './parts'
import type { AgentThread } from './thread'

// ── AgentOutcome ──────────────────────────────────────────────────────────────

/**
 * A distilled outcome for one thread — what shows in a multi-thread feed. `title` is the
 * subject/intent (capped ~48 chars); `summary` is a concrete, past-tense description of what
 * happened (capped ~88 chars); `status` drives the feed's visual treatment.
 *
 * `status` is the TERMINAL subset of `ThreadStatus` (see `./thread`): only the three outcomes a
 * finished turn can resolve to. It deliberately excludes `ThreadStatus`'s in-flight/unresolved
 * members (`'pending'`, `'streaming'`, `'interrupted'`) — an `AgentOutcome` only exists once a
 * turn has settled, so those never apply here.
 *
 * Note there are THREE overlapping status-shaped unions in this module family, one per layer:
 * the internal `StreamStatus` (single-turn stream lifecycle, `./thread`), `ThreadStatus` (persisted
 * thread lifecycle, `./thread`), and this `AgentOutcome['status']` (feed-facing terminal
 * projection). They are related but not identical — `StreamStatus`'s `'idle'` (no turn in
 * flight) corresponds to `ThreadStatus`'s `'pending'` (thread created, no turn started yet); the
 * literal rename from `'idle'` to `'pending'` is intentionally deferred since it would ripple
 * into `useAgentThreadRuns` and its call sites.
 *
 * @example
 * const outcome: AgentOutcome = { title: 'New chat', summary: '', status: 'done' }
 */
export type AgentOutcome = {
  readonly title: string
  readonly summary: string
  readonly status: 'done' | 'attention' | 'error'
}

// ── OutcomeResolver ───────────────────────────────────────────────────────────

/**
 * A function that distills a finished (or in-flight) AgentThread into an AgentOutcome for
 * the feed. Consumers typically wire this to an LLM call that reads the transcript and
 * returns a short subject + summary — hence the Promise return, so a resolver can await a
 * network call.
 *
 * @example
 * const resolveOutcome: OutcomeResolver = async (thread) => {
 *   const summary = await summarizeTranscript(thread.messages)
 *   return { title: summary.title, summary: summary.body, status: 'done' }
 * }
 */
export type OutcomeResolver<TPart = AgentPart> = (
  thread: AgentThread<TPart>,
) => AgentOutcome | Promise<AgentOutcome>
