/**
 * `createBasaltQueryClient` + `unwrap` — the two TanStack Query primitives basalt ships. Folded
 * onto the root barrel (C1 consolidation, dropping the `./query` subpath): the root already
 * requires `@tanstack/react-query` as a peer, so a dedicated Mantine-free subpath bought nothing —
 * and it re-exported 10 raw TanStack symbols no consumer imported through it.
 * Optional peer: @tanstack/react-query.
 */
import { QueryClient } from '@tanstack/react-query'
import type { QueryClientConfig } from '@tanstack/react-query'

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
 * import { createBasaltQueryClient } from 'basalt-ui'
 * import { QueryClientProvider } from '@tanstack/react-query'
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
 * import { unwrap } from 'basalt-ui'
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
