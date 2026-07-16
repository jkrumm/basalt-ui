/**
 * agent-scenarios — mock AgentTransports that drive the /agent chat demo without a live backend.
 *
 * Each scenario is a deterministic, abortable async generator that streams AgentParts on a timer so
 * the chat exercises the full lifecycle: reasoning, token-by-token markdown text, tool calls,
 * cited sources, and (the error scenario) a mid-stream throw that surfaces the error status.
 *
 * Text is emitted as many small `text` deltas — exactly how a real token stream arrives — so the
 * chat's text-coalescing path (consecutive text parts merged into one markdown block) is genuinely
 * tested, not bypassed by pre-joined strings.
 *
 * In a real app this whole file is replaced by `edenTransport(...)` over your streaming route.
 */
import type { AgentPart, AgentTransport } from 'basalt-ui/agent'

// ── Speed control ───────────────────────────────────────────────────────────────

export type StreamSpeed = 'instant' | 'normal'

/** Per-delta delay. `instant` is for fast dev iteration; `normal` reads like a real stream. */
const DELTA_DELAY: Record<StreamSpeed, number> = { instant: 0, normal: 28 }

// ── Abortable sleep ─────────────────────────────────────────────────────────────

/**
 * Resolves after `ms`, or early (resolve, not reject) when the signal aborts — the generator's own
 * `signal.aborted` guard then returns, so stop() cancels mid-stream without an AbortError surfacing.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise<void>((resolve) => {
    const done = (): void => resolve()
    const timer = setTimeout(done, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        done()
      },
      { once: true },
    )
  })
}

// ── Token chunking ──────────────────────────────────────────────────────────────

/**
 * Split a markdown string into word-sized `text` deltas (keeping whitespace attached) so it streams
 * like a real token feed. The chat coalesces these back into one markdown document before rendering.
 */
function tokens(text: string): AgentPart[] {
  const pieces = text.match(/\S+\s*/g) ?? [text]
  const out: AgentPart[] = []
  for (let i = 0; i < pieces.length; i += 2) {
    out.push({ type: 'text', text: pieces.slice(i, i + 2).join('') })
  }
  return out
}

// ── Scenario definitions ────────────────────────────────────────────────────────

export type AgentScenario = {
  readonly value: string
  readonly label: string
  readonly hint: string
  /** Build the ordered part sequence for a given user input. */
  readonly parts: (input: string) => AgentPart[]
  /** When true, the transport throws after yielding `parts` — exercises the error status path. */
  readonly fail?: boolean
}

