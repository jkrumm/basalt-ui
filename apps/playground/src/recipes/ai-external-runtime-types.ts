import type { MessagePart as Part } from 'basalt-ui/ai'

// Support for `ai-external-runtime`: what each runtime hands a UI, so the recipe compiles without its package.
// In an app import the real types: `UIMessage` from `@tanstack/ai`, `Message` from `@ag-ui/core`,
// `ThreadMessageLike` from `@assistant-ui/react`. Each union is the subset the mappers read.

/** TanStack AI 1.3 `MessagePart`: a `tool-call` and, beside it, its `tool-result`. */
export type TanPart =
  | { type: 'text'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'tool-call'; id: string; name: string; input?: unknown; state: string }
  | { type: 'tool-result'; toolCallId: string; content: unknown; outcome?: 'denied' | 'cancelled' }

type AgCall = { id: string; function: { name: string; arguments: string } }
/** AG-UI 1.0 `Message`: `toolCalls` on the assistant, each result a later `tool` message. */
export type AgMessage =
  | { role: 'assistant'; content?: string; toolCalls?: AgCall[] }
  | { role: 'tool'; toolCallId: string; content: unknown }
  | { role: 'reasoning'; content: string }
  | { role: 'user' | 'system' | 'developer' | 'activity' }

/** assistant-ui 0.15 `ThreadMessageLike['content']` part: the result sits on the call itself. */
export type AuiPart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | {
      type: 'tool-call'
      toolCallId?: string
      toolName: string
      args?: unknown
      result?: unknown
      isError?: boolean
    }
  | { type: 'source'; sourceType: 'url'; id: string; url: string }

/** A tool part of the AI SDK shape `partView` reads (`state` as `toolView` maps it). */
export const tool = (
  name: string,
  id: string,
  state: string,
  io: { input?: unknown; output?: unknown },
): Part => ({ type: `tool-${name}`, toolCallId: id, state, ...io })

/** Tool arguments arrive as a JSON string; a half-streamed one is `undefined`, never a throw. */
export function parse(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch {
    return undefined
  }
}
