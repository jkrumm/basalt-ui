/**
 * The v3 fixture's scenario registry — pure data, no DOM work, no `src/**` imports.
 *
 * A scenario is one mountable page shape. It DECLARES the shell slots it provides, and that
 * declaration is what un-skips a shell layout test: `shell-target.ts` runs a describe on v3 only when
 * every slot it needs is provided here. Empty today, so every v3 case skips; the Issues that build the
 * v3 shell add scenarios (and their slots) as they land.
 */
import type { FixtureSpec } from '../spec'
import { pageCoreScenario } from './scenarios/page-core'
import { pageKitScenario } from './scenarios/page-kit'

export type ShellSlotName = string

export interface Scenario {
  /** The `data-slot` names this scenario renders. */
  readonly slots: readonly ShellSlotName[]
  /** Whether this scenario can render `spec`. */
  matches(spec: FixtureSpec): boolean
  /** Renders `spec` into `container`, replacing what was there. */
  mount(spec: FixtureSpec, container: HTMLElement): void | Promise<void>
}

export const SCENARIOS: Readonly<Record<string, Scenario>> = {
  'page-kit': pageKitScenario,
  'page-core': pageCoreScenario,
}

/** Every slot some registered scenario provides. */
export function providedSlots(): ReadonlySet<string> {
  return new Set(Object.values(SCENARIOS).flatMap((scenario) => scenario.slots))
}
