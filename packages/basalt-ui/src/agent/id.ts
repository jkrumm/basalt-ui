/**
 * Id-minting helpers shared across the agent layer: `mintThreadId` (a low-stakes client-side id —
 * threads, run/chat namespaces — used by `./thread`'s `createThreadsStore`, `./adapter`'s
 * `createAdapterThreadsStore`/`threadsStoreAdapterContract`, `./use-agent-stream`'s per-send run
 * id, and `aiSdkTransport`'s fixed chat id), `mintMessageId` (the higher-stakes id `appendMessage`
 * treats as its only idempotency key), and `withPartIds` (stamps sequence ids onto streamed
 * parts). Grouped here because they're the id-minting leaves every store/hook/transport in this
 * layer sits above — not because they share a mechanism (`mintMessageId` deliberately diverges
 * from `mintThreadId` on rung 3; see its own doc).
 */

/**
 * Hand-assembles a UUIDv4 string from 16 random bytes — the shared rung-2 mechanism both
 * `mintThreadId` and `mintMessageId` use once `crypto.randomUUID` is unavailable but
 * `crypto.getRandomValues` still is. The version/variant bits are set per RFC 4122, since this
 * rung hands back raw bytes, not a formatted UUID.
 */
function assembleUuidV4(bytes: Uint8Array): string {
  const hex = Array.from({ length: 16 }, (_, i) => {
    const raw = bytes.at(i) ?? 0
    // Version 4 (bits 12-15 of time_hi_and_version) and variant 10 (bits 6-7 of
    // clock_seq_hi_and_reserved) — the only structure a UUIDv4 promises over raw random bytes.
    const byte = i === 6 ? (raw & 0x0f) | 0x40 : i === 8 ? (raw & 0x3f) | 0x80 : raw
    return byte.toString(16).padStart(2, '0')
  }).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * Mints a client-side id for a LOW-COLLISION-COST use: a thread id, a per-send run-id namespace, a
 * fixed chat id — anything minted client-side that is NOT the idempotency key some write depends
 * on. `crypto.randomUUID()` exists only in SECURE CONTEXTS (HTTPS or localhost) — a consumer served
 * over plain HTTP on a LAN hostname (a homelab dashboard on a bare IP, a staging box) would
 * otherwise have `create()`, about the most basic user action a thread store has, throw a plain
 * TypeError. A store used from a browser must not throw on a user gesture — the same principle
 * already applied twice this release (`spliceText` clamps rather than throws, `coalesceParts`
 * degrades rather than throws).
 *
 * Fallback chain, each rung reached only when the one above it is unavailable:
 *   1. `crypto.randomUUID()` — cryptographically random, RFC 4122 UUID. The normal path.
 *   2. `crypto.getRandomValues()` — still cryptographically random; hand-assembled into a UUIDv4
 *      via `assembleUuidV4`.
 *   3. No usable `crypto` at all (missing entirely, or missing both methods above — an old WebView,
 *      an SSR shim). NOT cryptographically random and NOT collision-resistant in general. This rung
 *      exists solely so a caller never throws on such a host. It is acceptable ONLY because an id
 *      minted here is minted a handful of times per client session and is not the idempotency key
 *      any write depends on — `ThreadsStoreAdapter.appendMessage`'s idempotency key is the MESSAGE
 *      id (see `mintMessageId`), not this one, so a collision on this rung costs a locally
 *      merged/duplicated thread (or two runs sharing a part-id namespace), not silent data loss on
 *      the append path. Do not reuse this rung for anything with a higher collision cost than that
 *      — see `mintMessageId` for the id that needs one.
 */
export function mintThreadId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return assembleUuidV4(crypto.getRandomValues(new Uint8Array(16)))
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/**
 * Mints a message id — the value `ThreadsStoreAdapter.appendMessage` treats as its ONLY
 * idempotency key (see that method's contract doc in `./adapter`). Shares `mintThreadId`'s rungs
 * 1-2 (`crypto.randomUUID()`, then `crypto.getRandomValues()` assembled into a UUIDv4) — both are
 * cryptographically random and collision-resistant, and rung 2 is the fix that actually matters in
 * practice (a plain-HTTP/LAN host still has `getRandomValues`; only `randomUUID` is secure-context-
 * gated).
 *
 * Rung 3 deliberately DIVERGES from `mintThreadId`: it THROWS instead of degrading to a
 * non-random fallback. A thread id's rung-3 collision costs a locally merged/duplicated thread —
 * annoying, recoverable, visible. A message id's collision cost is different IN KIND, not degree:
 * `appendMessage` is idempotent on this id, so two messages that collide are not two rows, they
 * are ONE — the second write silently no-ops and its content is gone, with nothing downstream able
 * to tell. Degrading here would trade a loud, debuggable failure for silent, permanent data loss.
 *
 * This deliberately diverges from this layer's other standing rule — render-path code degrades,
 * never throws (`spliceText` clamps, `coalesceParts` degrades, a consumer fence renderer must not
 * take the message down) — because minting a message id is NOT render-path code. It runs once, in
 * the write path that constructs a message before handing it to a store (`start()`,
 * `consumeAndFinalize`'s finalize step, `finalizeStop`, `aiSdkTransport`'s per-turn user message),
 * never inside the per-chunk accumulation/render loop those functions guard. A host with no usable
 * `crypto` at all (missing both `randomUUID` and `getRandomValues`) is vanishingly rare — no
 * runtime with a DOM/fetch surface worth targeting ships without a Crypto object — and an uncaught
 * throw here is a loud, debuggable failure rather than a message silently vanishing with no trace,
 * but WHERE it surfaces differs by call site (audited, not assumed — this paragraph previously
 * claimed a single shared catch handled all of them, which was false):
 *   - `consumeAndFinalize`'s own assistantMessage mint runs inside that function's try/catch, so a
 *     throw there is correctly turned into `onFailureStatus` ('error' from `start()`, 'interrupted'
 *     from the mount-time resume) — a visibly stuck-then-settled run, as originally claimed.
 *   - `useAgentThreadRuns.start()`'s userMessage mint runs BEFORE any state is touched
 *     (`appendMessage`/`setStatus`/the controller registration all come after it), so a throw there
 *     is a true no-op that propagates synchronously out of `start()` itself — not a stuck run at
 *     all, since nothing ever started. See `UseAgentThreadRunsReturn.start`'s `@throws` doc.
 *   - `finalizeStop`'s stoppedMessage mint is wrapped in its own try/catch precisely so a throw
 *     here cannot wedge the thread at 'streaming' forever (stop() has already torn down this run's
 *     bookkeeping by the time finalizeStop runs, so a second stop() is always a no-op) — see
 *     `finalizeStop`'s doc for the guarded behavior and the resulting 'error' status.
 * A stuck spinner is debuggable; silently discarded chat history is not — that half of the
 * original claim stands regardless of which of the three paths above catches it.
 *
 * @throws {Error} when neither `crypto.randomUUID` nor `crypto.getRandomValues` is available.
 */
export function mintMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return assembleUuidV4(crypto.getRandomValues(new Uint8Array(16)))
  }
  throw new Error(
    'mintMessageId: no usable crypto (both randomUUID and getRandomValues are unavailable) — ' +
      'refusing to mint a non-random message id, since ThreadsStoreAdapter.appendMessage treats ' +
      'this id as its only idempotency key and a collision would silently drop a message.',
  )
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
