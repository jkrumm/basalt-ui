# Agent Chat — Framework Specification

> Status: PROPOSED (2026-08-02). Target: `basalt-ui` 1.10.0 → 1.13.0, four minors, in order.
> (The ladder started at 1.9.0. It shifted by one when 1.9.0 was released from `master` carrying
> only the chart-layer batch, while this work was still on its branch.)
> Source of the gap analysis this answers: the 2026-08-02 Hermes chat synthesis (§5 brief, §2–3 evidence) — an out-of-repo working note.
> Every file path below is relative to `packages/basalt-ui/` unless it starts with `apps/` or
> `tests/`. Every claim about current behaviour carries a `file:line`.

This surface is the complete Slack-style threaded agent chat — transport, run manager, transcript,
part rendering, composer and feed — assembled from primitives that are also exported individually,
so a consumer can take the whole thing or compose its own layout, and both levels are public API.
The invariant it enforces is that **a consumer must not be able to build an agent chat that
duplicates a stream, loses a partial turn, or drops tool calls**: stream resumption is only
reachable through a transport that has type-level asserted its replay is idempotent, a stopped turn
is appended by the same single writer that appends a completed one, a registered part type that has
no renderer is a `tsc` error, and the three known escape routes back into the raw AI SDK are lint
errors. Types and guards are the product here; the Mantine chrome is the demo.

---

## Current surface (v1.8.0)

Three modules, two of which are published and one of which is not.

### `src/agent/**` — exported from `./agent` (headless, Mantine-free)

Registered as a doctrine surface at `src/surfaces.ts:358-373` (`rule: 'agent'`, `layer: 'headless'`,
`optionalPeers: ['ai', 'use-stick-to-bottom']`). Barrel: `src/agent/index.ts:34-92`.

| Symbol                   | Signature (verbatim from source)                                                                                                                                                   | Subpath                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `AgentPart`              | `StartPart \| TextPart \| ReasoningPart \| ToolCallPart \| SourcePart \| ErrorPart` (`src/agent/parts.ts:74`)                                                                      | `./agent`, `.` (type only) |
| `StartPart`              | `{ readonly type: 'start'; readonly runId: string; readonly resumeToken?: string }` (`parts.ts:34-38`)                                                                             | `./agent`                  |
| `TextPart`               | `{ readonly type: 'text'; readonly text: string }` (`parts.ts:41`)                                                                                                                 | `./agent`                  |
| `ReasoningPart`          | `{ readonly type: 'reasoning'; readonly text: string }` (`parts.ts:44`)                                                                                                            | `./agent`                  |
| `ToolCallPart`           | `{ readonly type: 'tool'; readonly toolName: string; readonly input: unknown; readonly output?: unknown; readonly toolCallId?: string }` (`parts.ts:54-60`)                        | `./agent`                  |
| `SourcePart`             | `{ readonly type: 'source'; readonly url: string; readonly title?: string }` (`parts.ts:63`)                                                                                       | `./agent`                  |
| `ErrorPart`              | `{ readonly type: 'error'; readonly message: string }` (`parts.ts:66`)                                                                                                             | `./agent`                  |
| `parseAgentPart`         | `(raw: unknown) => AgentPart \| null` (`parts.ts:87`)                                                                                                                              | `./agent`                  |
| `isStartPart`            | `(part: unknown) => part is StartPart` (`parts.ts:134`)                                                                                                                            | `./agent`                  |
| `AgentTransport`         | `{ stream: (input: TInput, signal?: AbortSignal) => AsyncGenerator<TPart>; resume?: (resumeToken: string, signal?: AbortSignal) => AsyncGenerator<TPart> }` (`transport.ts:48-52`) | `./agent`, `.` (type only) |
| `edenTransport`          | `<TPart, TInput>(call, resumeCall?) => AgentTransport<TPart, TInput>` (`transport.ts:86-95`)                                                                                       | `./agent`                  |
| `aiSdkTransport`         | `<TPart = AgentPart>(options: AiSdkTransportOptions) => AiSdkTransport<TPart>` (`ai-sdk-transport.ts:239-241`)                                                                     | `./agent`                  |
| `AiSdkTransportOptions`  | `{ api: string; headers?; credentials?; fetch? }` (`ai-sdk-transport.ts:63-75`)                                                                                                    | `./agent`                  |
| `AiSdkTransport`         | `AgentTransport<TPart, string> & { forThread: (chatId: string) => AgentTransport<TPart, string> }` (`ai-sdk-transport.ts:79-86`)                                                   | `./agent`                  |
| `useAgentStream`         | `<TPart, TInput>({ transport }) => UseAgentStreamReturn<TPart, TInput>` (`use-agent-stream.ts:70-74`)                                                                              | `./agent`                  |
| `StreamStatus`           | `'idle' \| 'streaming' \| 'done' \| 'error'` (`use-agent-stream.ts:37`)                                                                                                            | `./agent`                  |
| `useAgentThreadRuns`     | `<TPart>({ transport, store, resolveOutcome, toUserParts? }) => { runs, start, retry, stop, stopAll }` (`use-agent-thread-runs.ts:262-267`, return `:99-113`)                      | `./agent`, `.`             |
| `ThreadRunState`         | `{ readonly status: 'streaming'; readonly parts: TPart[] }` (`use-agent-thread-runs.ts:62-67`)                                                                                     | `./agent`                  |
| `PartList`               | `<TPart extends AgentPart>({ parts, components? }) => JSX.Element` (`part-list.tsx:231-234`)                                                                                       | `./agent`                  |
| `AgentPartRenderers`     | `{ text; reasoning; tool; source; error }`, each `(props: { part: Extract<TPart, {type: K}>; index: number }) => JSX.Element \| null` (`part-list.tsx:41-80`)                      | `./agent`                  |
| `BasaltStickToBottom`    | `({ children, className?, style? }) => JSX.Element` (`stick-to-bottom.tsx:116-122`)                                                                                                | `./agent`                  |
| `createChatHistoryStore` | `<TPart>(opts) => () => ChatHistoryStore<TPart>` (`history.ts:90-92`)                                                                                                              | `./agent`                  |
| `ChatMessage`            | `{ readonly id: string; readonly role: 'user' \| 'assistant'; readonly parts: TPart[]; readonly createdAt: number }` (`history.ts:41-46`)                                          | `./agent`, `.`             |
| `createThreadsStore`     | `<TPart>(opts: ThreadsStoreOptions) => () => ThreadsStore<TPart>` (`thread.ts:161-163`)                                                                                            | `./agent`, `.`             |
| `AgentThread`            | `{ id; messages; outcome; status; read; createdAt; updatedAt; resumeToken?; meta? }` (`thread.ts:65-94`)                                                                           | `./agent`, `.`             |
| `ThreadStatus`           | `'pending' \| 'streaming' \| 'done' \| 'attention' \| 'error' \| 'interrupted'` (`thread.ts:46`)                                                                                   | `./agent`, `.`             |
| `ThreadsStore`           | 10-method object interface (`thread.ts:118-141`)                                                                                                                                   | `./agent`, `.`             |
| `AgentOutcome`           | `{ readonly title: string; readonly summary: string; readonly status: 'done' \| 'attention' \| 'error' }` (`outcome.ts:45-49`)                                                     | `./agent`, `.`             |
| `OutcomeResolver`        | `(thread: AgentThread<TPart>) => AgentOutcome \| Promise<AgentOutcome>` (`outcome.ts:65-67`)                                                                                       | `./agent`, `.`             |
| `heuristicOutcome`       | `(thread: AgentThread) => AgentOutcome` (`outcome.ts:96`)                                                                                                                          | `./agent`, `.`             |

### `src/agent-chat/**` — **NO SUBPATH EXPORT** (root barrel only)

`package.json:46-123` lists eighteen `exports` keys. There is no `./agent-chat`. The string
`agent-chat` appears in neither `package.json`, `llms.txt`, nor `src/surfaces.ts` — verified. The
modules are nonetheless built and shipped (`dist/agent-chat/index.js` exists), reachable only by
the root barrel's re-export at `src/index.ts:113-129`.

| Symbol                | Signature                                                                                                                                                                  | Subpath                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `ThreadWorkspace`     | `({ useThreads, transport, resolveOutcome, newThreadPlaceholder?, emptyState? }) => JSX.Element` (`agent-chat/thread-workspace.tsx:47-61`)                                 | `.` only                                            |
| `ThreadFeed`          | `({ threads: AgentThread[]; activeId: string \| null; onSelect: (id: string) => void }) => JSX.Element` (`thread-feed.tsx:22-28`)                                          | `.` only                                            |
| `ThreadOutcomeCard`   | `({ thread: AgentThread; selected: boolean; onSelect: () => void }) => JSX.Element` (`thread-outcome-card.tsx:145-151`)                                                    | `.` only                                            |
| `ThreadDetailPanel`   | `({ thread: AgentThread \| null; liveParts?: AgentPart[]; runStatus?: StreamStatus; onSend; onStop; onClose; onRetry? }) => JSX.Element` (`thread-detail-panel.tsx:76-91`) | `.` only                                            |
| `Composer`            | `({ onSubmit: (text: string) => void; disabled?: boolean; placeholder?: string; autoFocus?: boolean }) => JSX.Element` (`composer.tsx:33-41`)                              | `.` only                                            |
| `ThreadTranscript`    | `({ messages: ChatMessage[]; liveParts?: AgentPart[]; liveStatus?: StreamStatus }) => JSX.Element` (`thread-message.tsx:215-222`)                                          | `.` only                                            |
| `threadPartRenderers` | `Partial<AgentPartRenderers>` (`thread-message.tsx:152-158`)                                                                                                               | `.` only                                            |
| `coalesceParts`       | `(parts: AgentPart[]) => AgentPart[]` (`thread-message.tsx:164-177`)                                                                                                       | **NOT EXPORTED** — module-private                   |
| `MessageBlock`        | `({ author, parts, streaming? }) => JSX.Element` (`thread-message.tsx:184-192`)                                                                                            | **NOT EXPORTED** — module-private, and not `memo`'d |

