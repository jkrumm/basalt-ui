/**
 * Prop validation, in the two shapes basalt actually needs (Blueprint audit §3, isomorphic finding
 * F-ERR-1).
 *
 * The split is the design: a MISUSE that would crash anyway throws immediately with a written
 * message (`assertRequiredProps`), while a misuse that merely renders something the caller did not
 * mean warns once in dev and renders on (`useValidateProps`).
 */
import { useEffect } from 'react'
import { isDev } from './is-dev'
import { requiredProp } from './errors'

/** A check returns the message(s) it has, or nothing. `null`/`undefined` entries are ignored. */
type CheckResult = string | null | undefined | Array<string | null | undefined>

/**
 * Module-level so the once-per-message promise survives a re-render, a remount, and a second
 * instance of the same component. A dev warning is about the CODE, and printing it per render is
 * how a real warning gets scrolled out of the console. Keyed by `component` + message, so two
 * different faults in one component both get said.
 */
const reported = new Set<string>()

/**
 * Dev-only prop validation. `console.error`s each message ONCE per `(component, message)` pair, and
 * is a no-op in production: `isDev()` reads `process.env.NODE_ENV`, which every bundler
 * constant-folds, so the whole body disappears from a production build.
 *
 * **The dedup key is `${component} ${message}`, and nothing else** — not the instance, not the
 * props. Two instances of one component producing the SAME message say it once between them, which
 * is the intent (a dev warning is about the code). A caller that wants it said per instance has to
 * embed the identifying context IN the message — the title, the persist key, the field name — the
 * way `Section` writes `Section "<title>": …`. A message built from nothing instance-specific is a
 * message the second faulty call site never gets.
 *
 * @example
 * useValidateProps(
 *   'Section',
 *   () => (persistKey !== undefined && !collapsible ? sectionPersistMessage : null),
 *   [persistKey, collapsible],
 * )
 */
export function useValidateProps(
  component: string,
  check: () => CheckResult,
  deps: unknown[],
): void {
  useEffect(() => {
    if (!isDev()) return
    const result = check()
    const messages = Array.isArray(result) ? result : [result]
    for (const raw of messages) {
      if (raw === null || raw === undefined) continue
      const key = `${component} ${raw}`
      if (reported.has(key)) continue
      reported.add(key)
      console.error(raw)
    }
    // The deps ARE the caller's contract: this hook cannot know what `check` closes over.
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- the caller owns the dep list
  }, deps)
}

/** Test seam. The once-per-message Set is module state, so a suite has to be able to clear it. */
export function resetValidatedProps(): void {
  reported.clear()
}

/**
 * THROWS on a missing required prop, in every build, before the component reads into it.
 *
 * This is the F-ERR-1 remedy, and the reason it is not dev-gated: the component was going to crash
 * either way (`undefined is not an object (evaluating 'field.use')`), so the only thing in question
 * is whether the stack reaching `BasaltErrorBoundary` names the component and the prop. It does
 * now. A prop that is merely questionable belongs in `useValidateProps`, not here.
 *
 * @example
 * assertRequiredProps('SelectFilter', props, ['field'])
 */
export function assertRequiredProps<P extends object>(
  component: string,
  props: P,
  keys: ReadonlyArray<Extract<keyof P, string>>,
  hints?: Partial<Record<Extract<keyof P, string>, string>>,
): void {
  for (const key of keys) {
    const value = (props as Record<string, unknown>)[key]
    if (value !== undefined && value !== null) continue
    const hint = hints?.[key]
    throw new Error(
      hint === undefined ? requiredProp(component, key) : requiredProp(component, key, hint),
    )
  }
}
