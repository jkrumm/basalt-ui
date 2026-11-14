---
name: ai-external-runtime
use-when: a chat runs on TanStack AI, AG-UI or assistant-ui and still renders through partView
file: apps/playground/src/recipes/ai-external-runtime.ts
---

Three mappers into `MessagePart`, for a message from TanStack AI 1.3, an AG-UI 1.0 thread or an assistant-ui 0.15 `ThreadMessageLike`. Copy this file and `ai-external-runtime-types.ts`; in an app import the types from the runtime's package.
Each runtime keeps a result apart from its call (a sibling part, a `tool` message) or on it; the mapper joins them and ends in `satisfies never`. A half-streamed argument string parses to `undefined`.

```ts
import type { MessagePart as Part } from 'basalt-ui/ai'
import { parse, tool } from './ai-external-runtime-types'
import type { AgMessage, AuiPart, TanPart } from './ai-external-runtime-types'

export function fromTanStack(parts: TanPart[]): Part[] {
  const done = new Map(
    parts.flatMap((p) => (p.type === 'tool-result' ? [[p.toolCallId, p] as const] : [])),
  )
  return parts.flatMap((p): Part[] => {
    if (p.type === 'text') return [{ type: 'text', text: p.content }]
    if (p.type === 'thinking') return [{ type: 'reasoning', text: p.content }]
    if (p.type === 'tool-result') return []
    if (p.type !== 'tool-call') return p satisfies never
    const r = done.get(p.id)
    const open = p.state === 'approval-requested' ? p.state : 'input-available'
    const state = !r ? open : r.outcome === 'denied' ? 'output-denied' : 'output-available'
    return [tool(p.name, p.id, state, { input: p.input, output: r?.content })]
  })
}

export function fromAgUi(messages: AgMessage[]): Part[] {
  const done = new Map(
    messages.flatMap((m) => (m.role === 'tool' ? [[m.toolCallId, m.content] as const] : [])),
  )
  return messages.flatMap((m): Part[] => {
    if (m.role === 'reasoning') return [{ type: 'reasoning', text: m.content }]
    if (m.role !== 'assistant') return []
    const calls = (m.toolCalls ?? []).map((c) => {
      const state = done.has(c.id) ? 'output-available' : 'input-available'
      return tool(c.function.name, c.id, state, {
        input: parse(c.function.arguments),
        output: done.get(c.id),
      })
    })
    return [...(m.content ? [{ type: 'text' as const, text: m.content }] : []), ...calls]
  })
}

export function fromAssistantUi(content: string | readonly AuiPart[]): Part[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  return content.map((p, i): Part => {
    if (p.type === 'text' || p.type === 'reasoning') return p
    if (p.type === 'source') return { type: 'source-url', sourceId: p.id, url: p.url }
    if (p.type !== 'tool-call') return p satisfies never
    const state =
      p.result === undefined ? 'input-available' : p.isError ? 'output-error' : 'output-available'
    return tool(p.toolName, p.toolCallId ?? `call-${i}`, state, { input: p.args, output: p.result })
  })
}
```
