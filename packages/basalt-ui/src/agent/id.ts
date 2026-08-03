/**
 * Id-minting helpers shared by the thread stores: `mintThreadId` (a client-side thread id, used by
 * both `./thread`'s `createThreadsStore` and `./adapter`'s `createAdapterThreadsStore`) and
 * `withPartIds` (stamps sequence ids onto streamed parts). Related in theme — both mint an id a
 * store needs — unrelated in mechanism; grouped here because they're the two id-minting leaves the
 * two thread stores both sit above.
 */

/**
 * Mints a client-side thread id. `crypto.randomUUID()` exists only in SECURE CONTEXTS (HTTPS or
 * localhost) — a consumer served over plain HTTP on a LAN hostname (a homelab dashboard on a bare
 * IP, a staging box) would otherwise have `create()`, about the most basic user action a thread
 * store has, throw a plain TypeError. A store used from a browser must not throw on a user gesture
 * — the same principle already applied twice this release (`spliceText` clamps rather than throws,
 * `coalesceParts` degrades rather than throws).
 *
 * Fallback chain, each rung reached only when the one above it is unavailable:
 *   1. `crypto.randomUUID()` — cryptographically random, RFC 4122 UUID. The normal path.
 *   2. `crypto.getRandomValues()` — still cryptographically random; hand-assembled into a UUIDv4
 *      (the version/variant bits are set per RFC 4122, since this rung hands back raw bytes, not a
 *      formatted UUID).
 *   3. No usable `crypto` at all (missing entirely, or missing both methods above — an old WebView,
 *      an SSR shim). NOT cryptographically random and NOT collision-resistant in general. This rung
 *      exists solely so `create()` never throws on such a host. It is acceptable ONLY because this
 *      id is minted a handful of times per client session and is not the idempotency key any write
 *      here depends on — `ThreadsStoreAdapter.appendMessage`'s idempotency key is the MESSAGE id,
 *      not this thread id, so a collision on this rung costs a locally merged/duplicated thread, not
 *      silent data loss on the append path. Do not reuse this rung for anything with a higher
 *      collision cost than that.
 */
export function mintThreadId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    const hex = Array.from({ length: 16 }, (_, i) => {
      const raw = bytes.at(i) ?? 0
      // Version 4 (bits 12-15 of time_hi_and_version) and variant 10 (bits 6-7 of
      // clock_seq_hi_and_reserved) — the only structure a UUIDv4 promises over raw random bytes.
      const byte = i === 6 ? (raw & 0x0f) | 0x40 : i === 8 ? (raw & 0x3f) | 0x80 : raw
      return byte.toString(16).padStart(2, '0')
    }).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

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
