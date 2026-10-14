/**
 * basalt-ui/agent — the AI chat surface: a Mantine-free streaming runtime (`src/agent/**` outside
 * `chat/`) plus the chat UI (`src/agent/chat/**`). `aiSdkTransport` (the `ai` npm package) is the
 * one transport; `useAgentThreadRuns` is the one runner. Optional peers (`ai`,
 * `use-stick-to-bottom`) load lazily — importing this module does not resolve either.
 *
 * @example
 * import { aiSdkTransport, useAgentThreadRuns, ThreadFeed, Composer } from 'basalt-ui/agent'
 */

// ── Parts ─────────────────────────────────────────────────────────────────────
export type { AgentPart, ToolCallPart } from './parts'
export { parseAgentPart } from './parts'
export type { ForeignPart, TranscriptPart, PartRenderers, PartRenderer } from './foreign'

// ── Transport and runner ──────────────────────────────────────────────────────
export { aiSdkTransport } from './ai-sdk-transport'
export { useAgentThreadRuns } from './use-agent-thread-runs'
export type { ThreadRunState } from './use-agent-thread-runs'
export type { AgentError } from './error'
export { toAgentError } from './error'

// ── Thread contracts (the store is consumer-owned) ────────────────────────────
export type { ChatMessage } from './history'
export type { AgentThread, ThreadStatus, ThreadsStore } from './thread'
export type { AgentOutcome, OutcomeResolver } from './outcome'
export type { AgentTransport, ResumableAgentTransport } from './transport'

// ── Chat UI ───────────────────────────────────────────────────────────────────
export { ThreadFeed } from './chat/thread-feed'
export { ThreadFeedRow } from './chat/thread-feed-row'
export type { MessageAffordances } from './chat/message-affordances'
export { Composer } from './chat/composer'
export type { ComposerHandle, ComposerSubmit } from './chat/composer'
export { ToolChip } from './chat/tool-chip'
