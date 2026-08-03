/**
 * withPartIds — stamps a stable id onto every draft part arriving without one.
 *
 * A transport is allowed to yield a draft (`AgentPartDraft` — `id` optional); this wraps such a
 * generator and normalizes it into a fully-identified stream, minting `${runId}#${n}` for any
 * part that arrives without an `id`. A part that already carries an id passes through untouched
 * (idempotent) and does not advance the counter.
 *
 * NOT a replay-convergence mechanism. The minted id is a bare per-call sequence number with no
 * relationship to content or offset — it identifies "the nth id-less part THIS invocation saw",
 * nothing more. Calling `withPartIds` again over a resumed/replayed stream restarts its counter at
 * 0, so the resumed stream's first delta mints the SAME id as the original run's first delta
 * (`${runId}#0`) regardless of whether it carries the same content — if the resumed transport
 * re-sends the full text as one chunk while the original sent it as several deltas, mergePart's
 * tail-splice will corrupt the accumulated text rather than converge it. A transport that needs
 * genuine replay convergence (one asserting `ResumableAgentTransport`'s `idempotentReplay: true`)
 * MUST mint its own content-stable ids — e.g. `aiSdkTransport`'s `${chatId}#${index}` /
 * `tool#${toolCallId}` — and must not rely on this helper for that guarantee. Combining
 * `withPartIds` with a transport that asserts `idempotentReplay: true` is only safe when that
 * transport already mints stable ids itself, in which case every part already carries an `id` and
 * `withPartIds` is a no-op passthrough (see the idempotent behavior above) — it is never the thing
 * providing replay safety.
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
