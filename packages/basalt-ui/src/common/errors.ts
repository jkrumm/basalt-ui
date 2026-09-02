/**
 * The message table (Blueprint audit §3). Every basalt diagnostic — thrown or logged — is built
 * here, so the prefix, the `Component: …` shape and the em-dash-then-remedy rhythm are one decision
 * instead of 60. It is the generalisation of `assertQueryStateLike`, which was the ONLY component
 * in the library naming itself in its own failure (isomorphic finding F-ERR-1: the other 54 fail as
 * raw `TypeError`s that `BasaltErrorBoundary` swallows into a blank subtree).
 *
 * Every builder returns a string; nothing here throws or logs. The caller decides which it is —
 * `assertRequiredProps` throws, `useValidateProps` logs, the mount guards log.
 */

/** The one namespace every basalt message opens with. */
export const BASALT_PREFIX = '[basalt]'

function message(component: string, body: string): string {
  return `${BASALT_PREFIX} ${component}: ${body}`
}

/**
 * A prop the component reads into and cannot render without. This is the F-ERR-1 message: the
 * component names itself and the prop, instead of the read landing as
 * `undefined is not an object (evaluating 'field.use')`.
 */
export function requiredProp(component: string, prop: string, hint?: string): string {
  return message(component, `prop "${prop}" is required${hint === undefined ? '.' : ` — ${hint}`}`)
}

/** A prop with a closed value set that got something outside it. */
export function oneOf(
  component: string,
  prop: string,
  allowed: readonly string[],
  got: unknown,
): string {
  return message(
    component,
    `prop "${prop}" must be one of ${allowed.map((value) => `'${value}'`).join(' | ')} — ` +
      `got ${JSON.stringify(got)}.`,
  )
}

/**
 * A prop still shipped and still working, with a named successor and the version it goes away in.
 * Majors are banned here, so the deprecation notice IS the migration channel.
 */
export function deprecatedProp(
  component: string,
  oldProp: string,
  newProp: string,
  removeIn: string,
): string {
  return message(
    component,
    `prop "${oldProp}" is deprecated — use "${newProp}" instead. "${oldProp}" is removed in ${removeIn}.`,
  )
}

/**
 * An imperative call needs a layer that is not there — the optional peer is not installed, or the
 * mount that subscribes to its event bus is disabled. Both halves are named because the remedy
 * differs: install it, or stop turning it off.
 */
export function missingLayer(component: string, layer: string, remedy: string): string {
  return message(component, `needs ${layer}, which is not available — ${remedy}.`)
}

/** A single-mount component found a second instance alive (`BasaltProvider`, `Notifications`). */
export function duplicateMount(component: string): string {
  return message(
    component,
    'more than one instance is mounted at once — mount exactly one, at the app root.',
  )
}

// ── Transport-agnostic error decoding ────────────────────────────────────────────────────────────
//
// Deliberately in this module, with NO `@tanstack/react-query` import — `dashboard/query-state.tsx`
// renders server messages and must not drag the query peer into the root barrel's graph to do it.

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
const UNUSABLE_MESSAGES = new Set(['', '{}', '[]', 'null', 'undefined', '[object Object]'])

function decodeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>
    if (typeof obj['message'] === 'string') return obj['message']
    // Eden-style { value: ... } or { status, value } envelopes — unwrap one level.
    if ('value' in obj) return decodeError(obj['value'])
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
  const decoded = decodeError(err).trim()
  if (!UNUSABLE_MESSAGES.has(decoded)) return decoded
  const status = errorStatus(err)
  return status === undefined ? fallback : `${fallback} (HTTP ${status})`
}
