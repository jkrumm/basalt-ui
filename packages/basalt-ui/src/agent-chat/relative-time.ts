/**
 * formatRelativeTime — dependency-free relative-time formatting (no date-fns).
 *
 * Shared between `ThreadOutcomeCard` (inbox row timestamps) and `ThreadTranscript` (per-message
 * timestamps). 'en'-hardcoded for now — see the module-level note below for the deferred locale
 * seam.
 *
 * Internal to `agent-chat/` — not part of the public barrel.
 */
import { isDev } from '../utils/is-dev'

const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const RELATIVE_TIME_UNITS: readonly {
  readonly unit: Intl.RelativeTimeFormatUnit
  readonly ms: number
}[] = [
  { unit: 'year', ms: 31_536_000_000 },
  { unit: 'month', ms: 2_628_000_000 },
  { unit: 'week', ms: 604_800_000 },
  { unit: 'day', ms: 86_400_000 },
  { unit: 'hour', ms: 3_600_000 },
  { unit: 'minute', ms: 60_000 },
]

/**
 * Formats an epoch-ms timestamp as a short relative string ("3 hours ago", "just now").
 *
 * A non-finite `timestamp` — `NaN`, `±Infinity`, or a non-number value that slipped past the
 * `ChatMessage.createdAt: number` type at runtime (an ISO string or `undefined`/`null` from a
 * hand-rolled `ThreadsStoreAdapter`, or from JSON-deserialized `localStorage` state) renders as an
 * empty string rather than reaching `Intl.RelativeTimeFormat.format`, which throws a `RangeError`
 * on any non-finite input. This is render-path code — one bad `createdAt` on one message must not
 * blank the whole transcript (the standing rule `spliceText`/`coalesceParts` already hold) — so it
 * degrades instead of throwing, and warns in dev, matching `mergePart`'s clamp-and-warn precedent
 * (`clampOffset` in `../agent/merge.ts`). The warning is NOT deduplicated, also matching that
 * precedent — but note the call sites differ: `clampOffset` runs once per wire event, whereas this
 * runs during render, once per message, so a single bad `createdAt` in a long transcript warns
 * once per message per render. That is loud on purpose (a `createdAt` that isn't a number is an
 * adapter bug worth fixing, not worth muting), and it costs nothing in production.
 */
export function formatRelativeTime(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    if (isDev()) {
      console.warn(
        `[basalt] formatRelativeTime: non-finite timestamp ${String(timestamp)} — rendering empty string`,
      )
    }
    return ''
  }
  const diffMs = timestamp - Date.now()
  const absMs = Math.abs(diffMs)
  if (absMs < 60_000) return 'just now'
  const unit = RELATIVE_TIME_UNITS.find(({ ms }) => absMs >= ms) ?? RELATIVE_TIME_UNITS.at(-1)!
  return RELATIVE_TIME_FORMAT.format(Math.round(diffMs / unit.ms), unit.unit)
}
