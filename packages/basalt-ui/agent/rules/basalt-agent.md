---
source: basalt-ui
description: Headless streaming-agent layer for basalt-ui apps — Eden-native transport, AgentPart exhaustive handling, StreamingMarkdown, StickToBottom, and chat history. basalt-ui ships ./agent; this rule covers the authoring doctrine and the Eden #231 footgun mitigation.
paths:
  - 'src/**/*agent*'
  - 'src/**/chat*'
  - 'src/**/transport*'
  - 'apps/**/src/**/*agent*'
  - 'apps/**/src/**/chat*'
---

# Basalt Agent — Streaming Chat Layer

basalt-ui ships `./agent` — a headless, Mantine-free streaming-chat layer with an injected
transport seam, exhaustive part rendering, optional markdown, auto-scroll, and persisted history.

## AgentPart discriminated union

```ts
import type { AgentPart } from 'basalt-ui/agent'
// TextPart | ReasoningPart | ToolCallPart | SourcePart | ErrorPart
```

Every switch over `AgentPart` MUST end with `default: return assertNever(part)`. This is
enforced by tsc — adding a new variant without a case is a compile error.

## AgentTransport — the injected seam

```ts
import { useAgentStream, edenTransport, type AgentPart } from 'basalt-ui/agent'

// Wrap your Eden call:
const transport = edenTransport<AgentPart>((input, signal) =>
  api.chat.post({ body: { message: input }, fetch: { signal } }),
)

// Wire into the hook:
const { parts, status, send, stop, regenerate } = useAgentStream({ transport })
```

`edenTransport` is zero-dep: it awaits the Eden `{data, error}` envelope, throws on error,
and yields from the `AsyncGenerator<TPart>` data value.

The transport seam is generic (`AgentTransport<TPart, TInput>`) — consumers can extend AgentPart
with domain variants and pass a custom input type. For a mock (tests/playground), implement the
interface directly without `edenTransport`:

```ts
const mockTransport: AgentTransport = {
  async *stream(input) {
    yield { type: 'text', text: `Echo: ${input}` }
  },
}
```

## Eden #231 — the critical stream footgun

**Issue (STILL OPEN):** applying a `t.Object` or `t.Union` response schema to an Elysia
`async function*` stream route collapses the streamed union to `any` in Eden Treaty.

**Mitigation (required doctrine):**

1. **NO response schema on the stream route.** Leave the `.post(handler)` call schema-free for
   the streaming generator.
2. **Validate at yield-time.** Check part shape before yielding, not in the Elysia schema layer.
3. **Explicit return type annotation.** The handler MUST declare `: AsyncGenerator<AgentPart>`.

```ts
// ✓ Correct — explicit return type, no response schema:
app.post('/chat', async function* ({ body }): AsyncGenerator<AgentPart> {
  // validate body.message here, not via t.Object schema
  yield { type: 'text', text: 'Hello' }
  yield { type: 'text', text: ' world' }
})

// ✗ Wrong — response schema collapses the union to `any`:
app.post(
  '/chat',
  async function* ({ body }): AsyncGenerator<AgentPart> {
    yield { type: 'text', text: 'Hello' }
  },
  {
    response: t.Object({ type: t.Literal('text'), text: t.String() }), // drops to any
  },
)
```

## Two additional Eden silent-`any` footguns

These apply to ALL Eden Treaty usage (not just streams):

1. **Non-chained routes.** Elysia routes MUST be method-chained (`app.get(...).post(...)`). A
   standalone `app.get(...)` that is not chained back drops the `App` type to `any`, losing all
   Treaty type safety.

2. **Mismatched tsconfig path aliases.** Client and server packages MUST share or extend one root
   `tsconfig` so path aliases (`~/*`, `@/*`) resolve identically. A mismatch causes Eden's type
   extraction to fail silently and degrade to `any`.

Both footguns produce no TypeScript error at the point of breakage — they only manifest as `any`
types on the Treaty client.

## useAgentStream

