---
name: partView
use when: 'rendering the parts of a model message, from the AI SDK or a mapper of another runtime'
never when: 'the text is authored and trusted (use Markdown with contentTrust trusted) or the Chat itself is the question (it is not owned here)'
subpath: basalt-ui/ai
peers: ['@base-ui/react', react-markdown, rehype-sanitize, remark-gfm, remend]
slots: [ai-tools]
---

# partView

The parts of one message as React nodes. `settled` (default `true`) is false only for the message
still streaming; markdown there repairs its open tail and the tool rail stays open.

## Signature

```ts
partView(parts: readonly MessagePart[], o?: PartViewOptions): ReactNode
```

`MessagePart`, `PartViewOptions` import from `basalt-ui/ai`: `import type { MessagePart, PartViewOptions } from 'basalt-ui/ai'`.

## Example

```tsx
const { messages } = useChat({ chat })
return messages.map((m, i) => (
  <div key={m.id}>{partView(m.parts, { settled: i < messages.length - 1 })}</div>
))
```
