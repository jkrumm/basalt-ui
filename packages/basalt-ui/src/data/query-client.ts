/**
 * The QueryClient law: one factory, one retry predicate, one set of defaults. There is no
 * module-level client anywhere in this package: an app builds one per router, so an SSR entry gets
 * one per request. Optional peer: @tanstack/react-query.
 */
import { QueryClient } from '@tanstack/react-query'
import type { QueryClientConfig } from '@tanstack/react-query'

const MAX_RETRIES = 2
/** The 4xx that are transient: request timeout, too early, too many requests. */
const TRANSIENT_4XX: ReadonlySet<number> = new Set([408, 425, 429])

const statusOf = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined
  return typeof error.status === 'number' ? error.status : undefined
}

/**
 * The retry predicate: twice, and not on a 4xx (the same request cannot start succeeding; a 401 is
 * the app's to handle). An error without a numeric `status` (a network failure, a shape error)
 * retries. The live channel reuses it for its own reconnects.
 */
export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  const status = statusOf(error)
  const retryable =
    status === undefined || status < 400 || status >= 500 || TRANSIENT_4XX.has(status)
  return failureCount < MAX_RETRIES && retryable
}

const BASALT_QUERY_DEFAULTS = {
  staleTime: 30_000,
  gcTime: 5 * 60 * 1000,
  retry: shouldRetryQuery,
  refetchOnWindowFocus: false,
} as const

/**
 * Builds the QueryClient with the basalt defaults (30 s stale, 5 min gc, no retry on a 4xx except
 * 408/425/429, no refetch on focus); consumer `config` wins per key.
 *
 * @useWhen an app or an SSR request needs its QueryClient, built once per router or per request
 * @neverWhen a module-level `new QueryClient()` would be shared across requests or tests
 *
 * @example
 * ```ts
 * const queryClient = makeQueryClient({ defaultOptions: { queries: { staleTime: 5_000 } } })
 * ```
 */
export function makeQueryClient(config?: QueryClientConfig): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config?.defaultOptions,
      queries: { ...BASALT_QUERY_DEFAULTS, ...config?.defaultOptions?.queries },
    },
  })
}
