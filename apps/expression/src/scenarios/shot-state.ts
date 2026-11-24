/** The `shot-state` URL param `basalt-ui shot` navigates with, and a scenario's own `fixture` name. */

const SHOT_STATES = ['empty', 'loading', 'error'] as const
export type ShotState = (typeof SHOT_STATES)[number]

/** `fixture` is the raw `?fixture=` value; each scenario decides which names it knows. */
export type ScenarioProps = { shotState: ShotState | undefined; fixture: string | undefined }

export type ScenarioSearch = { 'shot-state'?: ShotState; fixture?: string }

export const isShotState = (value: unknown): value is ShotState =>
  SHOT_STATES.some((s) => s === value)

/** Route `validateSearch`: an unknown or mistyped value is dropped, so a stale link renders the rest state. */
export function validateShotSearch(raw: Record<string, unknown>): ScenarioSearch {
  const search: ScenarioSearch = {}
  const state = raw['shot-state']
  if (isShotState(state)) search['shot-state'] = state
  const fixture = raw['fixture']
  if (typeof fixture === 'string' && fixture !== '') search.fixture = fixture
  return search
}
