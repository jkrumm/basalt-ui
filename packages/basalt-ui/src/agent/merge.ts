/**
 * mergePart — identity-addressed accumulator over a part array.
 *
 * Appending a part whose `id` is already present in `parts` REWRITES that entry in place rather
 * than pushing a duplicate — ordering stays stable (a rewritten part keeps its original position).
 * `text`/`reasoning` splice the incoming delta into the existing text at `next.offset` (an
 * undefined offset means "append at the tail", and an out-of-range one is clamped rather than
 * honoured — see `spliceText` for the exact supported shapes); every other variant — including any
 * `ForeignPart`, which is never text-like — replaces wholesale. A FIRST insertion of a text-like
 * part goes through the same splice against an empty text, so an offset that claims a prefix this
 * accumulator never saw is clamped and warned about there too — never honoured, never padded.
 *
 * The invariant this holds, and the reason `offset` exists at all: replaying a whole run from
 * character 0 rebuilds the identical parts array it produced the first time — it cannot double
 * it. Splicing a full-length delta at offset 0 overwrites the existing text in place (the
 * trailing slice covers nothing once the incoming text's length matches what's already there),
 * so a resumed/replayed stream converges instead of duplicating content.
 *
 * Constrained on `PartLike` (structural: `id` + `type`), NOT `AgentPart` — a widened, backward-
 * compatible relaxation so `TranscriptPart` (`AgentPart | ForeignPart`, ./foreign) flows through
 * the same accumulator a transport-streamed foreign part must pass through on its way from the
 * transport into `useAgentThreadRuns`'s `runs` map. `AgentPart`'s closed union is untouched —
 * only the constraint widens, never the union itself.
 *
 * @example
 * let parts: AgentPart[] = []
 * parts = mergePart(parts, { id: 'p1', type: 'text', text: 'Hel' })
 * parts = mergePart(parts, { id: 'p1', type: 'text', text: 'lo' }) // splices at the tail
 * // parts === [{ id: 'p1', type: 'text', text: 'Hello' }]
 */
import type { ReasoningPart, TextPart } from './parts'
import { isDev } from '../common/is-dev'

type TextLike = TextPart | ReasoningPart

/** The structural bound `mergePart` (and the hooks that call it) actually need — an `AgentPart` or
 * a `ForeignPart` both satisfy it, so this is the widened constraint, not a new closed union. */
export type PartLike = { readonly id: string; readonly type: string }

// Widened from `AgentPart['type']` to `string`: a plain type-predicate narrowing, so accepting a
// wider input (any string, including a ForeignPart's) is safe — it still only returns true for the
// two text-like literals, and a ForeignPart's type string always falls through it to the
// wholesale-replace path below.
function isTextLikeType(type: string): type is TextLike['type'] {
  return type === 'text' || type === 'reasoning'
}

/**
 * Splices `next`'s text into `existingText` at `next.offset`. Exactly two shapes are supported,
 * and they are the only two any basalt transport emits (`diffPart` always sets
 * `offset = prevText.length`; `diffChunkStream` restarts its accumulator per call):
 *
 * 1. **append at the end** — `offset` undefined, or equal to `existingText.length`;
 * 2. **in-range replace** — `0 <= offset <= existingText.length`, overwriting the span the
 *    incoming text covers (this is what makes an offset-0 full replay converge instead of double).
 *
 * An offset outside that range — negative, past the current length, or non-finite — is **clamped**
 * into `[0, existingText.length]`, not honoured and not thrown on. A throw here would turn a
 * transient wire anomaly into a permanently dead transcript; this is stream-reduction code on the
 * render path. Each clamp is announced in dev.
 *
 * A FIRST insertion (no entry with this id yet) runs through here too, against an empty
 * `existingText`: the stored text is the incoming text either way, but a nonzero offset — the wire
 * claiming text this accumulator never saw — is clamped to 0 and announced like any other
 * out-of-range value rather than passing silently. `mergePart` never invents the missing prefix.
 *
 * Note what is NOT special-cased: an out-of-order delta whose offset is still in range is an
 * ordinary in-range replace, so it overwrites whatever already occupies that span. `mergePart`
 * has no way to tell a stale delta from a deliberate rewrite, and inventing one would break the
 * offset-0 replay convergence this whole mechanism exists for.
 */
function spliceText(existingText: string, next: TextLike): string {
  const offset = clampOffset(next.offset ?? existingText.length, existingText.length)
  return existingText.slice(0, offset) + next.text + existingText.slice(offset + next.text.length)
}

/** Clamps a wire offset into `[0, length]`, warning in dev when the raw value was out of range. */
function clampOffset(offset: number, length: number): number {
  // A non-finite offset would make every slice() return '' and blank the part outright — it is
  // out of range like any other, and appending is the safe reading of "position unknown".
  const clamped = Number.isFinite(offset) ? Math.min(Math.max(offset, 0), length) : length
  if (clamped !== offset && isDev()) {
    console.warn(
      `[basalt] mergePart: text offset ${offset} out of range [0, ${length}] — clamped to ${clamped}`,
    )
  }
  return clamped
}

export function mergePart<TPart extends PartLike>(parts: readonly TPart[], next: TPart): TPart[] {
  const index = parts.findIndex((part) => part.id === next.id)
  const existing = index === -1 ? undefined : (parts[index] as TPart)

  // A first insertion of a text-like part is spliced too — against an empty existing text — so the
  // offset contract is one path with one set of rules: same clamp, same dev warning, and the same
  // stored result (`'' + next.text`) an unconditional append would have produced.
  const spliceable =
    isTextLikeType(next.type) && (existing === undefined || existing.type === next.type)

  const merged: TPart = spliceable
    ? ({
        ...next,
        text: spliceText(
          existing === undefined ? '' : (existing as unknown as TextLike).text,
          next as unknown as TextLike,
        ),
      } as TPart)
    : next

  if (existing === undefined) return [...parts, merged]

  const out = parts.slice()
  out[index] = merged
  return out
}