export const AGENT_SCENARIOS = [
  {
    value: 'rich',
    label: 'Rich markdown (code + mermaid + alert)',
    hint: 'Exercises what `basalt-ui/content` renders that a plain markdown pass does not: a shiki-highlighted fence, a mermaid diagram, and a GFM alert as a Callout.',
    parts: (input: string) => [
      {
        type: 'reasoning',
        text: `"${input}" is best answered with a snippet and a diagram — streaming both now.`,
      },
      ...tokens(
        `## Rendering "${input}"\n\n` +
          `Chat markdown resolves to the same renderer as long-form content, so a fence gets real ` +
          `syntax highlighting once the block settles:\n\n` +
          '```ts\n' +
          `export function render(text: string) {\n` +
          `  // one renderer, chat density\n` +
          `  return <Markdown streaming density="chat">{text}</Markdown>\n` +
          `}\n` +
          '```\n\n' +
          `The flow through the thread surface:\n\n` +
          '```mermaid\n' +
          `flowchart LR\n` +
          `  A[AgentPart] --> B[thread-message]\n` +
          `  B --> C[content Markdown]\n` +
          `  C --> D[Prose density=chat]\n` +
          '```\n\n' +
          `> [!NOTE]\n` +
          `> GFM alerts render as a semantic Callout — one of the things the old chat renderer ` +
          `silently dropped.\n`,
      ),
    ],
  },
  {
    value: 'answer',
    label: 'General answer',
    hint: 'Reasoning + a streamed markdown reply (headings, list, inline code, quote).',
    parts: (input: string) => [
      {
        type: 'reasoning',
        text: `The user asked: "${input}". I'll give a structured, concise answer.`,
      },
      ...tokens(
        `## On "${input}"\n\n` +
          `Here's a focused take. The key idea is to keep the interface **deep** and the surface ` +
          `small — callers should reach for one obvious entry point, not assemble primitives.\n\n` +
          `A few practical notes:\n\n` +
          `- Start from the **contract**, not the implementation.\n` +
          `- Push verbose work behind the seam so the caller stays clean.\n` +
          `- Prefer \`one well-named call\` over three coordinated ones.\n\n` +
          `> Rule of thumb: if the explanation is longer than the code, the abstraction is too shallow.\n`,
      ),
    ],
  },
  {
    value: 'tools',
    label: 'Tool use + sources',
    hint: 'Reasoning → a tool call with input/output → cited sources → a synthesized answer.',
    parts: (input: string) => [
      {
        type: 'reasoning',
        text: 'I should ground this in the docs before answering — searching now.',
      },
      {
        type: 'tool',
        toolName: 'search_docs',
        input: { query: input, limit: 3 },
        output: {
          hits: [
            { id: 'shell-router-seam', score: 0.94 },
            { id: 'token-system-vx', score: 0.88 },
          ],
        },
      },
      { type: 'source', url: 'https://basalt-ui.com/docs/shell', title: 'App shell & router seam' },
      {
        type: 'source',
        url: 'https://basalt-ui.com/docs/tokens',
        title: 'The --vx-* token system',
      },
      ...tokens(
        `Based on the docs, **${input}** comes down to two pieces:\n\n` +
          `1. The shell stays **router-agnostic** — you wire \`active\`/\`renderNavLink\` from your ` +
          `own router at the seam.\n` +
          `2. Colors resolve through the central \`--vx-*\` variables, so chrome and charts share ` +
          `one scheme-reactive identity.\n\n` +
          `See the two cited pages above for the full contract.\n`,
      ),
    ],
  },
  {
    value: 'reasoning',
    label: 'Reasoning-heavy',
    hint: 'A longer multi-step reasoning block, then a short final answer.',
    parts: (input: string) => [
      { type: 'reasoning', text: `Breaking "${input}" into steps.\n` },
      { type: 'reasoning', text: '1. Identify the constraint that actually moves the result.\n' },
      { type: 'reasoning', text: '2. Discard the options that violate it.\n' },
      { type: 'reasoning', text: '3. Pick the simplest survivor and sanity-check the edges.\n' },
      ...tokens(
        `Short version: optimize for the **constraint that binds**, then take the simplest option ` +
          `that respects it. Everything else is noise.\n`,
      ),
    ],
  },
  {
    value: 'error',
    label: 'Error mid-stream',
    hint: 'Streams a little, then throws — proves the error status + in-thread error rendering.',
    fail: true,
    parts: () => [...tokens('Starting to answer…\n\nPulling the relevant context together')],
  },
] as const satisfies readonly AgentScenario[]

// ── Transport factory ───────────────────────────────────────────────────────────

/** Wrap a scenario + speed into an abortable streaming AgentTransport. */
export function scenarioTransport(
  scenario: AgentScenario,
  speed: StreamSpeed,
): AgentTransport<AgentPart, string> {
  return {
    async *stream(input: string, signal?: AbortSignal): AsyncGenerator<AgentPart> {
      for (const part of scenario.parts(input)) {
        if (signal?.aborted) return
        await sleep(DELTA_DELAY[speed], signal)
        if (signal?.aborted) return
        yield part
      }
      if (scenario.fail) {
        await sleep(DELTA_DELAY[speed] * 4, signal)
        if (signal?.aborted) return
        throw new Error('Simulated upstream failure (503) — the model endpoint timed out.')
      }
    },
  }
}
