/**
 * The `shot-state` URL param `basalt-ui shot` navigates with, and the three adapters that turn it
 * into each container's own empty / loading / error props — a scenario never fakes a state by
 * hand where a component already has the prop.
 */
import type { ChartState } from 'basalt-ui/charts'
import type { QueryStateLike } from '../demo/query-state-like'

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

/** The error cause of a failed load: the source that did not answer, once, then the next step. */
export const retryCopy = (source: string): string =>
  `The ${source} did not answer. Retry, or reconnect it in Settings.`

/** The inert handler of a fixture's Retry. */
export const noop = (): void => {}

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

/**
 * `ChartCard` props for a card that hosts a Meter or BarList. The card takes every state so its
 * header stops printing the loaded headline (`facts`) while loading, empty or failed; the body still
 * draws its own loading and empty state under `placeholderHeight`. `'content'` ends the card at its
 * content and renders the body while pending, so the body's own `loading` keeps the loaded
 * footprint; a number reserves that body height instead. Error adds the shared Retry.
 */
export function cardStateProps(
  state: ShotState | undefined,
  errorCopy: string,
  placeholderHeight: number | 'content',
  emptyCopy: string,
): {
  state?: ChartState | undefined
  onRetry?: () => void
  placeholderHeight: number | 'content'
} {
  if (state === 'error') {
    return { state: { error: new Error(errorCopy) }, onRetry: noop, placeholderHeight }
  }
  const chartState = chartStateFor(state, { empty: emptyCopy, error: errorCopy })
  return chartState === undefined ? { placeholderHeight } : { state: chartState, placeholderHeight }
}
