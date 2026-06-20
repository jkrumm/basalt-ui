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
  return data as TData
}

// ── Re-exports from @tanstack/react-query ────────────────────────────────────────────────────────

export {
  QueryClientProvider,
  QueryErrorResetBoundary,
  useQueryErrorResetBoundary,
} from '@tanstack/react-query'

// ── Re-export devtools helper ─────────────────────────────────────────────────────────────────────

export { BasaltQueryDevtools } from './devtools'
