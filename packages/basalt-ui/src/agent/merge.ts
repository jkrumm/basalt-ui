/**
 * mergePart — identity-addressed accumulator over an AgentPart array.
 *
 * Appending a part whose `id` is already present in `parts` REWRITES that entry in place rather
 * than pushing a duplicate — ordering stays stable (a rewritten part keeps its original position).
 * `text`/`reasoning` splice the incoming delta into the existing text at `next.offset` (an
 * undefined offset means "append at the tail"); every other variant replaces wholesale.
 *
 * The invariant this holds, and the reason `offset` exists at all: replaying a whole run from
 * character 0 rebuilds the identical parts array it produced the first time — it cannot double
 * it. Splicing a full-length delta at offset 0 overwrites the existing text in place (the
 * trailing slice covers nothing once the incoming text's length matches what's already there),
 * so a resumed/replayed stream converges instead of duplicating content.
 *
 * @example
 * let parts: AgentPart[] = []
 * parts = mergePart(parts, { id: 'p1', type: 'text', text: 'Hel' })
 * parts = mergePart(parts, { id: 'p1', type: 'text', text: 'lo' }) // splices at the tail
 * // parts === [{ id: 'p1', type: 'text', text: 'Hello' }]
 */
import type { AgentPart, ReasoningPart, TextPart } from './parts'

type TextLike = TextPart | ReasoningPart

function isTextLikeType(type: AgentPart['type']): type is TextLike['type'] {
  return type === 'text' || type === 'reasoning'
}

/** Splices `next`'s text into `existing`'s text at `next.offset` (tail-append when undefined). */
function spliceText(existing: TextLike, next: TextLike): string {
  const offset = next.offset ?? existing.text.length
  return existing.text.slice(0, offset) + next.text + existing.text.slice(offset + next.text.length)
}

export function mergePart<TPart extends AgentPart>(parts: readonly TPart[], next: TPart): TPart[] {
  const index = parts.findIndex((part) => part.id === next.id)
  if (index === -1) return [...parts, next]

  const existing = parts[index] as TPart
  const spliceable = existing.type === next.type && isTextLikeType(next.type)

  const merged: TPart = spliceable
    ? ({
        ...next,
        text: spliceText(existing as unknown as TextLike, next as unknown as TextLike),
      } as TPart)
    : next

  const out = parts.slice()
  out[index] = merged
  return out
}
