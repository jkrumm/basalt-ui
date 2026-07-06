---
source: basalt-ui
description: Streaming-agent layer for basalt-ui apps — Eden-native transport, AgentPart exhaustive handling, StreamingMarkdown, StickToBottom, chat history, AND the multi-thread ThreadWorkspace (concurrent runs + a distilled-outcome feed + detail panel). Headless layer in ./agent; the Mantine chrome ships from the root entry. Covers authoring doctrine and the Eden #231 footgun.
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
   Use `parseAgentPart` from `basalt-ui/agent` to narrow untrusted values arriving over the wire:

   ```ts
   import { parseAgentPart } from 'basalt-ui/agent'

   // On the client — e.g. parsing raw NDJSON lines from a custom transport:
   const raw: unknown = JSON.parse(line)
   const part = parseAgentPart(raw) // AgentPart | null
   if (part !== null) handlePart(part)

   // On the server — guard before yielding from external tool output:
   const candidate = buildPartFromTool(toolResult)
   const part = parseAgentPart(candidate)
   if (part !== null) yield part
   ```

   `parseAgentPart` performs structural narrowing against every variant in the discriminated union
   and returns `null` for unknown types or malformed shapes — no exceptions thrown.

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

## Multi-thread workspace (shipped)

For the "many short chats" pattern — each prompt a short-lived thread, the feed showing only a
distilled outcome (title + summary), a right-hand detail panel to open and continue — basalt-ui
ships a full workspace. The headless multi-thread layer lives in `./agent` (Mantine-free); the
ready-built Mantine chrome ships from the root `basalt-ui` entry.

### Headless (`basalt-ui/agent`)

```ts
import { createThreadsStore, useAgentThreadRuns, heuristicOutcome } from 'basalt-ui/agent'
import type { AgentThread, AgentOutcome, OutcomeResolver, ThreadStatus } from 'basalt-ui/agent'

// Call ONCE at module scope — same doctrine as createChatHistoryStore:
const useThreads = createThreadsStore({ key: 'main-threads', version: 1 })
```

- `createThreadsStore({ key, version, maxThreads?, maxMessagesPerThread? })` — the multi-thread
  analog of `createChatHistoryStore`: a persisted, ring-buffered registry of `AgentThread`s (each
  carrying its own `ChatMessage[]`, a distilled `AgentOutcome | null`, a `ThreadStatus`, and a read
  flag). Threads are newest-first; `create()` returns the new id and never touches `activeId`.
- `useAgentThreadRuns({ transport, store, resolveOutcome })` — the CONCURRENT run manager. Unlike
  `useAgentStream` (one in-flight turn), it runs N streams keyed by thread id, so many short chats
  stream and resolve in the background independently. `start(threadId, input)` / `stop(threadId)` /
  `stopAll()`; `runs` is the live per-thread `{ status, parts }` map for the detail view.
- `AgentOutcome = { title; summary; status: 'done' | 'attention' | 'error' }` — the distilled feed
  projection, deliberately a DIFFERENT shape from the transcript so raw prompt/thinking can never
  leak into the feed (the enforced boundary).

### Outcome resolver — the summarize-to-outcome seam

basalt ships ONLY the seam, never an LLM call. `OutcomeResolver = (thread) => AgentOutcome |
Promise<AgentOutcome>` — the app supplies it. In production derive `{ title, summary }` from the
finished run (e.g. a structured final step of your own model) and return it. `heuristicOutcome` is
a demo-only fallback that truncates the last assistant text — never the production path.

### Ready-built UI (`basalt-ui`, Mantine)

```tsx
import { ThreadWorkspace } from 'basalt-ui'
;<ThreadWorkspace
  useThreads={useThreads}
  transport={transport}
  resolveOutcome={resolveOutcome}
  newThreadPlaceholder="Ask anything…"
/>
```

`ThreadWorkspace` is the flagship composite: a `ThreadFeed` of distilled `ThreadOutcomeCard`s + an
anchored new-thread `Composer` on the left, a `ThreadDetailPanel` (full transcript + a continue
composer) on the right, collapsing to a single pane below 768px. The lower-level pieces
(`ThreadFeed`, `ThreadOutcomeCard`, `ThreadDetailPanel`, `Composer`, `ThreadTranscript`,
`threadPartRenderers`) are exported too for bespoke layouts. Motion (feed insert, panel slide) runs
on the shared `MOTION_*` tokens and honours `useReducedMotion`.

**Boundary:** the headless layer (`createThreadsStore`, `useAgentThreadRuns`, the outcome types)
stays Mantine-free in `./agent`; the components are Mantine-coupled and ship from the root entry.
Never add `@mantine/*` under `src/agent/**` — it is oxlint-enforced Mantine-free.

**No custom part types at the workspace level.** `ThreadWorkspace`, `ThreadDetailPanel`, and
`ThreadTranscript` render the framework's `AgentPart` union only — they are not generic over a
consumer-extended part type. If you need custom rendering for the existing part shapes, drop to
the headless layer instead: compose your own transcript from `PartList` (`basalt-ui/agent`) with a
custom `components` renderer map, rather than passing a wider type through `ThreadWorkspace`.

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

- Voice/audio streaming
- `aiSdkTransport` adapter
- `streamdown` integration (Tailwind-only)
- Elysia stream route scaffold in app code (consumer's responsibility)
- `agent-parts.ts` helper files beyond the basalt surface

> The full thread-chat composite (`ThreadWorkspace`) is now **shipped** — see "Multi-thread
> workspace" above. It was previously on this list; a real consumer drove it, so it graduated per
> the "build-when-driven" rule rather than being scaffolded speculatively.
