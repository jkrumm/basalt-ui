/**
 * The QueryClient factory `basaltRouterOptions` owns (V2-SPEC § 2): one client per router, so an
 * SSR entry gets one per request. Optional peer: @tanstack/react-query.
 */
import { QueryClient } from '@tanstack/react-query'
import type { QueryClientConfig } from '@tanstack/react-query'

/** Twice, and never a 4xx: the same request cannot start succeeding (a 401 is the app's to handle). */
const retry = (failureCount: number, error: unknown): boolean => {
  const status = (error as { status?: unknown } | null)?.status
  return failureCount < 2 && !(typeof status === 'number' && status >= 400 && status < 500)
}

const BASALT_QUERY_DEFAULTS = {
  staleTime: 30_000,
  gcTime: 5 * 60 * 1000,
  retry,
  refetchOnWindowFocus: false,
} as const

/** QueryClient with the basalt dashboard defaults; consumer `config` wins per-query. */
export function makeQueryClient(config?: QueryClientConfig): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config?.defaultOptions,
      queries: { ...BASALT_QUERY_DEFAULTS, ...config?.defaultOptions?.queries },
    },
  })
}
