/**
 * The QueryClient factory `basaltRouterOptions` owns (V2-SPEC § 2): one client per router, so an
 * SSR entry gets one per request. Optional peer: @tanstack/react-query.
 */
import { QueryClient } from '@tanstack/react-query'
import type { QueryClientConfig } from '@tanstack/react-query'

const MAX_RETRIES = 2
/** The 4xx that are transient: request timeout, too early, too many requests. */
const TRANSIENT_4XX: ReadonlySet<number> = new Set([408, 425, 429])

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined
  return typeof error.status === 'number' ? error.status : undefined
}

/** Twice, and not on a 4xx (the same request cannot start succeeding; a 401 is the app's to handle). */
const retry = (failureCount: number, error: unknown): boolean => {
  const status = statusOf(error)
  const clientError = status !== undefined && status >= 400 && status < 500
  return failureCount < MAX_RETRIES && !(clientError && !TRANSIENT_4XX.has(status))
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
