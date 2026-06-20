/**
 * basalt-ui/agent — headless, Mantine-free streaming-chat layer over an injected transport seam.
 *
 * The default transport is Eden-native typed streaming (zero extra deps). Optional peers
 * (react-markdown, remark-gfm, use-stick-to-bottom) are lazily loaded — importing this module
 * does NOT eagerly resolve them.
 *
 * Install optional peers for markdown + auto-scroll:
 *   bun add react-markdown remark-gfm use-stick-to-bottom
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
  TextPart,
  ReasoningPart,
  ToolCallPart,
  SourcePart,
  ErrorPart,
} from './parts'

// ── AgentTransport + edenTransport ───────────────────────────────────────────
export type { AgentTransport } from './transport'
export { edenTransport } from './transport'

// ── useAgentStream ────────────────────────────────────────────────────────────
export { useAgentStream } from './use-agent-stream'
export type { StreamStatus, UseAgentStreamReturn } from './use-agent-stream'

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

// ── StreamingMarkdown (lazy, optional peer: react-markdown + remark-gfm) ──────
export { StreamingMarkdown } from './streaming-markdown'
export type { StreamingMarkdownProps } from './streaming-markdown'

// ── BasaltStickToBottom (lazy, optional peer: use-stick-to-bottom) ────────────
export { BasaltStickToBottom } from './stick-to-bottom'
export type { BasaltStickToBottomProps } from './stick-to-bottom'

// ── createChatHistoryStore + ChatMessage ──────────────────────────────────────
export { createChatHistoryStore } from './history'
export type { ChatMessage, ChatHistoryStore, ChatHistoryStoreOptions } from './history'
