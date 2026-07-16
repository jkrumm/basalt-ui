/**
 * basalt-ui/agent — headless, Mantine-free streaming-chat layer over an injected transport seam.
 *
 * `aiSdkTransport` (backed by the `ai` npm package) is the RECOMMENDED DEFAULT transport for LLM
 * chat use cases; `edenTransport` remains the zero-extra-dependency alternative. Optional peers
 * (ai, use-stick-to-bottom) are all lazily loaded — importing this module does NOT eagerly resolve
 * either of them. This module ships no markdown renderer — `agent/** -> content` is lint-blocked
 * by design, so `PartList` takes a consumer-supplied `components.text`; basalt's own is
 * `basalt-ui/content`'s `Markdown`.
 *
 * Install optional peers:
 *   bun add ai                                   # aiSdkTransport
 *   bun add use-stick-to-bottom                  # BasaltStickToBottom
 *
 * @example
 * import { useAgentStream, edenTransport, PartList, BasaltStickToBottom } from 'basalt-ui/agent'
 *
 * const transport = edenTransport((input, signal) =>
 *   api.chat.post({ body: { message: input }, fetch: { signal } }),
 * )
 *
 * function Chat() {
 *   const { parts, status, send, stop } = useAgentStream({ transport })
 *   return (
 *     <BasaltStickToBottom style={{ height: '400px', overflow: 'auto' }}>
 *       <PartList parts={parts} />
 *       <button onClick={() => send('Hello')}>Send</button>
 *       {status === 'streaming' && <button onClick={stop}>Stop</button>}
 *     </BasaltStickToBottom>
 *   )
 * }
 */

// ── AgentPart discriminated union ─────────────────────────────────────────────
export type {
  AgentPart,
  StartPart,
  TextPart,
  ReasoningPart,
  ToolCallPart,
  SourcePart,
  ErrorPart,
} from './parts'
export { parseAgentPart, isStartPart } from './parts'

// ── AgentTransport + edenTransport ───────────────────────────────────────────
export type { AgentTransport } from './transport'
export { edenTransport } from './transport'

// ── aiSdkTransport (recommended default, optional peer: ai) ──────────────────
export { aiSdkTransport } from './ai-sdk-transport'
export type { AiSdkTransport, AiSdkTransportOptions } from './ai-sdk-transport'

// ── useAgentStream ────────────────────────────────────────────────────────────
export { useAgentStream } from './use-agent-stream'
export type { StreamStatus, UseAgentStreamReturn } from './use-agent-stream'

// ── useAgentThreadRuns ────────────────────────────────────────────────────────
export { useAgentThreadRuns } from './use-agent-thread-runs'
export type {
  ThreadRunState,
  UseAgentThreadRunsArgs,
  UseAgentThreadRunsReturn,
} from './use-agent-thread-runs'

// ── PartList + renderer types ─────────────────────────────────────────────────
export { PartList } from './part-list'
export type {
  PartListProps,
  AgentPartRenderers,
  TextPartRenderer,
  ReasoningPartRenderer,
  ToolCallPartRenderer,
  SourcePartRenderer,
  ErrorPartRenderer,
} from './part-list'

// ── BasaltStickToBottom (lazy, optional peer: use-stick-to-bottom) ────────────
export { BasaltStickToBottom } from './stick-to-bottom'
export type { BasaltStickToBottomProps } from './stick-to-bottom'

// ── createChatHistoryStore + ChatMessage ──────────────────────────────────────
export { createChatHistoryStore } from './history'
export type { ChatMessage, ChatHistoryStore, ChatHistoryStoreOptions } from './history'

// ── createThreadsStore + AgentThread ──────────────────────────────────────────
export { createThreadsStore } from './thread'
export type { AgentThread, ThreadStatus, ThreadsStore, ThreadsStoreOptions } from './thread'

// ── AgentOutcome + heuristicOutcome ────────────────────────────────────────────
export { heuristicOutcome } from './outcome'
export type { AgentOutcome, OutcomeResolver } from './outcome'
