/**
 * thread-scenarios — mock transport + outcome resolver backing the /threads demo.
 *
 * Reuses `AGENT_SCENARIOS` / `scenarioTransport` from the single-thread agent demo so the
 * multi-thread workspace exercises the same lifecycle variety (reasoning, tool calls, cited
 * sources, mid-stream error) without a second mock backend. `mockThreadTransport` rotates
 * through the scenarios deterministically, one per new prompt; `mockOutcomeResolver` distills
 * each finished thread into a feed-ready `AgentOutcome` from its first user message.
 *
 * In a real app both are replaced: the transport by `edenTransport(...)`, the resolver by an
 * LLM-backed summarizer (or `heuristicOutcome` as a lighter fallback).
 */
import type {
  AgentOutcome,
  AgentPart,
  AgentThread,
  AgentTransport,
  OutcomeResolver,
} from 'basalt-ui/agent'
import { AGENT_SCENARIOS, scenarioTransport } from '../agent-scenarios'

// ── mockThreadTransport ─────────────────────────────────────────────────────────

// Advances on every stream() call so consecutive prompts (across any thread) cycle through the
// answer / tools / reasoning / error scenarios in a fixed, deterministic order.
let scenarioCursor = 0

/** Rotates through `AGENT_SCENARIOS` per new prompt so different threads exercise the full mix. */
export const mockThreadTransport: AgentTransport<AgentPart, string> = {
  stream(input: string, signal?: AbortSignal): AsyncGenerator<AgentPart> {
    const scenario = AGENT_SCENARIOS[scenarioCursor % AGENT_SCENARIOS.length]
    scenarioCursor += 1
    if (scenario === undefined) throw new Error('AGENT_SCENARIOS is empty')
    return scenarioTransport(scenario, 'normal').stream(input, signal)
  },
}

// ── mockOutcomeResolver ──────────────────────────────────────────────────────────

const TITLE_MAX = 48
const SUMMARY_MAX = 88

/** Trim `text` to at most `max` characters, appending an ellipsis when cut. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

/** Uppercase the first character; leaves the rest untouched. */
function capitalize(text: string): string {
  if (text.length === 0) return text
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

/** Joins a message's text parts into one string. */
function textOf(parts: AgentPart[]): string {
  return parts
    .filter((part): part is Extract<AgentPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')
    .trim()
}

/** The thread's opening prompt, or '' when no user message has landed yet. */
function firstPrompt(thread: AgentThread): string {
  const firstUser = thread.messages.find((message) => message.role === 'user')
  return firstUser === undefined ? '' : textOf(firstUser.parts)
}

/**
 * Deterministic status rotation — no `Math.random`. An explicit in-thread error part always wins;
 * otherwise every 3rd thread (by settled message count) needs a second look, so the feed always
 * has at least one `attention` example alongside the steady stream of `done` outcomes.
 */
function deriveStatus(thread: AgentThread): AgentOutcome['status'] {
  const lastAssistant = thread.messages.toReversed().find((message) => message.role === 'assistant')
  const hasError = lastAssistant?.parts.some((part) => part.type === 'error') ?? false
  if (hasError) return 'error'
  return thread.messages.length % 3 === 0 ? 'attention' : 'done'
}

/** The thread's most recent assistant message parts, or [] when none has landed. */
function lastAssistantParts(thread: AgentThread): AgentPart[] {
  const lastAssistant = thread.messages.toReversed().find((message) => message.role === 'assistant')
  return lastAssistant === undefined ? [] : lastAssistant.parts
}

/**
 * A clean, past-tense outcome line keyed to WHAT the assistant did — deliberately not the prompt
 * echoed back, so the card's title (the intent) and summary (the outcome) carry different signal.
 */
function summarize(parts: AgentPart[]): string {
  if (parts.some((part) => part.type === 'tool')) {
    return 'Checked the available tools and outlined the options.'
  }
  if (parts.some((part) => part.type === 'reasoning')) {
    return 'Weighed the trade-offs and recommended an approach.'
  }
  if (parts.some((part) => part.type === 'source')) {
    return 'Gathered a few sources and answered.'
  }
  return 'Answered with a short explanation and examples.'
}

/**
 * Distills a thread into a feed card: the title names the intent (the opening prompt); the summary
 * is a clean past-tense outcome keyed to what the assistant did — the shape a real LLM-backed
 * resolver would return, without echoing the prompt back.
 */
export const mockOutcomeResolver: OutcomeResolver = (thread) => {
  const prompt = firstPrompt(thread)
  if (prompt.length === 0) {
    return { title: 'New chat', summary: 'Started a new conversation.', status: 'done' }
  }
  return {
    title: truncate(capitalize(prompt), TITLE_MAX),
    summary: truncate(summarize(lastAssistantParts(thread)), SUMMARY_MAX),
    status: deriveStatus(thread),
  }
}