```ts
const { parts, status, send, stop, regenerate } = useAgentStream({ transport })
// status: 'idle' | 'streaming' | 'done' | 'error'
// send(input): starts a new stream, resets parts
// stop(): aborts the in-flight stream via AbortController
// regenerate(): re-runs the last input
```

## PartList — exhaustive rendering

```tsx
import { PartList, StreamingMarkdown } from 'basalt-ui/agent'

// Default headless renderers (plain HTML elements):
<PartList parts={parts} />

// With StreamingMarkdown for the text renderer:
<PartList
  parts={parts}
  components={{
    text: ({ part }) => <StreamingMarkdown>{part.text}</StreamingMarkdown>,
  }}
/>
```

`PartList` ships five headless default renderers (zero Mantine):

- `text` → `<div className="basalt-agent-text">`
- `reasoning` → `<details className="basalt-agent-reasoning">`
- `tool` → `<div className="basalt-agent-tool">` with labelled input/output `<pre>`
- `source` → `<a className="basalt-agent-source">`
- `error` → `<div className="basalt-agent-error" role="alert">`

## StreamingMarkdown (optional peer)

Tailwind-free markdown via `react-markdown` + `remark-gfm`, lazily loaded.

```tsx
import { StreamingMarkdown } from 'basalt-ui/agent'
;<StreamingMarkdown>{markdownText}</StreamingMarkdown>
```

**Install:** `bun add react-markdown remark-gfm`

`react-markdown` and `remark-gfm` are OPTIONAL peers — importing `basalt-ui/agent` does NOT
eagerly resolve them (React.lazy + dynamic import). They load only when `StreamingMarkdown` first
renders.

**streamdown is NOT an alternative here.** `streamdown v2.5.0` REQUIRES Tailwind CSS for its
class-based rendering pipeline — it is the Tailwind-only alternative and is not a basalt peer.
If your app uses Tailwind, `streamdown` is an option in consumer code; basalt ships `react-markdown`.

## BasaltStickToBottom (optional peer)

```tsx
import { BasaltStickToBottom } from 'basalt-ui/agent'
;<BasaltStickToBottom style={{ height: '400px', overflow: 'auto' }}>
  <PartList parts={parts} />
</BasaltStickToBottom>
```

**Install:** `bun add use-stick-to-bottom`

Lazily loaded — `use-stick-to-bottom` is an optional peer. Falls back to a plain scrollable div
while loading. Surfaces a scroll-to-bottom button (`.basalt-agent-scroll-to-bottom`) when the user
scrolls up.

## createChatHistoryStore

```ts
import { createChatHistoryStore } from 'basalt-ui/agent'

// Call once at module scope with a stable key:
const useChatHistory = createChatHistoryStore({ key: 'main-chat', version: 1, max: 100 })

// In a component:
const { messages, append, clear } = useChatHistory()
append({ id: crypto.randomUUID(), role: 'user', parts: [...], createdAt: Date.now() })
```

Built on `createPersistedState` — SSR-safe, cross-tab via the `storage` event. Ring-buffered to
`max` (default 100). Increment `version` when the `ChatMessage` shape changes to clear stale data.

## AI SDK (opt-in, not shipped)

`@ai-sdk/react`'s `useChat` is a hook interface, not an async generator — it does not fit the
`AgentTransport` seam cleanly. basalt does NOT ship an `aiSdkTransport` or declare `ai` /
`@ai-sdk/react` as peers. To use the AI SDK, implement `AgentTransport` directly:

```ts
import { type AgentTransport } from 'basalt-ui/agent'
// Implement the seam with your AI SDK streaming call:
const aiSdkTransport: AgentTransport = {
  async *stream(input) {
    // Call the AI SDK, yield AgentParts from the stream
  },
}
```

## Deferred (advisory — not shipped)

The following are explicitly deferred and MUST NOT be scaffolded:

- Full `<Chat>` composite component (message-bubble kit, input bar, send button)
- Voice/audio streaming
- `aiSdkTransport` adapter
- `streamdown` integration (Tailwind-only)
- Elysia stream route scaffold in app code (consumer's responsibility)
- `agent-parts.ts` helper files beyond the basalt surface
