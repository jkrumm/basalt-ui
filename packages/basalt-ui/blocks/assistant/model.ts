/** The assistant's domain: a turn of the conversation and what an `@` mention names. */
import type { MessagePart } from 'basalt-ui/ai'

/** One turn: who wrote it and its parts, the AI SDK's `UIMessage` shape reduced to what the page reads. */
export type Turn = {
  id: string
  from: 'user' | 'assistant'
  parts: readonly MessagePart[]
}

/** What a mention points at: a supplier or a part of the inventory. */
export type MentionTarget = { kind: 'supplier' | 'part'; id: string }

/** A decision on a tool call that waits for the person. */
export type Decision = { tool: string; approved: boolean }
