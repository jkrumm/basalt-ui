---
name: ai-sdk-tools
use-when: a model shows typed blocks through one AI SDK tool, with a route handler and a client that renders the part through the catalog
file: apps/playground/src/recipes/ai-sdk-tools.tsx
---

One `show` tool whose input is a `z.discriminatedUnion` of the block schemas; its `description` is the model's guide. The server half imports `ai-blocks-schemas` only, never `ai-blocks`.
Render the `show` part yourself: it is the answer, so the tool rail must not fold it. `catalog.Block` validates (URL policy, size, depth) before any `render`.

```tsx
import { convertToModelMessages, streamText, tool, type LanguageModel, type UIMessage } from 'ai'
import { partView, type MessagePart } from 'basalt-ui/ai'
import { z } from 'zod'
import { catalog } from './ai-blocks' // client only; the server half imports the schemas
import { schemas } from './ai-blocks-schemas'

const arm = (b: (typeof schemas)[number]) => b.props.extend({ block: z.literal(b.name) })
const [first, ...rest] = schemas
const spec = z.discriminatedUnion('block', [arm(first), ...rest.map(arm)])

export const show = tool({
  description: `Show one block. ${schemas.map((b) => `${b.name}: ${b.description}`).join(' ')}`,
  inputSchema: z.object({ spec }),
  execute: async (input) => ({ shown: input.spec.block }),
})

export async function POST(req: Request, model: LanguageModel) {
  const { messages } = (await req.json()) as { messages: UIMessage[] }
  const result = streamText({
    model,
    tools: { show },
    messages: await convertToModelMessages(messages),
  })
  return result.toUIMessageStreamResponse()
}

// A `show` part is the answer, not a step: the app draws it, `partView` folds the rest.
type Shown = Extract<MessagePart, { toolCallId: string }>
const isShow = (p: MessagePart): p is Shown => p.type === 'tool-show'
const phase = (s: string) =>
  s === 'output-available' ? 'ready' : s === 'output-error' ? { tag: 'error' as const } : 'loading'

export function view(parts: MessagePart[], settled: boolean) {
  const rest = parts.filter((p) => !isShow(p))
  return (
    <>
      {partView(rest, { settled })}
      {parts.filter(isShow).map((p) => (
        <catalog.Block
          key={p.toolCallId}
          spec={(p.input as { spec?: unknown })?.spec}
          phase={phase(p.state)}
        />
      ))}
    </>
  )
}
```
