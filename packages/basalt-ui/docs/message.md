---
name: Message
use when: 'one turn of a chat thread, the person''s or the assistant''s'
never when: 'the text is not a conversation turn (use Prose, or a Card)'
subpath: basalt-ui/ai
peers: ['@base-ui/react', react-markdown, rehype-sanitize, remark-gfm, remend]
slots: [ai-message, ai-message-body]
---

# Message

One turn of a conversation: a capped bubble for the person, the full measure for the assistant,
and its actions under it. The body is yours: `partView(message.parts)` for a model's parts.

## Signature

```ts
Message({ from, children, actions, reveal, streaming, }: MessageProps): ReactElement
  from: "user" | "assistant"  // Who wrote the turn: `user` gets the bubble
  children: ReactNode
  actions?: readonly MessageAction[]
  reveal?: "always" | "hover"  // Shown on hover and focus (default) or always: the latest reply often keeps them out
  streaming?: boolean  // True for the reply still streaming: `aria-busy`, and its actions wait until it settles
```

## Example

```tsx
<Message from="assistant" actions={[{ kind: 'copy', text }]}>{partView(m.parts)}</Message>
```
