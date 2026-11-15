/** The `shot-state` URL param `basalt-ui shot` navigates with. */

const SHOT_STATES = ['empty', 'loading', 'error'] as const
export type ShotState = (typeof SHOT_STATES)[number]

export type ScenarioProps = { shotState: ShotState | undefined }

export const isShotState = (value: unknown): value is ShotState =>
  SHOT_STATES.some((s) => s === value)

/** Route `validateSearch`: an unknown value is dropped, so a stale link renders the rest state. */
export function validateShotSearch(raw: Record<string, unknown>): { 'shot-state'?: ShotState } {
  const value = raw['shot-state']
  return isShotState(value) ? { 'shot-state': value } : {}
}
