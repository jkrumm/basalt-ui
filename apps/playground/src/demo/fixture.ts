/**
 * A playground fixture served as a query, the way a consumer page reads its data: the result is the
 * frame's `phase`, and `shotState` lets `basalt-ui shot` force it empty, loading or failed. The
 * fixture is the query's initial data, so a page paints ready on its first frame.
 */
import { useQuery } from '@tanstack/react-query'
import { shotState } from 'basalt-ui/data'

/** The query key a fixture lives under, for a page that writes to it (`setQueryData`). */
export const fixtureKey = (key: readonly unknown[]): unknown[] => ['fixture', ...key]

export function useFixture<T>(key: readonly unknown[], data: T, empty?: T) {
  return shotState(
    useQuery({
      queryKey: fixtureKey(key),
      queryFn: async (): Promise<T> => data,
      initialData: data,
      staleTime: Number.POSITIVE_INFINITY,
    }),
    empty === undefined ? {} : { empty },
  )
}