**What the missing subpath costs a consumer.** `import { ThreadTranscript } from 'basalt-ui'`
resolves the root barrel, which is the full framework entry: `BasaltProvider`, the shell, the
dashboard composites, `./connectivity`, `motion`, and — because `agent-chat/thread-message.tsx:46`
imports `../content/markdown`, and `content/markdown.tsx:39` is a **static, top-level**
`import remend from 'remend'` — an eager `remend` resolution. That last one upgrades the gap
analysis's SUSPECTED item to CONFIRMED: the root entry hard-requires the `remend` peer today, the
README scopes it to `./content`, and `tests/required-peers.test.ts:35-41` does not pin it. Taking
the transcript component alone is not possible; taking it at all pulls the whole framework plus a
markdown repair library into the bundle.

### `src/content/**` — exported from `./content`

| Symbol                                  | Signature                                                                                                                                                                                                     | Subpath                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `Markdown`                              | `({ children, density?, measure?, streaming?, components?, allowedLinkPrefixes?, allowedImagePrefixes?, defaultOrigin?, remarkPlugins?, rehypePlugins?, className?, style? })` (`content/markdown.tsx:60-85`) | `./content`                                                                |
| `MarkdownComponents`                    | `= Components` (react-markdown's) (`markdown.tsx:58`)                                                                                                                                                         | `./content`                                                                |
| `MermaidDiagram`                        | `({ code, className?, style?, fallback? })` (`content/mermaid.tsx:59-66`)                                                                                                                                     | `./content`                                                                |
| `CodeBlock`                             | `({ code, language?, title?, showCopy?, className?, style? })` (`content/code-block.tsx:21-29`)                                                                                                               | `./content`                                                                |
| `Callout`                               | `({ kind?, title?, icon?, children, className?, style? })` (`content/callout.tsx:16-25`)                                                                                                                      | `./content`                                                                |
| `blockSplit`                            | `(markdown: string) => string[]` (`content/block-split.ts:47`)                                                                                                                                                | `./content`                                                                |
| `mdxComponents` / `createMdxComponents` | `content/mdx.tsx`                                                                                                                                                                                             | `./content`                                                                |
| `FenceBlock`                            | `({ node?: Element; settled: boolean })` (`content/fence-block.tsx:18-23`)                                                                                                                                    | **NOT EXPORTED** — "Not part of the public surface" (`fence-block.tsx:11`) |
| `extractFenceInfo` / `hastToText`       | `content/markdown-hast.ts:67, :12`                                                                                                                                                                            | **NOT EXPORTED** — same (`markdown-hast.ts:7`)                             |

Relevant current behaviour, for the target section to change:

- Fence dispatch is a hardcoded two-way branch: `mermaid` when `settled`, otherwise `CodeBlock`
  (`fence-block.tsx:27-37`). There is no registry — a consumer cannot add a `card` or `vega-lite`
  fence.
- There is **no sanitizer**. `remarkPlugins`/`rehypePlugins` are raw escape hatches appended after
  the defaults (`markdown.tsx:80, :82`); safety today is `urlTransform` allowlisting
  (`markdown.tsx:318-326`) plus react-markdown's no-raw-HTML default. `rehype-sanitize` is not a
  peer.
- Streaming settlement never completes: `StreamingBody` always renders the last block through
  `StreamingTailBlock` (`markdown.tsx:283-287`), and `threadPartRenderers.text` hardcodes
  `streaming` (`thread-message.tsx:67`). **Consequence, previously unrecorded:** a settled
  assistant message whose final block is a ` ```mermaid ` fence renders that fence as a `CodeBlock`
  forever — the diagram upgrade at `fence-block.tsx:27` is unreachable for the tail block of every
  message in the transcript.

### Tests

`src/agent/**` and `src/agent-chat/**` contain **zero test files** — verified by
`find src/agent src/agent-chat -name '*.test.*'` returning nothing. The abort/supersede/resume/
finalize logic in `use-agent-thread-runs.ts` (440 lines) and the snapshot-diffing in
`ai-sdk-transport.ts` (280 lines) are the two most intricate modules in the package and neither has
a single assertion. The monorepo also has **no DOM test harness** — no `happy-dom`, no
`@testing-library/*`, no `bunfig.toml` (root `package.json` devDependencies).

---

## Target surface

### 1. `./agent-chat` subpath export — NEW (prerequisite)

`package.json` gains one entry:

```jsonc
"./agent-chat": {
  "types": "./dist/agent-chat/index.d.ts",
  "import": "./dist/agent-chat/index.js"
}
```

`src/surfaces.ts` gains the matching registry entry. It reuses `rule: 'agent'` rather than minting
a 14th `RuleName` — the same precedent as `./data/table` reusing `'data'` (`surfaces.ts:336-346`)
and `./connectivity` reusing `'mantine'` (`surfaces.ts:413-423`):

```ts
'./agent-chat': {
  kind: 'doctrine',
  layer: 'mantine-coupled',
  rule: 'agent',
  skill: ['basalt-app'],
  guardKinds: [],
  description:
    'Mantine chrome over ./agent: ThreadWorkspace, ThreadFeed, ThreadFeedRow, ThreadOutcomeCard, ThreadDetailPanel, Composer, ThreadTranscript, ToolChip, threadPartRenderers',
  optionalPeers: [
    'motion', 'react-markdown', 'remark-gfm', 'remend', 'shiki',
    'beautiful-mermaid', 'use-stick-to-bottom',
  ],
  forbiddenImports: [],
},
```

The root barrel's re-export (`src/index.ts:113-129`) stays exactly as it is — UNCHANGED — so this
adds a door without closing one. `checkCoverage()` assertion 4 (every non-`#`, non-`.` key has an
exports entry) and assertion 8 (optionalPeers ⊆ peerDependencies ∩ peerDependenciesMeta) both pass
with the above; `llms.txt` is regenerated by `scripts/gen-llms.ts`, `AGENTS.md`'s subpath table by
`tests/agents-sync.test.ts`'s source.

```ts
// Consumer, after 1.10.0 — no BasaltProvider, no shell, no dashboard, no connectivity:
import { ThreadTranscript, Composer, ToolChip } from 'basalt-ui/agent-chat'
import { useAgentThreadRuns, aiSdkTransport } from 'basalt-ui/agent'
```

### 2. Part identity — CHANGED (`AgentPart` gains `id`)

Every variant carries a stable id. Index keys go away.

```ts
// src/agent/parts.ts — CHANGED
type PartBase = { readonly id: string }

export type StartPart = PartBase & {
  readonly type: 'start'
  readonly runId: string
  readonly resumeToken?: string
}
export type TextPart = PartBase & {
  readonly type: 'text'
  readonly text: string
  readonly offset?: number
}
export type ReasoningPart = PartBase & {
  readonly type: 'reasoning'
  readonly text: string
  readonly offset?: number
}
export type SourcePart = PartBase & {
  readonly type: 'source'
  readonly url: string
  readonly title?: string
}
export type ErrorPart = PartBase & { readonly type: 'error'; readonly message: string }
```

`offset` is the character position of this delta inside its part. It is the mechanism that makes a
replayed stream idempotent instead of duplicating:

```ts
// src/agent/merge.ts — NEW, exported from ./agent
/**
 * Identity-addressed accumulator. Appending a part whose id is already present REWRITES rather
 * than pushes: text/reasoning splice at `offset` (undefined = append at the tail), every other
 * variant replaces wholesale. A resume that replays a run from character 0 therefore rebuilds the
 * same parts array it produced the first time — it cannot double it.
 */
export function mergePart<TPart extends AgentPart>(parts: readonly TPart[], next: TPart): TPart[]
```

`useAgentStream` (`use-agent-stream.ts:111`) and `useAgentThreadRuns` (`use-agent-thread-runs.ts:197-202`)
both switch their accumulators from `push` to `mergePart`. `PartList`'s five `key={index}` sites
(`part-list.tsx:254, :262, :270, :278, :286`) become `key={part.id}`.

Transports yield a draft — `id` optional — and the hooks normalize, so a hand-rolled Elysia route
that yields `{ type: 'text', text: 'Hello' }` still compiles (the documented example in
`agent/rules/basalt-agent.md` and `transport.ts:20-24`):

```ts
// src/agent/parts.ts — NEW
export type Drafted<T> = T extends unknown ? Omit<T, 'id'> & { readonly id?: string } : never
export type AgentPartDraft = Drafted<AgentPart>

// src/agent/transport.ts — CHANGED default generic
export type AgentTransport<TPart = AgentPartDraft, TInput = string> = {
  /* unchanged shape */
}

// src/agent/id.ts — NEW, exported from ./agent
/** Stamps `${runId}#${n}` on any draft arriving without an id. Idempotent for drafts that have one. */
export function withPartIds<TPart extends { id?: string }>(
  runId: string,
  source: AsyncGenerator<TPart>,
): AsyncGenerator<TPart & { id: string }>
```

`edenTransport` wraps its yield in `withPartIds` internally. `aiSdkTransport` mints ids
deterministically instead — `${chatId}#${snapshotIndex}` for index-addressed parts, `tool#${toolCallId}`
for tool parts — which is what makes its replay idempotent (see §5).

### 3. Tool-call lifecycle — CHANGED (`ToolCallPart`), `ToolChip` NEW, `coalesceParts` NEW export

**The gap analysis's proposed state union is wrong.** It lists
`'input-streaming'|'input-available'|'running'|'output-available'|'output-error'|'output-denied'`.
AI SDK v7's actual `UIToolInvocation` union — read from
`node_modules/ai/dist/index.d.ts:1987-2065`, version 7.0.16 — has **seven** states and no
`'running'`:

`'input-streaming' | 'input-available' | 'approval-requested' | 'approval-responded' | 'output-available' | 'output-error' | 'output-denied'`

Since the locked decision is "mirroring AI SDK v7", the real union ships. `'running'` is a UI
label, not a wire state (`'input-available'` _is_ the running state: input complete, no output
yet), and inventing a state no transport can produce would violate the whole premise. The two
approval states are what make interactive tool approval expressible at all — synthesis D3(c)'s only
unique capability.

```ts
// src/agent/parts.ts — CHANGED
type ToolCallBase = PartBase & {
  readonly type: 'tool'
  readonly toolCallId: string // CHANGED: was optional (parts.ts:59)
  readonly toolName: string
  /** Wall-clock time from first sighting of this toolCallId to its terminal state. */
  readonly durationMs?: number
  readonly providerExecuted?: boolean
}

type ToolApproval = {
  readonly id: string
  readonly approved?: boolean
  readonly reason?: string
  readonly isAutomatic?: boolean
  readonly signature?: string
}

export type ToolCallPart =
  | (ToolCallBase & { readonly state: 'input-streaming'; readonly input?: unknown })
  | (ToolCallBase & { readonly state: 'input-available'; readonly input: unknown })
  | (ToolCallBase & {
      readonly state: 'approval-requested'
      readonly input: unknown
      readonly approval: ToolApproval & { readonly approved?: never; readonly reason?: never }
    })
  | (ToolCallBase & {
      readonly state: 'approval-responded'
      readonly input: unknown
      readonly approval: ToolApproval & { readonly approved: boolean }
    })
  | (ToolCallBase & {
      readonly state: 'output-available'
      readonly input: unknown
      readonly output: unknown
      readonly preliminary?: boolean
      readonly approval?: ToolApproval & { readonly approved?: true }
    })
  | (ToolCallBase & {
      readonly state: 'output-error'
      readonly input?: unknown
      /** The SDK's field name — there is no field named `error` anywhere in the union. */
      readonly errorText: string
      /** The only surviving record of an input that never validated. Static parts only. */
      readonly rawInput?: unknown
      readonly approval?: ToolApproval & { readonly approved?: true }
    })
  | (ToolCallBase & {
      readonly state: 'output-denied'
      readonly input: unknown
      readonly approval: ToolApproval & { readonly approved: false }
    })

export type ToolCallState = ToolCallPart['state']
export const TERMINAL_TOOL_STATES = ['output-available', 'output-error', 'output-denied'] as const
export function isToolCallSettled(part: ToolCallPart): boolean
```

> **Corrected 2026-08-02 against installed `ai@7.0.16`.** This section previously specified a flat
> `approvalId` / `approved` / `reason` and an error field named `error`. Both were wrong, and the
> shape above is what shipped in `e967a45`. Read `node_modules/ai/dist/index.d.ts:1977-2071` before
> trusting any restatement of this union, including this one.

Four things the earlier draft got wrong, each with a cost:

1. **The error field is `errorText`.** No field named `error` exists anywhere in `UIToolInvocation`.
2. **Approval is nested, not flat.** The SDK carries
   `approval: { id, approved?, reason?, isAutomatic?, signature? }`. Flattening it to sibling fields
   silently drops `isAutomatic` and `signature`, and `approved` is narrowed per state — `?: never` at
   `approval-requested`, `boolean` at `approval-responded`, literal `true` at
   `output-available`/`output-error`, literal `false` at `output-denied`. basalt **mirrors** the
   nesting rather than unwrapping it, following this spec's own premise of mirroring v7.
3. **`rawInput` exists and matters.** It is `output-error`-only and static-variant-only
   (`DynamicToolUIPart`'s `output-error` has no `rawInput`), and at that state `input` is explicitly
   nullable — so `rawInput` is the only surviving record of an input that never validated.
4. **`toolName` is not a field on `UIToolInvocation`.** For static tools it is encoded in the part
   discriminator `` `tool-${NAME}` `` and must be derived; only `DynamicToolUIPart` carries it
   explicitly. basalt's `ToolCallPart` keeps a required `toolName` — it is derived at the transport
   boundary, not read off the SDK part.

Also omitted by the earlier draft, all real: `title`, `toolMetadata`, `callProviderMetadata`
(all seven states) and `resultProviderMetadata` (`output-available`/`output-error` only).

`output` is present only in `output-available` — "output present while still running" is
unrepresentable, which is the point of nesting the union rather than flattening seven optional
fields onto one object.

`aiSdkTransport`'s `diffToolPart` changes accordingly: it stops swallowing `'input-streaming'`, stops
stuffing the error into `output`, and stops passing the four un-modelled states through flat behind an
`as unknown as AgentPartDraft` cast — emitting the real state, with the nested `approval` object
carried through verbatim, instead.

Three defects in that function were found in the 2026-08-02 SDK read and are fixed in the same pass.
None of them appear in the defect register:

| #   | Defect                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a   | **Dynamic tool names are destroyed.** `curr.type.slice('tool-'.length)` runs on every tool part, but `DynamicToolUIPart` has `type: 'dynamic-tool'` and carries its name only in `part.toolName`. Every dynamic tool renders as the literal string `dynamic-tool`                                                                                                              |
| b   | **The `prev?.state === curr.state → return []` short-circuit drops preliminary refinements.** `preliminary: true` outputs stream: successive updates arrive with `state: 'output-available'` unchanged and `output` mutating, so the first is emitted and every refinement discarded. Invisible to any fixture that drives one transition per tool call — which is all of them |
| c   | **`output-denied` carries neither `output` nor `errorText`.** A chip shaped "error if `errorText`, else done if `output`, else pending" renders a denied tool as pending forever                                                                                                                                                                                               |

A constraint on how the name gets derived: `ai` root-exports `getToolName` / `getStaticToolName` /
`isToolUIPart`, and they must **not** be imported. `ai-sdk-transport.ts` imports from `ai` type-only
by deliberate design — it never resolves the peer at runtime — so the fix uses the SDK's _types_ and
reimplements the two-line derivation locally (`split('-').slice(1).join('-')`, which handles
hyphenated tool names; `type.split('-')[1]` does not).

```ts
// src/agent/coalesce.ts — NEW, exported from ./agent (moved out of thread-message.tsx:164-177)
/**
 * Merges consecutive text/reasoning parts, and merges tool parts BY toolCallId regardless of
 * adjacency — the later state wins, the merged part keeps the position of its first occurrence,
 * and an input from an earlier state survives a later state that omits it. Without the
 * toolCallId rule the AI SDK's re-emission at input-available then output-available renders two
 * stacked <pre> blocks (today's behaviour via thread-message.tsx:209).
 *
 * It also maintains an approvalId -> toolCallId side index, and THAT part is not cosmetic:
 * `tool-approval-response` carries approvalId, approved and reason? but NO toolCallId
 * (ai@7.0.16 index.d.ts:2462-2467). The SDK itself resolves it by scanning accumulated parts for
 * a matching approval.id and throws when the request chunk was never applied, so the mapping
 * exists only in accumulated state and never on the wire. A toolCallId-only merge index cannot
 * represent an approval response at all.
 */
export function coalesceParts<TPart extends AgentPart>(parts: readonly TPart[]): TPart[]
```

```tsx
// src/agent-chat/tool-chip.tsx — NEW, exported from ./agent-chat and .
export type ToolChipProps = {
  readonly part: ToolCallPart
  readonly defaultExpanded?: boolean
  /** Rendered only in 'approval-requested'. Omit both to render a read-only chip. */
  readonly onApprove?: (approvalId: string) => void
  readonly onDeny?: (approvalId: string, reason?: string) => void
}
export function ToolChip(props: ToolChipProps): JSX.Element
```

```tsx
<ToolChip
  part={part}
  onApprove={(id) => api.runs.approve.post({ approvalId: id })}
  onDeny={(id, reason) => api.runs.deny.post({ approvalId: id, reason })}
/>
```

The chip is a one-line collapsed row (mono micro-label + tool name + state dot + `durationMs`),
expanding to input/output JSON. It replaces `ToolRenderer` (`thread-message.tsx:109-125`), which is
always-expanded and always renders both `<pre>` blocks.

### 4. Part-renderer registry on `ThreadTranscript` — NEW

Registry, not generics. **Why:** a `TPart` generic ripples through `AgentThread<TPart>` →
`ThreadsStore<TPart>` → `useAgentThreadRuns<TPart>` → every component, which is the exact ripple
`thread.ts:79-93` already cites as the reason `meta` stayed untyped — the registry keeps the
closed union closed and puts the open set beside it.

```ts
// src/agent/foreign.ts — NEW, exported from ./agent
/** A part basalt does not know. NOT a member of AgentPart — the built-in union stays closed. */
export type ForeignPart = {
  readonly type: string
  readonly id: string
  readonly [k: string]: unknown
}

/** What a transcript actually holds. */
export type TranscriptPart = AgentPart | ForeignPart

/** The consumer's registered foreign-part union, or `never` when un-augmented. */
export type ConsumerPart = BasaltRegister extends { parts: infer P extends ForeignPart } ? P : never

/**
 * Un-augmented: a loose string-keyed map. Augmented: EXHAUSTIVE over the registered union — a
 * MISSING key is a tsc error, and each renderer's `part` is narrowed to exactly its variant.
 * A stale key is NOT caught — see the note under invariant 2.
 */
export type PartRenderers = [ConsumerPart] extends [never]
  ? Readonly<Record<string, PartRenderer<ForeignPart>>>
  : { readonly [K in ConsumerPart['type']]: PartRenderer<Extract<ConsumerPart, { type: K }>> }

export type PartRenderContext<TPart = ForeignPart> = {
  readonly part: TPart
  readonly messageId: string
  readonly partId: string
  /** false while this part belongs to the in-flight tail of a streaming turn. */
  readonly settled: boolean
  readonly role: ChatMessage['role']
}
export type PartRenderer<TPart = ForeignPart> = (ctx: PartRenderContext<TPart>) => ReactNode

/** Canonical const-generic factory (packages/basalt-ui/CLAUDE.md, "Canonical token-factory contract"). */
export function definePartRenderers<const T extends PartRenderers>(map: T): T
```

Consumer side:

```ts
// argo: src/features/chat/parts.ts
type ToolProgressPart = { type: 'data-toolProgress'; id: string; tool: string; message: string }
type ChartPart       = { type: 'data-chart'; id: string; spec: ChartSpec }
declare module 'basalt-ui' {
  interface BasaltRegister { parts: ToolProgressPart | ChartPart }
}

export const chatRenderers = definePartRenderers({
  'data-toolProgress': ({ part }) => <ToolProgress tool={part.tool} message={part.message} />,
  'data-chart': ({ part, settled }) => (settled ? <BasaltChart spec={part.spec} /> : <ChartSkeleton />),
  // omit either key → tsc error: Property 'data-chart' is missing
})
```

```ts
// src/agent-chat/thread-message.tsx — CHANGED
export type ThreadTranscriptProps = ThreadTranscriptBase & VirtualizeProps

type ThreadTranscriptBase = {
  readonly messages: readonly ChatMessage<TranscriptPart>[]
  readonly liveParts?: readonly TranscriptPart[]
  readonly liveStatus?: StreamStatus
  /** Consumer renderers keyed by part.type. Consulted BEFORE the built-in union. */
  readonly renderers?: PartRenderers
  /** Called for a part whose type is neither an AgentPart variant nor a registered key. */
  readonly fallbackRenderer?: PartRenderer<ForeignPart>
  /** Per-message affordances. See §8. */
  readonly affordances?: MessageAffordances
  readonly groupConsecutive?: boolean
}
```

Resolution order, and it is the whole design:

1. `renderers[part.type]` — if present, call it. Consumer wins, always.
2. `narrowAgentPart(part)` → `AgentPart | null`. Non-null → `PartList`'s **unchanged** exhaustive
   switch with `default: assertNever(part)` (`part-list.tsx:291-293`).
3. `fallbackRenderer` — defaults to a visible `UnknownPartChip` in dev
   (`process.env.NODE_ENV !== 'production'`) and `null` in production. **Never throws.** A server
   that starts emitting a new part type must not blank the transcript.

`PartList` keeps its closed-union, per-variant `AgentPartRenderers` map (`part-list.tsx:74-80`) —
UNCHANGED. Two registries, two jobs: `PartList` renders what basalt knows, exhaustively;
`ThreadTranscript` renders what the app knows, open. Conflating them is what would force the
generic ripple.

### 5. Resume — CHANGED (`ResumableAgentTransport`)

```ts
// src/agent/transport.ts — NEW
/**
 * A transport whose replay is safe to run over an already-rendered turn. Implementing `resume`
 * alone is no longer enough: `idempotentReplay: true` is a literal-typed assertion that every
 * text/reasoning part this transport emits carries an authoritative `offset`, so mergePart
 * rewrites instead of appending. useAgentThreadRuns will not call resume() without it.
 */
export type ResumableAgentTransport<TPart = AgentPartDraft, TInput = string> = AgentTransport<
  TPart,
  TInput
> & {
  readonly resume: (resumeToken: string, signal?: AbortSignal) => AsyncGenerator<TPart>
  readonly idempotentReplay: true
}

export function isResumable<TPart, TInput>(
  t: AgentTransport<TPart, TInput>,
): t is ResumableAgentTransport<TPart, TInput>
```

`use-agent-thread-runs.ts:337-341`'s resume gate changes from `resolvedTransport.resume === undefined`
to `!isResumable(resolvedTransport)`. `aiSdkTransport` declares `idempotentReplay: true`;
`edenTransport` declares it only when a `resumeCall` was supplied _and_ the caller passed
`{ idempotentReplay: true }` explicitly — an opt-in, not an inference. This is the type-level form
of gap-analysis defects 2 and 3: you cannot reach the replay path without asserting the replay is
safe, and the assertion is a word a reviewer can grep for.

`useAgentThreadRuns` additionally holds an in-flight guard that survives StrictMode: the mount
reconcile effect's cleanup now clears `controllersRef` (see §Guards and §Test plan for the wedge
this fixes).

### 6. `ThreadsStoreAdapter` — NEW (async, server-backed, tested)

`createThreadsStore` is localStorage with silent ring-buffer caps (`thread.ts:164-165` — 50 threads,
100 messages/thread). Argo's transcript is in Postgres. Today the only documented way to get a
`ThreadsStore` is that factory, so a Postgres implementation is an unsupported fork.

```ts
// src/agent/adapter.ts — NEW, exported from ./agent
export type ThreadsStoreAdapter<TPart = AgentPart> = {
  readonly listThreads: (signal?: AbortSignal) => Promise<readonly AgentThread<TPart>[]>
  readonly loadThread: (id: string, signal?: AbortSignal) => Promise<AgentThread<TPart> | null>
  readonly createThread: (i: {
    readonly id: string
    readonly meta?: Record<string, unknown>
  }) => Promise<void>
  /**
   * CONTRACT: idempotent on `message.id`. The id is client-minted and is the ONLY idempotency
   * key — a retried or double-fired write with the same id must be a no-op, not a second row.
   */
  readonly appendMessage: (i: {
    readonly threadId: string
    readonly message: ChatMessage<TPart>
  }) => Promise<void>
  readonly setStatus: (i: {
    readonly threadId: string
    readonly status: ThreadStatus
  }) => Promise<void>
  readonly setOutcome: (i: {
    readonly threadId: string
    readonly outcome: AgentOutcome
  }) => Promise<void>
  readonly setResumeToken: (i: {
    readonly threadId: string
    readonly token: string | undefined
  }) => Promise<void>
  readonly markRead: (threadId: string) => Promise<void>
  readonly removeThread: (threadId: string) => Promise<void>
}

/** Wraps an adapter into the SYNC ThreadsStore every component already takes. Optimistic local
 *  state, revalidate on settle, roll back on rejection. */
export function createAdapterThreadsStore<TPart = AgentPart>(
  adapter: ThreadsStoreAdapter<TPart>,
  opts?: { readonly revalidateOnFocus?: boolean },
): () => ThreadsStore<TPart>

/** Test-runner-agnostic conformance suite — no bun:test import in shipped code. */
export function threadsStoreAdapterContract<TPart>(
  makeAdapter: () => ThreadsStoreAdapter<TPart> | Promise<ThreadsStoreAdapter<TPart>>,
): readonly { readonly name: string; readonly run: () => Promise<void> }[]
```

```ts
// argo: threads.test.ts
import { threadsStoreAdapterContract } from 'basalt-ui/agent'
for (const c of threadsStoreAdapterContract(() => postgresThreadsAdapter(db))) {
  it(c.name, () => c.run())
}
```

`ThreadsStore` gains two fields so an async backing store is expressible — CHANGED, additive; the
localStorage store fills them `true` / `undefined`:

```ts
export type ThreadsStore<TPart = AgentPart> = {
  // ...the existing 10 members, unchanged (thread.ts:118-141)
  readonly hydrated: boolean
  readonly error: unknown
}
```

### 7. Markdown fence registry, remark plugins, sanitize extension — CHANGED

```ts
// src/content/markdown.tsx — CHANGED
export type FenceRenderContext = {
  readonly code: string
  readonly language?: string
  /** Raw meta string after the language on the opening fence line. */
  readonly meta?: string
  readonly settled: boolean
}
export type FenceRenderer = (ctx: FenceRenderContext) => ReactNode

/** Renders CodeBlock while unsettled, `render` once settled. The built-in mermaid entry IS this. */
export function settledOnly(render: FenceRenderer): FenceRenderer

export type SanitizeSchemaExtension = {
  readonly tagNames?: readonly string[]
  readonly attributes?: Readonly<
    Record<string, readonly (string | readonly [string, ...unknown[]])[]>
  >
  readonly protocols?: Readonly<Record<string, readonly string[]>>
  readonly clobberPrefix?: string
}

export type MarkdownProps = {
  // ...all of markdown.tsx:60-85, UNCHANGED
  /** Keyed by fence language. Consulted before the built-in mermaid/CodeBlock dispatch. */
  readonly fenceRenderers?: Readonly<Record<string, FenceRenderer>>
  /** ADDITIONS merged into BASALT_SANITIZE_SCHEMA. Removals are not expressible. */
  readonly sanitizeSchema?: SanitizeSchemaExtension
}

/** The baseline: rehype-sanitize's defaultSchema plus basalt's own element allowances. */
export const BASALT_SANITIZE_SCHEMA: SanitizeSchema
```

**The sanitize hook is a data extension, not a `(base) => Schema` mapper.** The gap analysis
proposed the function form with a "never replace" comment; a comment is not enforcement — the
function form lets a consumer return `{}` and silently disable sanitization. An additions-only
object makes the removal _unrepresentable_, which is the standard this document is held to. basalt
merges it into the baseline and appends `[rehypeSanitize, merged]` as the **last** rehype plugin,
after the consumer's `rehypePlugins`, so nothing supplied through the escape hatch can outrun it.
`rehype-sanitize` becomes a new optional peer; absent, `Markdown` renders as today (no raw HTML is
parsed anyway) and logs once in dev.

```tsx
// argo, replacing sanitize-schema.ts + message-markdown.tsx entirely:
<Markdown
  streaming={!settled}
  density="chat"
  remarkPlugins={[remarkHermesAccents]}
  sanitizeSchema={{
    tagNames: ['hermes-badge', 'hermes-mark'],
    attributes: { 'hermes-badge': ['tone'] },
  }}
  fenceRenderers={{
    'vega-lite': settledOnly(({ code }) => <VegaLiteDiagram spec={code} />),
    card: settledOnly(({ code }) => <SmartCard raw={code} />),
  }}
>
  {text}
</Markdown>
```

**`settled` semantics, stated once.** `settled` is true for every block in non-streaming mode; in
streaming mode it is true for blocks `0..n-2` and false for the tail (`markdown.tsx:273-288`).
Settlement is monotone — a block that has settled never un-settles, because `blockSplit`
(`block-split.ts:47`) only closes a block on a boundary that has already been emitted. What is
missing today is the final settle: nothing ever renders the tail as settled. Fixed at the caller —
`threadPartRenderers.text` reads `ctx.settled` and passes `streaming={!ctx.settled}` instead of the
hardcoded `streaming` at `thread-message.tsx:67` — so a finished message re-renders once with every
block settled, and its trailing mermaid/vega fence finally upgrades.

### 8. `Composer` slots — CHANGED

```ts
// src/agent-chat/composer.tsx — CHANGED
export type ComposerAttachment = {
  readonly id: string
  readonly name: string
  readonly mediaType: string
  readonly size: number
  readonly url: string
}
export type ComposerSubmit = {
  readonly text: string
  readonly attachments: readonly ComposerAttachment[]
}

export type ComposerProps = {
  /** CHANGED: was `(text: string) => void` (composer.tsx:35). */
  readonly onSubmit: (payload: ComposerSubmit) => void
  readonly placeholder?: string
  readonly autoFocus?: boolean
  readonly maxRows?: number
  /** Hard-disable, independent of streaming (e.g. offline). */
  readonly disabled?: boolean
  /** A run is in flight on this thread. */
  readonly streaming?: boolean
  /** Default false — preserves today's `disabled={streaming}` (thread-detail-panel.tsx:170). */
  readonly allowSubmitWhileStreaming?: boolean
  /** When given, the send action becomes a Stop action while streaming. */
  readonly onStop?: () => void
  readonly leftSection?: ReactNode
  readonly rightSection?: ReactNode
  readonly attachments?: readonly ComposerAttachment[]
  readonly onAttachmentsChange?: (next: readonly ComposerAttachment[]) => void
  readonly onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void
  /** Persists the unsent draft under `basalt:composer-draft:<key>` via createPersistedState. */
  readonly draftKey?: string
  /** Replaces the Enter/Shift+Enter hint row (composer.tsx:116-129). */
  readonly hint?: ReactNode
}
```

```tsx
<Composer
  draftKey={`thread:${thread.id}`}
  streaming={runStatus === 'streaming'}
  onStop={() => runs.stop(thread.id)}
  leftSection={<VoiceRecordButton onTranscript={appendToDraft} />}
  rightSection={<AttachButton onFiles={addAttachments} />}
  attachments={attachments}
  onAttachmentsChange={setAttachments}
  onPaste={handleImagePaste}
  onSubmit={({ text, attachments }) => send(text, attachments)}
/>
```

basalt never learns what audio is — `leftSection` takes a `ReactNode`, argo puts its recorder in it.
Draft state clears only on a successful submit, so a failed send does not eat what was typed.

### 9. Transcript memoization + virtualization — CHANGED

```ts
type VirtualizeProps =
  | { readonly virtualize?: false; readonly height?: never }
  | { readonly virtualize: true | VirtualizeOptions; readonly height: number | string }

export type VirtualizeOptions = { readonly overscan?: number; readonly estimateSize?: number }
```

The props union is the guard: a virtualizer needs a measured scroll container, so `virtualize`
requires `height` and forbids it otherwise — and the JSDoc states the other half, that a virtualized
`ThreadTranscript` owns its own scroll node and must not be nested inside `BasaltStickToBottom`
(`thread-detail-panel.tsx:135-142` does exactly that today, correctly, for the non-virtual path).
Backed by the `@tanstack/react-virtual` optional peer already declared for `./data/virtual`.

Memoization, three changes, all inside `thread-message.tsx`:

- `MessageBlock` (`:184-213`) becomes `memo(MessageBlock, areMessageBlockPropsEqual)` — compares
  `message` by reference, plus the `settled` / `grouped` / `affordances` flags.
- `coalesceParts` moves out of the render body (`:209` calls it inline on every render) into a
  `useMemo` keyed on the parts array reference.
- The `renderers` map is memoized at the `ThreadTranscript` level, mirroring `PartList`'s existing
  `useMemo` (`part-list.tsx:237-240`).

Budget, asserted by test: **one streamed delta re-renders exactly one `MessageBlock`** — the live
one — on a 50-message thread.

### 10. Stop preserves the partial turn — CHANGED

Today `stop()` aborts, deletes the controller, sets status `'done'`, and deletes the run entry
(`use-agent-thread-runs.ts:421-431`); the aborted consumer bails at `:191-192` / `:205-207` / `:233`
before `appendMessage`. The text the user just watched arrive is gone.

```ts
// src/agent/history.ts — CHANGED, additive
export type ChatMessage<TPart = AgentPart> = {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly parts: TPart[]
  readonly createdAt: number
  /** How the turn ended. Absent on user messages and on pre-1.10 persisted assistant messages. */
  readonly finish?: 'complete' | 'stopped' | 'error'
}
```

New `stop()` contract, in order: read the accumulated parts out of the `setRuns` updater's `prev`
(no new ref needed) → abort the controller → clear the controller entry → if parts are non-empty,
`appendMessage(threadId, { …, parts, finish: 'stopped' })` → `resolveOutcome` on the partial
snapshot → `setOutcome` / `setStatus('done')` / `setResumeToken(undefined)` → delete the run entry.
`consumeAndFinalize` keeps returning silently on abort, so there is exactly **one writer** per
terminal path — the thing that makes double-append impossible.

`ThreadStatus` is deliberately **not** widened with `'stopped'`. Adding a member ripples through
`STATUS_BADGE` (`thread-outcome-card.tsx:31-36`), the two status alerts
(`thread-detail-panel.tsx:148, :160`), and `AgentOutcome['status']`'s documented terminal-subset
relationship (`outcome.ts:32-40`) for a distinction the message-level `finish` already carries.

### 11. Per-message affordances — NEW

```ts
export type MessageAffordances = {
  /** 'relative' (Intl.RelativeTimeFormat, the thread-outcome-card.tsx:40-61 helper) | 'absolute' | 'none'. Default 'relative'. */
  readonly timestamp?: 'relative' | 'absolute' | 'none'
  /** Copy the message's coalesced text. Default true. */
  readonly copy?: boolean
  /** Shown on the last assistant message only. Wire to useAgentThreadRuns' retry(). */
  readonly onRegenerate?: (messageId: string) => void
  /** Extra actions appended to the hover row. */
  readonly actions?: (ctx: { readonly message: ChatMessage<TranscriptPart> }) => ReactNode
}
```

`groupConsecutive` (default `true`) suppresses the role label and surface chrome on a message whose
predecessor has the same `role` and is within 5 minutes — the Slack rhythm. `ChatMessage.createdAt`
is stored today (`history.ts:45`) and rendered nowhere.

### 12. `ThreadFeedRow` — NEW (inline-expanding Slack variant)

`ThreadOutcomeCard` stays exactly as it is — it is inbox-shaped by design and deliberately never
renders live text (`thread-outcome-card.tsx:1-8, :167-168`). The Slack shape is a second component,
not a mode on the first.

```ts
// src/agent-chat/thread-feed-row.tsx — NEW
export type ThreadFeedRowProps = {
  readonly thread: AgentThread<TranscriptPart>
  readonly expanded: boolean
  readonly onToggle: (id: string) => void
  readonly liveParts?: readonly TranscriptPart[]
  readonly liveStatus?: StreamStatus
  readonly renderers?: PartRenderers
  readonly fallbackRenderer?: PartRenderer<ForeignPart>
  readonly affordances?: MessageAffordances
  readonly onSend: (payload: ComposerSubmit) => void
  readonly onStop?: () => void
  readonly composerProps?: Omit<ComposerProps, 'onSubmit' | 'onStop'>
}

// src/agent-chat/thread-feed.tsx — CHANGED, additive
export type ThreadFeedProps = {
  readonly threads: readonly AgentThread[]
  readonly activeId: string | null
  readonly onSelect: (id: string) => void
  /** 'outcome' (today's ThreadOutcomeCard inbox) | 'inline' (ThreadFeedRow). Default 'outcome'. */
  readonly variant?: 'outcome' | 'inline'
  readonly renderRow?: (thread: AgentThread) => ReactNode
}
```

The row mounts its transcript **lazily and keeps it mounted once opened** — it does not use Mantine
`Collapse`'s `keepMounted` default, which renders children inside React 19 `<Activity>` and
destroys/re-mounts effects on hide, re-firing every effect in the subtree (the mechanism behind
gap-analysis defect 3). Collapsing hides via CSS with the subtree intact; that is a documented
invariant of this component, not an implementation detail.

---

## Type-level invariants

**1. The built-in union stays closed; the open set lives beside it.** `AgentPart` is exhaustive and
`PartList`'s `default: assertNever(part)` (`part-list.tsx:291-293`) is the gate — adding a variant
without a case is a compile error, proved end-to-end by the fixture at
`apps/playground/src/demo/agent-part.type-guard.ts`. `ForeignPart` is a _separate_ type, and
`TranscriptPart = AgentPart | ForeignPart` is only ever consumed through the three-step resolution
in §4, whose middle step re-narrows to the closed union before the switch runs. The union is never
weakened with an `{ type: string }` member, so `assertNever` never silently starts accepting
everything — which is exactly what would happen if `ForeignPart` were folded into `AgentPart`.

**2. Registered parts cannot be dropped.** `PartRenderers` is a mapped type over
`ConsumerPart['type']` with **no `?`**. Once a consumer augments `BasaltRegister['parts']`, omitting
a renderer is `Property 'data-chart' is missing`. Un-augmented consumers get
`Record<string, PartRenderer<ForeignPart>>` and pay nothing.

> **Corrected 2026-08-02.** This paragraph previously also claimed a stale key errors with
> `Object literal may only specify known properties`. **It does not.** Verified with a minimal `tsc`
> repro during B2: `<const T extends Constraint>` inference does not excess-property-check an
> object-literal argument against the constraint — only _missing_ required keys are caught, and that
> check comes from ordinary assignability, not from freshness. An `@ts-expect-error` asserting the
> stale-key error is itself an unused-directive error.
>
> Deliberately not fixed with an `Exact<T, Shape>` wrapper. The Canonical token-factory contract
> (`packages/basalt-ui/CLAUDE.md:235-261`) mandates one shape across every `defineX`, and
> special-casing this factory would break a doctrine that is itself load-bearing. The severity does
> not warrant it: a stale key is a renderer for a part type nobody registers — dead code that never
> fires, not a runtime break — while the valuable half, a _missing_ key, is caught, and a registered
> type with no renderer falls through to `fallbackRenderer`, which is safe by construction.

`ConsumerPart` is a **hand-written sibling conditional, not a reuse of `Slot`** (`src/register.ts`).
`Slot`'s un-augmented fallback is the never-keyed `{}`, which is right for MAP-shaped slots and wrong
for this one: `{}` does not satisfy `ForeignPart`'s `{ type: string; id: string }` shape, so
`ConsumerPart['type']` would be a tsc error on the very zero-augmentation call site that has to
compile clean. `Slot`'s fallback is not parameterized — every other slot wants `{}` — so `parts` gets
its own conditional rather than a change to the shared mechanism. It keeps the `[T] extends [never]`
discipline `src/register.ts` documents at length; it just does not share the type.

**3. Inference actually infers.** `definePartRenderers<const T extends PartRenderers>(map: T): T`
follows the canonical factory contract verbatim (const generic, exact-keyed return, `satisfies` for
validation, no builder, no config bag). Inside a renderer, `part` is
`Extract<ConsumerPart, { type: K }>` — the specific variant, not the union, not `unknown`, no cast
at the call site. The one documented cast in the whole design is
`narrowAgentPart`'s internal validation, which is a runtime check returning a real type guard.

**4. Illegal tool states are unrepresentable.** `ToolCallPart` is a seven-member nested
discriminated union, so `output` without `state: 'output-available'`, `error` without
`'output-error'`, and `approvalId` without an approval state are all compile errors. Compare
today's flat shape (`parts.ts:54-60`), which permits `{ output: {...} }` on a call that has not
run and forces `ai-sdk-transport.ts:187-188` to smuggle an error through `output`.

**5. Resume requires an idempotence assertion.** `useAgentThreadRuns` narrows with
`isResumable(t)`, which requires the literal `idempotentReplay: true`. A transport author cannot
opt into replay by accident: `resume` alone no longer reaches the code path. Combined with
`mergePart`'s offset-addressed rewrite, a replay that overlaps rendered content converges instead of
concatenating.

**6. One writer per terminal path.** `appendMessage` for an assistant turn is called from exactly
two places — `consumeAndFinalize`'s success branch and `stop()` — and each returns early when the
other owns the turn (`controllersRef.current.get(threadId) !== controller` at
`use-agent-thread-runs.ts:191, :205, :235`). "Lost a partial turn" and "wrote the turn twice" are
the same invariant read from two sides.

**Deliberately NOT configurable:**

- **`AgentPart` itself.** Consumers extend via `ForeignPart` + the registry, never by widening the
  union. A widened union breaks every `assertNever` downstream, including in other consumers.
- **The sanitize baseline.** `sanitizeSchema` adds; it cannot remove, and it cannot displace the
  plugin's position as the last rehype pass.
- **Audio.** No `audio`/`voice`/`tts` prop, no media element, anywhere in `./agent-chat`. Composer
  slots take `ReactNode`; that is the entire contract. (`agent/rules/basalt-agent.md:387`.)
- **Vega-Lite.** No built-in fence renderer, no dependency. It is one entry in a consumer's
  `fenceRenderers` map.
- **Persistence.** basalt ships an interface plus a localStorage reference implementation. It never
  ships a network client, a schema, or a migration.
- **`ThreadStatus`.** Frozen at six members; see §10.

---

## Guards (oxlint plugin)

New rules in `configs/oxlint-plugin.js`, authored exactly like the eight already there: a
`{ meta: { type, docs: { description }, schema: [] }, create(context) }` object, registered in the
`export default { meta: { name: 'basalt' }, rules: {…} }` map (`oxlint-plugin.js:528-540`), and
levelled in **two** places — `"warn"` in `configs/oxlint.json`'s hand-maintained `rules` block
(`configs/oxlint.json:19-25`) and `"error"` in the repo-local `.oxlintrc.json`. That split is the
grace-minor doctrine from `packages/basalt-ui/CLAUDE.md`: basalt fixes its own violations
immediately, consumers get one minor of runway, and the promotion to `error` is its own commit.

These are **correctness** boundaries, not design guidance, so they do not honour `theme-allow`
(same reasoning as `visx-boundary`, `oxlint-plugin.js:449-455`). The two agent rules honour a
separate line-comment token, **`basalt-agent-allow`**, resolved by a new
`hasAgentAllow(context, node)` helper that is a copy of `hasThemeAllow` (`oxlint-plugin.js:65-74`)
with a different needle. A separate token is the point: a colour exemption must never be able to
switch off a streaming guard.

### `basalt/agent-resume-guard`

Prevents **defect 3** (no single-consumer discipline on resume; `@ai-sdk/react` fires
`resumeStream()` from an effect with no cleanup and no dedup guard, and React 19 StrictMode plus
Mantine `Collapse`'s `keepMounted` default fire it repeatedly).

Matches two shapes:

```js
// JSXAttribute-free — both are CallExpression visitors.
// 1. useChat({ …, resume: true, … })  — callee Identifier 'useChat', arg0 ObjectExpression with a
//    Property whose key is 'resume' and whose value is Literal `true`. Reports the Property node.
// 2. resumeStream()  /  <anything>.resumeStream()  — callee Identifier or MemberExpression whose
//    property name is 'resumeStream'. Reports the CallExpression node.
```

Message: `Unguarded stream resume — useAgentThreadRuns owns single-consumer discipline and
StrictMode-safe reconnection; a raw resume re-fires on every effect re-run (vercel/ai#7891, no
merged fix). Mark the line 'basalt-agent-allow' if you own the guard. (basalt/agent-resume-guard)`

No autofix — the fix is a design change, and a rule that could not synthesize a correct guard would
be synthesizing an incorrect one.

Fixtures (`configs/oxlint-plugin.test.ts`, same temp-dir + real-binary harness as the existing eight
describes, `oxlint-plugin.test.ts:20-54`):

| Fixture                                             | Expect                         |
| --------------------------------------------------- | ------------------------------ |
| `const c = useChat({ id, resume: true })`           | flags `agent-resume-guard`     |
| `const c = useChat({ id, resume: false })`          | clean                          |
| `const c = useChat({ id })`                         | clean                          |
| `useEffect(() => { chat.resumeStream() }, [])`      | flags                          |
| `// basalt-agent-allow` above `chat.resumeStream()` | clean                          |
| `// theme-allow` above `chat.resumeStream()`        | **flags** (wrong escape token) |
| `runs.start(id, text)`                              | clean                          |

### `basalt/agent-no-raw-usechat`

Prevents **defect 3** and **defect 14** (no unmount abort anywhere; `useAgentStream` aborts in its
unmount cleanup at `use-agent-stream.ts:84-89`, and `useAgentThreadRuns` at `:309-314`, so routing
through basalt gets it for free).

Matches an `ImportDeclaration` (or an `ImportExpression` with a literal source) whose source is
`'@ai-sdk/react'` or `'ai/react'` and whose specifiers include `useChat` or `useCompletion`. Reports
the specifier node, not the whole import — a file may legitimately import `UIMessage` types from the
same module.

Message: `Raw @ai-sdk/react useChat — use useAgentStream / useAgentThreadRuns over aiSdkTransport
(unmount abort, supersede guards, single-consumer resume). Mark the line 'basalt-agent-allow' to
opt out. (basalt/agent-no-raw-usechat)`

Autofix: none. The import specifiers are not call-compatible.

| Fixture                                          | Expect |
| ------------------------------------------------ | ------ |
| `import { useChat } from '@ai-sdk/react'`        | flags  |
| `import { useCompletion } from '@ai-sdk/react'`  | flags  |
| `import type { UIMessage } from '@ai-sdk/react'` | clean  |
| `import { DefaultChatTransport } from 'ai'`      | clean  |
| `import { useChat } from './my-hooks'`           | clean  |
| `// basalt-agent-allow` above the import         | clean  |

### `basalt/ai-sdk-major` + `basalt-ui doctor` → `ai-major-parity`

Prevents **defect 1** (`apps/api/package.json:31` → `ai@5.0.196` producing a UIMessageStream that
`apps/dashboard/package.json:44` → `ai@7.0.18` parses; a v7 `processUIMessageStream` throws
`Unknown chunk type` on any renamed chunk, and nothing pins the pairing).

Two halves, and they are not interchangeable:

**Lint half** — `basalt/ai-sdk-major`. On any `ImportDeclaration` from `'ai'` or `'@ai-sdk/*'`,
resolve the nearest ancestor `package.json` (cached per lint run, one filesystem walk per
directory), read the declared `ai` range, and report when its major differs from the `ai` peer major
basalt declares (`package.json:197` — `^7.0.15`). Message names both versions.

**Doctor half** — `ai-major-parity`, a new assertion in the `basalt-ui doctor` subcommand. It walks
every workspace package's `package.json`, collects declared `ai` majors, and fails when two of them
disagree. **The lint rule alone cannot catch argo's defect 1**, because it is cross-package: one
lint run over `apps/dashboard` sees only `ai@7` and is perfectly happy. Only a repo-wide manifest
walk sees the skew. Saying otherwise would be shipping a guard that does not guard.

| Fixture                                                                    | Expect                              |
| -------------------------------------------------------------------------- | ----------------------------------- |
| `import { streamText } from 'ai'` in a package declaring `"ai": "5.0.196"` | flags `ai-sdk-major`                |
| same, declaring `"ai": "^7.0.18"`                                          | clean                               |
| no `ai` in the nearest package.json                                        | clean (nothing to compare)          |
| doctor over `{api: ai@5, dashboard: ai@7}`                                 | exits non-zero, names both packages |
| doctor over `{api: ai@7, dashboard: ai@7}`                                 | passes                              |

### `basalt/raw-scroll-container` — promote, not add

The rule exists (`oxlint-plugin.js:346-367`) and would have flagged argo's raw `overflow-y: auto`
feed box. It ships **`"off"`** in the consumer preset (`configs/oxlint.json:23`) and `"warn"`
repo-local. Promote to `"warn"` shipped in this cycle and `"error"` a minor later, per the grace
doctrine. `BasaltStickToBottom` and `BasaltVirtualList` already carry their `theme-allow`
(`stick-to-bottom.tsx:42`, `thread-detail-panel.tsx:138`) — the legitimate cases are pre-marked.

---

## Test plan

`src/agent/**` and `src/agent-chat/**` have zero tests today. This is the suite, colocated with the
source per the repo's own convention (`src/content/block-split.test.ts`, `src/theme/radius.test.ts`).

**Harness — must be added first.** The monorepo has no DOM test setup (root `package.json`
devDependencies, no `bunfig.toml`). Add as **root devDependencies only**, so the published
package's empty `dependencies` and its peer story are untouched: `happy-dom`,
`@testing-library/react`, `@testing-library/dom`, plus a root `bunfig.toml` preloading
`happy-dom`'s `GlobalRegistrator`. Render-count assertions use a `useRef` counter in a probe
component, not a mocking library.

| File                                                         | What it pins                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/agent/parts.test.ts`                                    | `parseAgentPart` over the seven-state tool union; an unknown `state` returns `null`; `toolCallId` now required; drafts without `id` accepted, parts without `id` rejected; the `AgentPart` shape round-trips through `JSON.parse`                                                                                                                                                                                            |
| `src/agent/merge.test.ts`                                    | `mergePart`: append when the id is new; splice-at-`offset` when it exists; `offset: 0` replay of a full run rebuilds the identical array (**the idempotence proof**); non-text variants replace wholesale; ordering stable                                                                                                                                                                                                   |
| `src/agent/coalesce.test.ts`                                 | text+text and reasoning+reasoning merge; tool parts merge by `toolCallId` across non-adjacent positions; terminal state wins; `input` from `input-available` survives an `output-available` that omits it; merged part keeps first-occurrence position                                                                                                                                                                       |
| `src/agent/id.test.ts`                                       | `withPartIds` stamps only missing ids, is idempotent, and produces `${runId}#${n}`                                                                                                                                                                                                                                                                                                                                           |
| `src/agent/use-agent-stream.test.ts`                         | **abort** (`stop()` mid-stream → status `'done'`, generator stops); **supersede** (`send()` during `send()` → the first stream's later parts are discarded, `controllerRef` guard at `:106`); error → `'error'`; AbortError never sets `'error'` (`:117`); **unmount abort** (`:84-89`); **StrictMode double-mount emits exactly one stream**                                                                                |
| `src/agent/use-agent-thread-runs.test.ts`                    | concurrent threads stream independently; `start()` on a busy thread is a no-op (`:373`); finalize order — `appendMessage` → `resolveOutcome` → `setOutcome` → `setStatus` → `setResumeToken(undefined)` (`:215-223`); failure → `'error'`; **stop preserves the partial turn** (parts non-empty → one assistant message with `finish: 'stopped'`; parts empty → no message); `retry()` replays the cached input (`:412-419`) |
| `src/agent/use-agent-thread-runs.resume.test.ts`             | mount reconcile: no `resume` → `'interrupted'` (`:337-343`); no `resumeToken` → `'interrupted'`; resumable + token → `resume()` called once with the token; a failed resume → `'interrupted'` (`onFailureStatus`, `:364`); **`resume()` is not called for a transport lacking `idempotentReplay`**; a replay overlapping rendered text converges (composed with `mergePart`)                                                 |
| `src/agent/use-agent-thread-runs.wedge.test.ts`              | The gap analysis's SUSPECTED wedge, **both halves** — see below                                                                                                                                                                                                                                                                                                                                                              |
| `src/agent/thread.test.ts`                                   | ring-buffer caps (`thread.ts:164-165`); newest-first ordering; `setResumeToken(undefined)` deletes the key rather than assigning `undefined` (`:261-268`); two synchronous actions in one tick accumulate (`:180-190`)                                                                                                                                                                                                       |
| `src/agent/adapter.test.ts`                                  | `threadsStoreAdapterContract` run against an in-memory reference adapter — including the **idempotent append**: the same `message.id` twice yields one message; `createAdapterThreadsStore` hydration, optimistic append, rollback on rejection, `hydrated`/`error` transitions                                                                                                                                              |
| `src/agent/ai-sdk-transport.test.ts`                         | snapshot→delta diffing against a scripted `UIMessageChunk` stream; all seven tool states emitted; `output-error` carries `error`, not `output`; deterministic ids; `durationMs` on terminal states; `signal.aborted` stops yielding (`:218`)                                                                                                                                                                                 |
| `src/agent-chat/thread-transcript.test.ts`                   | **render count on a 50-message thread**: initial mount renders 50 blocks; one streamed delta re-renders exactly 1; a settled message never re-renders while the tail streams; `coalesceParts` runs once per message per parts-identity change; consecutive-author grouping; the `virtualize`/`height` props union rejects `virtualize` without `height` (tsc fixture)                                                        |
| `src/agent-chat/part-registry.test.ts`                       | resolution order (consumer > built-in > fallback); an unregistered foreign type hits `fallbackRenderer` and **never throws**; production default renders `null`; a renderer receiving `settled: false` for the live tail and `true` for settled messages                                                                                                                                                                     |
| `src/agent-chat/tool-chip.test.ts`                           | one chip per `toolCallId` across a full lifecycle; collapsed by default; `output-error` shows `error`; `approval-requested` renders approve/deny only when the callbacks are supplied                                                                                                                                                                                                                                        |
| `src/agent-chat/composer.test.ts`                            | Enter submits and clears, Shift+Enter newlines (`composer.tsx:64-68`); empty/whitespace ignored (`:58-59`); `allowSubmitWhileStreaming` gating; Stop replaces Send when `onStop` and `streaming`; attachments in the submit payload; paste handler; draft persists across remount and clears **only** on success                                                                                                             |
| `src/content/markdown-fences.test.ts`                        | `fenceRenderers` precedence over the built-in mermaid dispatch (`fence-block.tsx:27`); `settledOnly` renders `CodeBlock` while unsettled; a settled message's tail block upgrades (the previously-unreported settle bug)                                                                                                                                                                                                     |
| `src/content/sanitize.test.ts`                               | `sanitizeSchema` additions merge into `BASALT_SANITIZE_SCHEMA`; a returned schema cannot remove a baseline tag (not expressible); the sanitize pass runs **after** consumer `rehypePlugins`; `<script>` and `on*` attributes stripped with and without an extension                                                                                                                                                          |
| `configs/oxlint-plugin.test.ts`                              | three new `describe` blocks with the fixtures tabled above, plus `raw-scroll-container`'s promotion                                                                                                                                                                                                                                                                                                                          |
| `tests/required-peers.test.ts`                               | new row: `remend` is a **root-entry** hard requirement while `content/markdown.tsx:39` is a static import (1.10.0), flipped to lazy-optional in 1.12.0                                                                                                                                                                                                                                                                       |
| `apps/playground/src/demo/agent-part-registry.type-guard.ts` | tsc fixture in the shape of `agent-part.type-guard.ts`: an augmented `BasaltRegister['parts']` with a missing renderer key is a `@ts-expect-error`; a correctly-keyed map compiles and narrows `part`. **No stale-key `@ts-expect-error`** — const-generic inference does not excess-property-check, so that directive would itself be an unused-directive error (see invariant 2)                                           |

### The suspected `useAgentThreadRuns` wedge — reproduce **and** refute

The gap analysis flags `use-agent-thread-runs.ts:309-314` (unmount cleanup aborts every controller
but never clears `controllersRef`) against `:326-331` (the mount reconcile skips any thread where
`controllersRef.current.has(id)`), and says nothing proves it either way. Reading the code, the
general claim is **wrong** and a narrower one is **right**. The test file asserts both:

- **Refuted — unmount/remount.** `controllersRef` is a `useRef` (`:271`). A remount constructs a new
  hook instance with a fresh, empty `Map`; the stale one is unreachable. The reconcile sweep is not
  blocked, and an orphaned thread correctly falls to `'interrupted'`. Test: mount, start a run,
  unmount, remount with the same store → thread ends `'interrupted'`, not `'streaming'`.

- **Confirmed — StrictMode, same instance.** React 19 StrictMode runs effects, tears them down, and
  runs them again against the **same** refs. Sequence: reconcile effect (`:326-368`) resumes an
  orphaned thread and writes a controller into `controllersRef`; the unmount effect's cleanup
  (`:310-313`) aborts it and leaves the entry; the reconcile effect re-runs, sees
  `controllersRef.current.has(thread.id) === true`, computes `orphaned === false` (`:328-330`), and
  skips. The consumer for the only live attempt was aborted, and `consumeAndFinalize` returns
  silently on `AbortError` (`:233`) without touching status. The thread is wedged in `'streaming'`
  with no consumer, permanently. Test: render under `<StrictMode>` with a persisted `'streaming'`
  thread and a resumable transport → assert the status resolves and `resume()` was attempted exactly
  once.

Fix, one line: `controllersRef.current.clear()` inside the `:309-314` cleanup, matching what
`stopAll()` already does (`:433-437`).

---

## Release plan

Four minors. basalt-ui is npm-published: **minors only, never a major** (`feat!:` and
`BREAKING CHANGE:` are banned and `scripts/release.sh` hard-refuses one), and every
`packages/basalt-ui/**` change is **its own commit** (lefthook `isolated-basalt-ui`). Each release
goes out through `make release` and nothing else.

### 1.10.0 — the door and the proof

Ships: `./agent-chat` subpath export + `SURFACES` entry + regenerated `llms.txt`/`AGENTS.md`; the
full test harness and the `src/agent/**` suite; the StrictMode wedge fix; the three new oxlint rules
at `warn` shipped / `error` repo-local; `raw-scroll-container` promoted to `warn` shipped; the
`ai-major-parity` doctor check; the `remend` root-entry fact pinned in `required-peers.test.ts`.

No public API shape changes. This is the release that makes everything after it verifiable.

Playground gate before release:

- A page importing **only** `basalt-ui/agent-chat` + `basalt-ui/agent` — no `BasaltProvider` import
  in that module graph — rendering a transcript.
- The StrictMode wedge demo: a persisted `'streaming'` thread that resolves on mount instead of
  hanging.
- `bun run pre` green, `bun test` green, `bun run build` + `bun pm pack` + `scripts/pack-test.sh`
  green (the dist gate is what proves `./agent-chat` actually resolves from the tarball).

### 1.11.0 — the transcript

Ships: part identity (`id` on every variant, `AgentPartDraft`, `withPartIds`, `mergePart`,
`key={part.id}`); the seven-state `ToolCallPart` + `ToolChip` + exported `coalesceParts`;
`ResumableAgentTransport` + `isResumable`; the part-renderer registry on `ThreadTranscript`
(`PartRenderers`, `definePartRenderers`, `fallbackRenderer`, `BasaltRegister['parts']`);
`MessageBlock` memoization; stop-preserves-the-partial-turn + `ChatMessage.finish`.

Playground gate:

- A custom part type registered through `BasaltRegister['parts']`, rendered by a consumer renderer,
  alongside built-in parts in one transcript.
- A full tool lifecycle driven from `mock-ai-sdk-backend.ts` through all seven states, rendering as
  **one** chip that updates in place.
- Render-count HUD on the 50-message scenario showing one re-render per delta.
- Stop mid-stream leaves the partial text in the transcript, labelled stopped.
- The `agent-part-registry.type-guard.ts` fixture compiling (and its `@ts-expect-error` lines
  actually erroring).

### 1.12.0 — the seams

Ships: `Markdown` `fenceRenderers` + `settledOnly` + `sanitizeSchema` extension +
`BASALT_SANITIZE_SCHEMA` + `rehype-sanitize` as an optional peer; `remend` made lazy so the root
entry stops hard-requiring it; the settle fix in `threadPartRenderers.text`; the full `Composer`
prop set; `ThreadsStoreAdapter` + `createAdapterThreadsStore` + `threadsStoreAdapterContract` +
`ThreadsStore.hydrated`/`error`.

Playground gate:

- A custom `card` fence and a custom `vega-lite`-shaped fence rendering through the registry, both
  showing `CodeBlock` mid-stream and upgrading on settle — and the tail block of a _finished_
  message upgrading too.
- A sanitize extension adding a custom tag while `<script>` still gets stripped.
- A composer with a left slot, a right slot, attachments, paste-to-attach, and a draft surviving a
  page reload.
- An in-memory server-backed store behind `createAdapterThreadsStore` with an artificial 400 ms
  latency, showing hydration, optimistic append and rollback — and the shipped contract suite green
  against it.

### 1.13.0 — the Slack shape

Ships: `ThreadFeedRow` + `ThreadFeed`'s `variant`/`renderRow`; per-message affordances (timestamp,
copy, regenerate) + `groupConsecutive`; `ThreadTranscript` virtualization.

Playground gate:

- The inline feed: expand a row, watch it stream in place, collapse and re-expand **with no
  duplicated stream and no re-fired effects** (the direct analogue of gap-analysis defect 3).
- A 500-message thread scrolling at 60 fps with `virtualize` on, and the tsc error when `height` is
  omitted.
- Copy / regenerate / relative timestamps / author grouping on the same thread.
- `ThreadOutcomeCard` still rendering the inbox variant unchanged, side by side.

Promotion commits (their own, one minor later than the rule they promote): the three agent rules and
`raw-scroll-container` from `warn` to `error` in `configs/oxlint.json`.

---

## Migration notes for consumers

Argo is the only consumer, upgraded in lockstep, and is rebuilt in **one pass after 1.13.0** —
synthesis §6 phases 10 and 11. Nothing below should be attempted incrementally against a partial
release train.

### Breaks

| Change                                                                                                          | Consumer impact                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ComposerProps.onSubmit: (text: string) => void` → `(payload: ComposerSubmit) => void`                          | Every call site. `onSubmit={(t) => send(t)}` becomes `onSubmit={({ text }) => send(text)}`. Chosen over `(text, extra)` because the house TypeScript rule is typed-object arguments; the arity change is loud and one-shot. |
| `ToolCallPart.toolCallId` optional → required, `state` added, `output` moved into the `output-available` member | Any code constructing a tool part by hand, and any `part.output` read outside a state check. `parseAgentPart` rejects the old shape.                                                                                        |
| Every `AgentPart` variant gains `id`                                                                            | Code constructing parts for tests/mocks. Transports are unaffected — they yield `AgentPartDraft` and the hooks stamp ids. A hand-rolled `AgentTransport` object literal keeps compiling.                                    |
| `useAgentThreadRuns` no longer calls `resume()` on a transport without `idempotentReplay: true`                 | A custom resumable transport must add the literal. `aiSdkTransport` and `edenTransport(call, resumeCall, { idempotentReplay: true })` cover it.                                                                             |
| `ChatMessage` gains optional `finish`                                                                           | Persisted rows written before 1.11.0 have it absent. Treat `undefined` as `'complete'`.                                                                                                                                     |
| `ThreadsStore` gains `hydrated` / `error`                                                                       | Only affects a consumer that implements `ThreadsStore` by hand instead of using a factory.                                                                                                                                  |
| `basalt/agent-no-raw-usechat` at `warn`, then `error`                                                           | Argo's `chat-conversation.tsx` fails lint until the transport migration lands. Deliberate — that file is the migration.                                                                                                     |

### What argo deletes

Following the synthesis §2 file-by-file verdicts, now unblocked:

- `transport.ts` → `aiSdkTransport(...).forThread(threadId)`.
- `message-markdown.tsx`, `mermaid-diagram.tsx`, `diagram-shared.tsx` → `Markdown` with
  `fenceRenderers` + `remarkPlugins` + `sanitizeSchema`. Drops `react-markdown`, `remark-gfm`,
  `remend`, `mermaid`, `rehype-sanitize`, `rehype-harden` as direct dependencies.
- `sanitize-schema.ts` → a six-line `SanitizeSchemaExtension` literal.
- `chat-conversation.tsx`'s transcript, composer and scroll thirds → `ThreadTranscript` +
  `Composer` + `BasaltStickToBottom`. The voice and attachment thirds stay, moved into the composer
  slots.
- `thread-feed-row.tsx` → `ThreadFeedRow`.
- The dead `showToolProgress` menu (`chat-conversation.tsx:450-470`, unreachable behind
  `hideHeader`) — tool calls become chips in the transcript, so both defect 10 and defect 11 stop
  existing by construction rather than being fixed.

### What argo keeps and rewires

- `smart-card*.{ts,tsx}` → `fenceRenderers.card`, wrapped in `settledOnly`.
- `vega-lite-diagram.tsx` → `fenceRenderers['vega-lite']`, wrapped in `settledOnly` (locked
  decision D7 — Vega-Lite stays app-level, per HERMES-CHAT-V2.md's locked-decisions table; the
  recommendation to replace it with a `data-chart` part is a separate decision this spec does not
  prejudge, though the registry in §4 is exactly the seam that would make it a two-file change).
- `voice/*` (all seven files) → composer `leftSection`/`rightSection` and a per-message
  `affordances.actions` entry. basalt gains no audio surface (locked decision D6).
- `lib/queries/hermes.ts` + `lib/store.ts` → a `ThreadsStoreAdapter` over Postgres, validated by
  `threadsStoreAdapterContract`. Postgres stays the source of truth (locked decision D5);
  `createThreadsStore` is not used.

### What argo must do on the server side first

Locked decision D4 — the Elysia API stays a thin proxy: auth boundary, persistence tee, resume. It
stops re-encoding the protocol through `streamText` with retries. Concretely, and independent of
this document:

- **Do not upgrade `ai` on `apps/api`.** Locked decision D3 keeps `apps/api` on `ai@5` and
  neutralizes the version skew with a producer-side `TransformStream` that rewrites
  `finishReason: 'unknown'` to `'other'` before the stream reaches the dashboard's `ai@7` client.
  An `ai` 5 → 7 upgrade on the server looks like the obvious fix for the skew — it is not the
  locked decision, it is the thing D3 was written to avoid.
- **Do not add a replay offset to resume.** `resumeExistingStream(activeStreamId)` at
  `hermes.ts:759` takes one argument, and that is correct: `ai@7.0.18`'s `reconnectToStream` is a
  bare GET with no body, no query string and no `Last-Event-ID`/offset header
  (`src/ui/http-chat-transport.ts:235,243-247` — zero hits for `last-event-id`, `lastEventId`, or
  `skipCharacters` across the installed package), so the server has nothing to skip from. A
  `skipCharacters`-from-`Last-Event-ID` scheme looks like the natural resume mechanism by analogy
  with SSE reconnect conventions — this transport simply doesn't carry one.
- Set `maxRetries: 0`.
- **Add a `client_message_id` column and a partial unique index on `(thread_id,
client_message_id)`, and thread the client id through the POST body — none of which exists
  today.** `argo.hermes_message` currently has exactly 7 columns (id, thread_id, role, parts,
  payload, status, created_at) and 2 indexes (`hermes_message_pkey` UNIQUE(id), non-unique
  `idx_hermes_message_thread_created`); there is no key for `appendMessage`'s idempotency contract
  in §6 to enforce. This is the largest single prerequisite in this section — the other items here
  are configuration or code changes to existing surfaces, this one is new schema plus a
  request-contract change through the API boundary.
- 409 a POST while `active_stream_id` is set, and write the stream pointer before `execute`.

None of that is basalt's to own — but `ThreadsStoreAdapter`'s idempotency law and
`ResumableAgentTransport`'s `idempotentReplay: true` are both **assertions about the server**, and
a client that makes them against a server that does not honour them will still duplicate. The
types move the lie from silent to signed.
