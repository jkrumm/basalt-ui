/**
 * The `shot-state` URL param `basalt-ui shot` navigates with, and the three adapters that turn it
 * into each container's own empty / loading / error props — a scenario never fakes a state by
 * hand where a component already has the prop.
 */
import type { ChartState } from 'basalt-ui/charts'
import type { QueryStateLike } from '../demo/query-state-like'

export const SHOT_STATES = ['empty', 'loading', 'error'] as const
export type ShotState = (typeof SHOT_STATES)[number]

export type ScenarioProps = { shotState: ShotState | undefined }

/** Route `validateSearch`: an unknown value is dropped, so a stale link renders the rest state. */
export function validateShotSearch(raw: Record<string, unknown>): { 'shot-state'?: ShotState } {
  const value = raw['shot-state']
  return SHOT_STATES.find((s) => s === value) === undefined
    ? {}
    : { 'shot-state': value as ShotState }
}

const noop = (): void => {}

/** For `StatCard` / `Section` / `BasaltDataTable` `query`: undefined at rest. */
export function queryFor(
  state: ShotState | undefined,
  errorMessage: string,
): QueryStateLike<unknown> | undefined {
  if (state === undefined) return undefined
  const base = { isError: false, error: null, refetch: noop } as const
  if (state === 'loading') return { ...base, data: undefined, fetchStatus: 'fetching' }
  if (state === 'error') {
    return {
      ...base,
      isError: true,
      error: new Error(errorMessage),
      data: undefined,
      fetchStatus: 'idle',
    }
  }
  return { ...base, data: [], fetchStatus: 'idle' }
}

/** For `ChartCard` / chart `state`: undefined at rest. */
export function chartStateFor(
  state: ShotState | undefined,
  copy: { empty: string; error: string },
): ChartState | undefined {
  if (state === undefined) return undefined
  if (state === 'loading') return { pending: true }
  if (state === 'error') return { error: new Error(copy.error) }
  return { empty: copy.empty }
}
