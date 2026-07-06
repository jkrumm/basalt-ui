/**
 * AgentOutcome — the distilled feed projection of a finished AgentThread.
 *
 * A thread's raw transcript (prompt text, reasoning, tool calls) must never render in a
 * multi-thread feed — only a short, past-tense summary of what happened. AgentOutcome is
 * that DIFFERENT, smaller shape: a title, a one-line summary, and a status. Producing one
 * is the job of an OutcomeResolver (typically an LLM-backed summarizer wired by the
 * consumer); heuristicOutcome below is a text-only fallback for demos and early wiring.
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
 * `StreamStatus` (single-turn stream lifecycle, `./use-agent-stream`), `ThreadStatus` (persisted
 * thread lifecycle, `./thread`), and this `AgentOutcome['status']` (feed-facing terminal
 * projection). They are related but not identical — `StreamStatus`'s `'idle'` (no turn in
 * flight) corresponds to `ThreadStatus`'s `'pending'` (thread created, no turn started yet); the
 * literal rename from `'idle'` to `'pending'` is intentionally deferred since it would ripple
 * into `use-agent-stream.ts` and its call sites.
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

// ── heuristicOutcome ──────────────────────────────────────────────────────────

const TITLE_MAX = 48
const SUMMARY_MAX = 88

/** Trim `text` to at most `max` characters, appending an ellipsis when cut. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

/** The leading sentence/clause of `text` (up to the first `.`, `!`, or `?`), trimmed. */
function firstClause(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]?/)
  return (match?.[0] ?? text).trim()
}

/**
 * DEMO-ONLY provisional heuristic — never the production path. Coalesces the last assistant
 * message's text parts into one string and derives a title/summary/status from it with no
 * model call. Real apps should wire an OutcomeResolver backed by an LLM summarizer; this
 * exists purely so a feed has something to render before that wiring lands.
 *
 * @example
 * const outcome = heuristicOutcome(thread)
 * // { title: 'Fixed the flaky test', summary: 'Fixed the flaky test by awaiting…', status: 'done' }
 */
export function heuristicOutcome(thread: AgentThread): AgentOutcome {
  const lastAssistant = thread.messages.toReversed().find((message) => message.role === 'assistant')
  if (lastAssistant === undefined) {
    return { title: 'New chat', summary: '', status: 'done' }
  }

  const text = lastAssistant.parts
    .filter((part): part is Extract<AgentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')
    .trim()

  if (text.length === 0) {
    return { title: 'New chat', summary: '', status: 'done' }
  }

  const lastPart = lastAssistant.parts[lastAssistant.parts.length - 1]
  const status: AgentOutcome['status'] = lastPart?.type === 'error' ? 'error' : 'done'

  return {
    title: truncate(firstClause(text), TITLE_MAX),
    summary: truncate(text, SUMMARY_MAX),
    status,
  }
}
