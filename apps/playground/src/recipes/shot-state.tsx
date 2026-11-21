/** Recipe: a query hook the `basalt-ui shot` runner can force into empty, loading and error. */
import type { QueryStateLike } from 'basalt-ui/cards'

type Run = { id: string; name: string }

const runsApi = {
  list: (): Promise<Run[]> => Promise.resolve([{ id: 'a', name: 'Nightly' }]),
}

// #region recipe:shot-state
import { useQuery } from '@tanstack/react-query'
import { shotState } from 'basalt-ui/data'

export function useRuns() {
  const result = shotState(useQuery({ queryKey: ['runs'], queryFn: () => runsApi.list() }))
  return result
}
// #endregion

/** What a frame takes as its `phase`: the forced result is one. */
export const asPhase = (result: QueryStateLike): QueryStateLike => result
