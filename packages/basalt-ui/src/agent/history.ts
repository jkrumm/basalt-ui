/**
 * createChatHistoryStore — persisted, ring-buffered chat history on createPersistedState.
 *
 * Returns a stable hook factory (call once per module per stable key) that provides the full
 * message history, an append function, and a clear function. Messages are trimmed to `max`
 * (default 100) via a ring-buffer strategy — oldest entries are dropped first.
 *
 * SSR-safe: the underlying createPersistedState handles the server snapshot (returns initial).
 * Cross-tab: the 'storage' event propagates changes to other tabs automatically.
 *
 * @example
 * import { createChatHistoryStore } from 'basalt-ui/agent'
 *
 * // Call once at module scope with a stable key:
 * const useChatHistory = createChatHistoryStore({ key: 'main-chat', version: 1 })
 *
 * // In a component:
 * function Chat() {
 *   const { messages, append, clear } = useChatHistory()
 *   // ...
 * }
 */
import { useCallback, useRef } from 'react'
import { createPersistedState } from '../state'
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
}

// ── createChatHistoryStore options ────────────────────────────────────────────

export type ChatHistoryStoreOptions = {
  /** localStorage key (namespaced as `basalt:<key>`). Stable — changes key lose history. */
  readonly key: string
  /** Envelope version. Increment when the ChatMessage shape changes to clear old data. */
  readonly version: number
  /**
   * Maximum number of messages to retain. Oldest messages are dropped when exceeded.
   * @default 100
   */
  readonly max?: number
}

// ── Return type of the factory hook ──────────────────────────────────────────

export type ChatHistoryStore<TPart = AgentPart> = {
  /** All retained messages, oldest first. */
  readonly messages: ChatMessage<TPart>[]
  /** Append a message. Trims to `max` if needed (ring-buffer: drops oldest). */
  readonly append: (message: ChatMessage<TPart>) => void
  /** Clear all messages. */
  readonly clear: () => void
}

// ── createChatHistoryStore ────────────────────────────────────────────────────

/**
 * Creates a stable persisted chat history hook for the given key + version.
 *
 * Call this ONCE per module (not inside a component). The returned hook can be called in any
 * component that needs access to the same history. All instances sharing the same key stay
 * in sync across tabs via the 'storage' event.
 *
 * @example
 * // src/chat/history.ts — ONE stable creation per key:
 * export const useChatHistory = createChatHistoryStore({ key: 'main-chat', version: 1 })
 *
 * // In a component:
 * const { messages, append, clear } = useChatHistory()
 * append({ id: crypto.randomUUID(), role: 'user', parts: [...], createdAt: Date.now() })
 */
export function createChatHistoryStore<TPart = AgentPart>(
  opts: ChatHistoryStoreOptions,
): () => ChatHistoryStore<TPart> {
  const max = opts.max ?? 100

  const usePersistedMessages = createPersistedState<ChatMessage<TPart>[]>({
    key: opts.key,
    version: opts.version,
    initial: [],
  })

  return function useChatHistoryStore(): ChatHistoryStore<TPart> {
    const [messages, setMessages] = usePersistedMessages()

    // Ref mirrors the latest committed value so that two synchronous append() calls in one
    // render cycle accumulate correctly. createPersistedState's setter is a whole-value setter
    // (not a functional updater), so the second call would otherwise overwrite the first.
    const ref = useRef(messages)
    ref.current = messages

    const append = useCallback(
      (message: ChatMessage<TPart>): void => {
        const next = [...ref.current, message]
        // Ring-buffer: trim to max, dropping oldest entries first.
        const trimmed = next.length > max ? next.slice(next.length - max) : next
        ref.current = trimmed // sync so a second append in the same tick sees the update
        setMessages(trimmed)
      },
      [setMessages],
    )

    const clear = useCallback((): void => {
      ref.current = []
      setMessages([])
    }, [setMessages])

    return { messages, append, clear }
  }
}
