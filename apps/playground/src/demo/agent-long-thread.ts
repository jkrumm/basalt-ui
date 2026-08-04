/**
 * agent-long-thread — a deterministic, genuinely variable-height 500-message thread backing the
 * virtualization gate demo (`AgentTranscriptVirtualizeDemoPage`).
 *
 * Three things this generator is deliberately shaped to exercise, all at once:
 *  - VARIABLE row heights (one-line acks, bulleted medium replies, long fenced-code deep-dives) —
 *    uniform rows would hide a `measureElement` regression in the virtualizer.
 *  - Consecutive same-author runs both INSIDE the 5-minute grouping window (role chrome collapses)
 *    and just OUTSIDE it (role chrome stays), so the Slack-rhythm boundary is actually exercised,
 *    not just the common alternating-speaker case.
 *  - Old-to-new timestamps spread across real hours, so `formatRelativeTime` reads naturally
 *    ("3 hours ago", not a wall of "just now").
 */
import type { ChatMessage } from 'basalt-ui/agent'

const SHORT_REPLIES = [
  'Got it — will do.',
  'That looks right to me.',
  'Confirmed, no issues.',
  'No blockers on my end.',
  'Makes sense, thanks.',
] as const

function mediumReply(n: number): string {
  return (
    `Here's a quick rundown for item #${n}:\n\n` +
    `- Checked the current implementation\n` +
    `- Confirmed the edge case around empty input\n` +
    `- No regressions in the existing test suite\n\n` +
    `Let me know if you want a deeper look at any of these.`
  )
}

function longReply(n: number): string {
  return (
    `## Deep dive — item #${n}\n\n` +
    `This one took a bit longer to trace through. The root cause sits in how the accumulator ` +
    `merges partial updates: when two deltas arrive in the same tick, the second overwrites the ` +
    `first instead of appending.\n\n` +
    '```ts\n' +
    `function merge(parts: Part[], next: Part): Part[] {\n` +
    `  const index = parts.findIndex((p) => p.id === next.id)\n` +
    `  if (index === -1) return [...parts, next]\n` +
    `  const copy = [...parts]\n` +
    `  copy[index] = next // should append text, not replace it\n` +
    `  return copy\n` +
    `}\n` +
    '```\n\n' +
    `A few follow-ups worth tracking separately:\n\n` +
    `1. Add a regression test for the same-tick double-delta case.\n` +
    `2. Audit the other three call sites that share this helper.\n` +
    `3. Document the invariant so the next person doesn't reintroduce it.\n\n` +
    `None of this blocks the current release — flagging it for the next pass.`
  )
}

const SHORT_PROMPT_TEMPLATES = [
  'Ship it?',
  'Any concerns?',
  'Status on #%d?',
  'Still good?',
] as const

function pickPrompt(turn: number): string {
  // Non-null: `turn % SHORT_PROMPT_TEMPLATES.length` is always in bounds for this fixed literal array.
  const template = SHORT_PROMPT_TEMPLATES[turn % SHORT_PROMPT_TEMPLATES.length]!
  return template.includes('%d') ? template.replace('%d', String(turn)) : template
}

function pickReply(turn: number): string {
  const mod = turn % 3
  // Non-null: same in-bounds-by-construction reasoning as pickPrompt above.
  if (mod === 0) return SHORT_REPLIES[turn % SHORT_REPLIES.length]!
  if (mod === 1) return mediumReply(turn)
  return longReply(turn)
}

function pickFollowUp(turn: number): string {
  return SHORT_REPLIES[turn % SHORT_REPLIES.length]!
}

function textPart(text: string): { id: string; type: 'text'; text: string } {
  return { id: crypto.randomUUID(), type: 'text', text }
}

function makeMessage(role: ChatMessage['role'], createdAt: number, text: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    parts: [textPart(text)],
    createdAt,
    ...(role === 'assistant' ? { finish: 'complete' as const } : {}),
  }
}

const GROUPED_GAP_MS = 90_000 // 1.5 min — inside the 5-min grouping window
const UNGROUPED_GAP_MS = 6 * 60_000 // 6 min — just outside it
const REPLY_GAP_MS = 2 * 60_000
const TURN_GAP_MS = 22 * 60_000

/**
 * Builds `count` messages (oldest first) — a long-running thread that started roughly
 * `count * ~26min` in the past and ends "just now"-ish, cycling through six turn shapes so both
 * grouped and ungrouped consecutive-same-author runs occur, alongside short/medium/long replies.
 */
export function buildLongThread(count: number): ChatMessage[] {
  const messages: ChatMessage[] = []
  // This starting point is only a rough headroom guess — it does not need to land the newest
  // message near "now" on its own, because every timestamp is shifted by one offset after
  // generation (below) so the newest message lands at/just before `Date.now()` regardless of how
  // the cycle mix actually plays out.
  let cursor = Date.now() - count * TURN_GAP_MS
  let turn = 0

  while (messages.length < count) {
    const cycle = turn % 6

    messages.push(makeMessage('user', cursor, pickPrompt(turn)))
    cursor += GROUPED_GAP_MS

    // Grouped user follow-up: same role, well inside the 5-minute window.
    if (cycle === 1 && messages.length < count) {
      messages.push(makeMessage('user', cursor, `Actually, one more thing — ${pickPrompt(turn)}`))
      cursor += GROUPED_GAP_MS
    }

    cursor += REPLY_GAP_MS
    if (messages.length < count) {
      messages.push(makeMessage('assistant', cursor, pickReply(turn)))
    }

    if (cycle === 3 && messages.length < count) {
      // Grouped assistant follow-up: same role, inside the window.
      cursor += GROUPED_GAP_MS
      messages.push(makeMessage('assistant', cursor, `One more note: ${pickFollowUp(turn)}`))
    } else if (cycle === 4 && messages.length < count) {
      // Same role, but OUTSIDE the window — proves the boundary, not just the common case.
      cursor += UNGROUPED_GAP_MS
      messages.push(
        makeMessage('assistant', cursor, `Coming back after a pause — ${pickFollowUp(turn)}`),
      )
    }

    cursor += TURN_GAP_MS
    turn += 1
  }

  const sliced = messages.slice(0, count)

  // Shift every timestamp by one offset so the newest message lands at/just before `Date.now()` —
  // a post-generation correction rather than a retuned constant, so it stays correct even if the
  // cycle mix above changes later (unlike the previous headroom guess, which assumed a worst case
  // that didn't hold: cycle 0 alone emits 2 messages per turn, not 1, so the demo's newest message
  // was landing days in the past instead of "just now").
  const newest = sliced.at(-1)
  if (newest === undefined) return sliced
  const shift = Date.now() - newest.createdAt
  return sliced.map((message) => ({ ...message, createdAt: message.createdAt + shift }))
}
