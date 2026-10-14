/**
 * agent-scenarios — a deterministic, in-memory `AgentTransport` for the `/agent` Stream tab and the
 * `chat-profile` evidence lane. No network, no model: `richTransport` replays one fixed ~1500-word
 * reply (reasoning, markdown with lists and a link, a ts fence, a mermaid fence, an alert, a tool
 * call) as ~105 deltas, one per `DELTA_MS`, so a run lasts ~3 s. Every part carries a content-stable
 * id, so a replay is byte-identical.
 */
import type { AgentPart } from 'basalt-ui/agent'

export const DELTA_MS = 28
const TARGET_DELTAS = 105

const SENTENCES = [
  'A deep module hides a large amount of behavior behind a small interface, so callers learn one entry point instead of assembling primitives.',
  'Coupling drops because the caller can no longer depend on anything the interface does not promise.',
  'Shallow wrappers do the opposite: they forward every argument, expose every internal, and add a layer without removing a decision.',
  'The test of a boundary is what changes when the implementation does, and a good boundary changes nothing outside itself.',
  'Contracts are cheaper to review than implementations, which is why the interface deserves the careful human attention.',
  'When two modules share a data shape they did not agree on, every change to one becomes a negotiation with the other.',
  'Injecting dependencies at the seam lets a test adapter replace a production adapter without a mock framework in between.',
  'Tests that go through the public interface survive refactors, because they describe behavior instead of structure.',
]

const paragraph = (index: number): string =>
  Array.from({ length: 5 }, (_, i) => SENTENCES[(index + i * 3) % SENTENCES.length]).join(' ')

const REASONING =
  'The question is about coupling. The honest answer needs a snippet, a diagram and one tool lookup, then a longer discussion. Streaming all of it now.'

const FIRST_TEXT =
  `## Deep modules and coupling\n\n` +
  `${paragraph(0)}\n\n` +
  `Three properties do most of the work:\n\n` +
  `- **A narrow interface.** Fewer entry points means fewer ways to depend on the module.\n` +
  `- **Hidden state.** Callers cannot reach what is not exported, so they cannot couple to it.\n` +
  `- **One owner per decision.** The module that knows the answer is the only one that stores it.\n\n` +
  `${paragraph(1)}\n\n` +
  `The original argument is in [A Philosophy of Software Design](https://example.com/philosophy-of-software-design), ` +
  `and the short version is that complexity lives in the dependencies between modules.\n\n` +
  `${paragraph(2)}\n\n` +
  `A small example, a module whose whole surface is one function:\n\n` +
  '```ts\n' +
  `export type Clock = { now: () => number }\n\n` +
  `export function createThrottle(clock: Clock, intervalMs: number) {\n` +
  `  let last = Number.NEGATIVE_INFINITY\n` +
  `  return function allow(): boolean {\n` +
  `    const now = clock.now()\n` +
  `    if (now - last < intervalMs) return false\n` +
  `    last = now\n` +
  `    return true\n` +
  `  }\n` +
  `}\n` +
  '```\n\n' +
  `${paragraph(3)}\n\n` +
  `${paragraph(4)}\n\n` +
  `${paragraph(6)}\n\n` +
  `${paragraph(1)}\n\n`

const SECOND_TEXT =
  `The tool result above confirms the rule of thumb. Here is how the pieces relate:\n\n` +
  '```mermaid\n' +
  `flowchart LR\n` +
  `  Caller --> Interface\n` +
  `  Interface --> Impl[Implementation]\n` +
  `  Impl --> Store[(State)]\n` +
  `  Test[Test adapter] -.-> Interface\n` +
  '```\n\n' +
  `> [!NOTE]\n` +
  `> A module is deep when its interface is much smaller than its implementation. Measure the ratio, not the line count.\n\n` +
  `${paragraph(5)}\n\n` +
  `What to do on Monday:\n\n` +
  `1. Pick the module with the most importers and list what each one actually uses.\n` +
  `2. Delete every export nobody uses, then merge the wrappers that only forward.\n` +
  `3. Move the one decision that leaked into callers back behind the interface.\n\n` +
  `${paragraph(6)}\n\n` +
  `${paragraph(7)}\n\n` +
  `${paragraph(0)}\n\n` +
  `${paragraph(2)}\n\n` +
  `${paragraph(3)}\n`

const TOOL_INPUT = { query: 'deep modules coupling', limit: 3 }
const TOOL_OUTPUT = {
  hits: [
    { id: 'deep-modules', score: 0.96 },
    { id: 'ports-and-adapters', score: 0.9 },
  ],
}

const wordCount = (text: string): number => (text.match(/\S+/g) ?? []).length

/** Words per delta so the whole reply lands in ~`TARGET_DELTAS` emissions. */
const WORDS_PER_DELTA = Math.ceil((wordCount(FIRST_TEXT) + wordCount(SECOND_TEXT)) / TARGET_DELTAS)

/** Split into word-sized-ish deltas, whitespace attached, like a real token stream. */
function chunks(text: string, wordsPerChunk: number): string[] {
  const words = text.match(/\S+\s*/g) ?? []
  const out: string[] = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    out.push(words.slice(i, i + wordsPerChunk).join(''))
  }
  return out
}

/** The ordered part emissions of the reply. Deltas of one block share an id and append. */
export function richParts(): AgentPart[] {
  const out: AgentPart[] = []
  for (const text of chunks(REASONING, 8))
    out.push({ id: 'rich-reasoning', type: 'reasoning', text })
  for (const text of chunks(FIRST_TEXT, WORDS_PER_DELTA)) {
    out.push({ id: 'rich-text-1', type: 'text', text })
  }
  out.push({
    id: 'rich-tool',
    type: 'tool',
    toolCallId: 'rich-tool-call',
    toolName: 'search_docs',
    state: 'input-available',
    input: TOOL_INPUT,
  })
  out.push({
    id: 'rich-tool',
    type: 'tool',
    toolCallId: 'rich-tool-call',
    toolName: 'search_docs',
    state: 'output-available',
    input: TOOL_INPUT,
    output: TOOL_OUTPUT,
  })
  for (const text of chunks(SECOND_TEXT, WORDS_PER_DELTA)) {
    out.push({ id: 'rich-text-2', type: 'text', text })
  }
  return out
}

/** Resolves after `ms`, or early when the signal aborts — the generator's own guard then returns. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

/** Structurally an `AgentTransport<AgentPart, string>` (the type itself is not on the barrel). */
export const richTransport = {
  async *stream(_input: string, signal?: AbortSignal): AsyncGenerator<AgentPart> {
    for (const part of richParts()) {
      await sleep(DELTA_MS, signal)
      if (signal?.aborted) return
      yield part
    }
  },
}
