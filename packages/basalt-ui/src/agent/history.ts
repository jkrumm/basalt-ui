/** ChatMessage — the typed message shape every thread carries. */
import type { AgentPart } from './parts'

// ── ChatMessage ───────────────────────────────────────────────────────────────

/**
 * A single chat message. The `id` is a stable identifier for React keys and de-duplication.
 * Parts are the typed agent stream parts accumulated for this turn.
 *
 * @example
 * const msg: ChatMessage = {
 *   id: crypto.randomUUID(),
 *   role: 'user',
 *   parts: [{ type: 'text', text: 'Hello' }],
 *   createdAt: Date.now(),
 * }
 */
export type ChatMessage<TPart = AgentPart> = {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly parts: TPart[]
  readonly createdAt: number
  /** How the turn ended. Absent on user messages and on pre-1.11 persisted assistant messages. */
  readonly finish?: 'complete' | 'stopped' | 'error' | undefined
}
