import { queryOptions } from '@tanstack/react-query'
import { unwrap } from 'basalt-ui/data'
import { fakeApi } from './synthetic'
import type { StrengthParams } from './synthetic'

/** The same key factory shape as argo's `strengthQueries`; the transport is the fake envelope. */
export const strengthQueries = {
  all: () => ['strength'] as const,
  heroes: (params: StrengthParams) =>
    queryOptions({
      queryKey: [...strengthQueries.all(), 'heroes', params] as const,
      queryFn: async () => unwrap(await fakeApi.heroes(params)),
    }),
  sparklines: (params: StrengthParams) =>
    queryOptions({
      queryKey: [...strengthQueries.all(), 'sparklines', params] as const,
      queryFn: async () => unwrap(await fakeApi.sparklines(params)),
    }),
}

export const workoutsQueries = {
  list: (params: { page: number; limit: number }) =>
    queryOptions({
      queryKey: ['workouts', 'list', params] as const,
      queryFn: async () => unwrap(await fakeApi.workouts(params)),
    }),
}
