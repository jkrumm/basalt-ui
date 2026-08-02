/**
 * withPartIds — stamps a stable id onto every draft part arriving without one.
 *
 * A transport is allowed to yield a draft (`AgentPartDraft` — `id` optional); this wraps such a
 * generator and normalizes it into a fully-identified stream, minting `${runId}#${n}` for any
 * part that arrives without an `id`. A part that already carries an id passes through untouched
 * (idempotent) and does not advance the counter.
 *
 * @example
 * const identified = withPartIds(runId, transport.stream(input, signal))
 * for await (const part of identified) {
 *   // part.id is always defined here
 * }
 */
export async function* withPartIds<TPart extends { id?: string }>(
  runId: string,
  source: AsyncGenerator<TPart>,
): AsyncGenerator<TPart & { id: string }> {
  let n = 0
  for await (const part of source) {
    if (part.id !== undefined) {
      yield part as TPart & { id: string }
      continue
    }
    yield { ...part, id: `${runId}#${n}` }
    n += 1
  }
}
