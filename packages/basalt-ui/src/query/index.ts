/**
 * ./query — thin TanStack Query adapter + transport-agnostic Eden unwrap.
 * Optional peer: @tanstack/react-query.
 */
import { QueryClient, type QueryClientConfig } from '@tanstack/react-query'

// ── createBasaltQueryClient ───────────────────────────────────────────────────────────────────────

const BASALT_QUERY_DEFAULTS = {
  staleTime: 30_000,
  gcTime: 5 * 60 * 1000,
  retry: 2,
  refetchOnWindowFocus: false,
} as const

/**
 * Wraps QueryClient with basalt dashboard defaults. All options are mergeable — consumer
 * overrides win per-query, framework defaults are the fallback.
 *
 * @example
 * import { createBasaltQueryClient, QueryClientProvider } from 'basalt-ui/query'
 * import { useState } from 'react'
 *
 * function Root({ children }: { children: React.ReactNode }) {
 *   const [client] = useState(() => createBasaltQueryClient())
 *   return <QueryClientProvider client={client}>{children}</QueryClientProvider>
 * }
 */
export function createBasaltQueryClient(config?: QueryClientConfig): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config?.defaultOptions,
      queries: { ...BASALT_QUERY_DEFAULTS, ...config?.defaultOptions?.queries },
    },
  })
}

// ── unwrap ────────────────────────────────────────────────────────────────────────────────────────

/**
 * Transport-agnostic unwrap for any `{ data, error }` envelope (Eden Treaty, raw fetch wrappers,
 * etc.). TData is inferred from the data field. Throws on the error branch so failures surface
 * to the nearest error boundary or TanStack Query's error state.
 *
 * Null guard: if `error` is falsy but `data` is `null`, unwrap throws with a descriptive message.
 * This catches 204 No Content responses and silent transport failures that return `{ data: null,
 * error: null }` — both signal an unexpected absence of data and should not silently resolve.
 *
 * @example
 * import { unwrap } from 'basalt-ui/query'
 *
 * queryFn: () => unwrap(api.users.get({ query: params }))
 * // mutation:
 * mutationFn: (body) => unwrap(api.resource.post({ body }))
 * // manual:
 * const rows = await unwrap(api.users.get())
 */
export async function unwrap<TData>(
  response: Promise<{ data: TData | null; error: unknown }>,
): Promise<TData> {
  const { data, error } = await response
  if (error) throw error
  if (data === null)
    throw new Error(
      'unwrap: null data with no error — check for a 204 response or a transport failure',
    )
  return data as TData
}

// ── Re-exports from @tanstack/react-query ────────────────────────────────────────────────────────

// Provider + boundary helpers
export {
  QueryClientProvider,
  QueryErrorResetBoundary,
  useQueryErrorResetBoundary,
} from '@tanstack/react-query'

// Primary fetch hooks — import from basalt-ui/query rather than dual-importing @tanstack/react-query
export {
  useQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  queryOptions,
} from '@tanstack/react-query'

// ── Re-export devtools helper ─────────────────────────────────────────────────────────────────────

export { BasaltQueryDevtools } from './devtools'
