/**
 * `shotState`: the page side of `basalt-ui shot`'s `?shot-state=<phase>`. A shot reloads each route
 * with `?shot-state=empty|loading|error` to see a state the live data never reaches; the page only
 * obeys when it routes its query result through here. It acts when the shot runner has marked the
 * page (an init script sets `window.__basaltShot` before any page script), so a production URL that
 * carries the parameter renders what the query returned.
 *
 * The helper ships in the production bundle on purpose: `shot` renders the built app, so a
 * dev-only branch would be folded away and the state could never be forced.
 */
import type { QueryStateLike } from '../core/ports'

/** The window flag the shot runner sets before any page script. */
export const SHOT_FLAG = '__basaltShot'

/** The query parameter a shot appends to a route to ask for a state. */
export const SHOT_PARAM = 'shot-state'

const FORCED = ['empty', 'loading', 'error'] as const
type Forced = (typeof FORCED)[number]

/** What the runner asked for, or null: not a shot, no parameter, or a value that is not a phase. */
function asked(): Forced | null {
  if (typeof window === 'undefined') return null
  if ((window as unknown as Record<string, unknown>)[SHOT_FLAG] !== true) return null
  const value = new URLSearchParams(window.location.search).get(SHOT_PARAM)
  return FORCED.find((phase) => phase === value) ?? null
}

type ShotStateOptions = {
  /** The `data` an empty phase carries. Defaults to `[]`; pass the empty shape of a non-list result. */
  empty?: unknown
}

/**
 * Returns the query result with the phase a shot asked for, else the result itself.
 *
 * @useWhen a page feeds a query result to a frame (`phase`, a chart, a table) and `basalt-ui shot` must score its empty, loading and error states
 * @neverWhen the page has no query to force, or a state the frame already derives from fixed props
 *
 * @example
 * // @check
 * import { queryOptions, useQuery } from '@tanstack/react-query'
 * import { shotState } from 'basalt-ui/data'
 * import { col, DataTable, useDataTable } from 'basalt-ui/table'
 *
 * type Run = { id: string; name: string; km: number }
 * const runsQuery = queryOptions({ queryKey: ['runs'], queryFn: async (): Promise<Run[]> => [] })
 * const c = col<Run>()
 *
 * export function Runs() {
 *   const result = shotState(useQuery(runsQuery))
 *   const t = useDataTable({
 *     id: 'runs',
 *     label: 'Runs',
 *     columns: [c.entity('name'), c.number('km', { unit: 'km' })],
 *     data: result.data,
 *     phase: result,
 *     getRowId: (run) => run.id,
 *     mode: { kind: 'client' },
 *   })
 *   return <DataTable table={t} />
 * }
 */
export function shotState<T extends QueryStateLike & { data?: unknown }>(
  result: T,
  options: ShotStateOptions = {},
): T {
  const phase = asked()
  if (phase === null) return result
  if (phase === 'loading') {
    return {
      ...result,
      isPending: true,
      isError: false,
      isRefetchError: false,
      error: null,
      data: undefined,
    }
  }
  if (phase === 'error') {
    return {
      ...result,
      isPending: false,
      isError: true,
      isRefetchError: false,
      error: new Error('shot-state=error'),
      data: undefined,
    }
  }
  return {
    ...result,
    isPending: false,
    isError: false,
    isRefetchError: false,
    error: null,
    data: 'empty' in options ? options.empty : [],
  }
}
