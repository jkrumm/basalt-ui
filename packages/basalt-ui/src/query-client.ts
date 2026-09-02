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
 * Absence guard: if `error` is falsy but `data` is `null` OR `undefined`, unwrap throws with a
 * descriptive message. This catches 204 No Content responses and silent transport failures that
 * return `{ data: null, error: null }` — both signal an unexpected absence of data and should not
 * silently resolve. `undefined` joined `null` here (C5 consolidation) so a hand-rolled fetch
 * wrapper that leaves `data` unset on a miss — rather than explicitly `null` — is caught the same
 * way; the two envelope shapes argo's own pre-basalt `unwrap` and basalt's ONLY differed on.
 *
 * **Two overloads, one name** — a Promise of the envelope (basalt's original shape,
 * `queryFn: () => unwrap(api.x.get())`), or the ALREADY-RESOLVED envelope itself
 * (`unwrap(await api.x.get())`, or passed directly as a `.then(unwrap)` callback — both argo's
 * 97 call sites' shapes). Never a generic argument to disambiguate: TS infers the right overload
 * from whether the argument IS a `Promise`.
 *
 * @example
 * import { unwrap } from 'basalt-ui'
 *
 * // Promise-of-envelope — queryFn:
 * queryFn: () => unwrap(api.users.get({ query: params }))
 * // mutation:
 * mutationFn: (body) => unwrap(api.resource.post({ body }))
 *
 * // resolved-envelope — either shape:
 * const rows = unwrap(await api.users.get())
 * const rows2 = await api.users.get().then(unwrap)
 */
export function unwrap<TData>(
  response: Promise<{ data: TData | null | undefined; error: unknown }>,
): Promise<TData>
export function unwrap<TData>(response: { data: TData | null | undefined; error: unknown }): TData
export function unwrap<TData>(
  response:
    | Promise<{ data: TData | null | undefined; error: unknown }>
    | { data: TData | null | undefined; error: unknown },
): TData | Promise<TData> {
  if (response instanceof Promise) return response.then((envelope) => unwrapEnvelope(envelope))
  return unwrapEnvelope(response)
}

function unwrapEnvelope<TData>(envelope: {
  data: TData | null | undefined
  error: unknown
}): TData {
  const { data, error } = envelope
  if (error) throw error
  if (data === null || data === undefined)
    throw new Error(
      'unwrap: null/undefined data with no error — check for a 204 response or a transport failure',
    )
  return data
}
