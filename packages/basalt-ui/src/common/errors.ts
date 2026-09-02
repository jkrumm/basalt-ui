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

/** A single-mount component found a second instance alive (`BasaltProvider`, `Notifications`). */
export function duplicateMount(component: string): string {
  return message(
    component,
    'more than one instance is mounted at once — mount exactly one, at the app root.',
  )
}
