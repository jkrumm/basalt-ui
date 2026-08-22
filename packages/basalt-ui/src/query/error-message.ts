/**
 * Transport-agnostic error decoding. Deliberately a standalone module with NO
 * `@tanstack/react-query` import — `dashboard/query-state.tsx` renders server messages and must
 * not drag the query peer into the root barrel's graph to do it.
 */

/**
 * The HTTP status behind a thrown envelope (Eden Treaty's `{ status, value }`, a `Response`-shaped
 * throw), when there is one. Use it to BRANCH — 404 → "not found" copy — rather than to build a
 * message; `toErrorMessage` already folds the status into its text when the body says nothing.
 *
 * @example
 * if (errorStatus(err) === 404) return <EmptyState title="Gone" />
 */
export function errorStatus(err: unknown): number | undefined {
  if (err === null || typeof err !== 'object') return undefined
  const status = (err as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

/** Strings that technically decoded but tell a reader nothing. `JSON.stringify` produces most. */
const UNUSABLE = new Set(['', '{}', '[]', 'null', 'undefined', '[object Object]'])

function decode(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>
    if (typeof obj['message'] === 'string') return obj['message']
    // Eden-style { value: ... } or { status, value } envelopes — unwrap one level.
    if ('value' in obj) return decode(obj['value'])
  }
  try {
    return JSON.stringify(err) ?? ''
  } catch {
    return String(err)
  }
}

/**
 * Extract a human-readable message from an unknown thrown value (e.g. the raw Eden envelope
 * thrown by `unwrap`). Removes the 8-line three-branch boilerplate consumers duplicate.
 *
 * Resolution order:
 *   1. `Error` instance       → err.message
 *   2. `{ message: string }`  → message (Eden / Elysia error shape)
 *   3. `{ value: ... }`       → recursively (Eden nested value envelope)
 *   4. plain string           → itself
 *   5. anything else          → `JSON.stringify`
 *
 * **If that yields nothing a human can read** (`''`, `'{}'`, `'[]'`, `'null'`, `'undefined'`,
 * `'[object Object]'` — the shapes `JSON.stringify` produces for an opaque envelope) the `fallback`
 * is returned instead, with `(HTTP <status>)` appended when the envelope carries one. Without that
 * guard the caller renders a literal `{}` at the user, or — for `toErrorMessage(undefined)` —
 * the actual value `undefined`, since `JSON.stringify(undefined)` is not a string at all.
 *
 * @example
 * try {
 *   await unwrap(api.resource.post({ body }))
 * } catch (e) {
 *   toast(toErrorMessage(e, 'Could not create share'))   // → "slug already in use"
 *                                                        // → "Could not create share (HTTP 502)"
 * }
 */
export function toErrorMessage(err: unknown, fallback = 'The request failed.'): string {
  const message = decode(err).trim()
  if (!UNUSABLE.has(message)) return message
  const status = errorStatus(err)
  return status === undefined ? fallback : `${fallback} (HTTP ${status})`
}
