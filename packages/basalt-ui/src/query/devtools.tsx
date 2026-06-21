/**
 * ./query/devtools — prod-safe lazy wrapper for @tanstack/react-query-devtools.
 * The devtools package is an OPTIONAL peer — never imported at module evaluation time.
 * The dynamic import() resolves only when rendered in non-production.
 */
import { lazy, Suspense } from 'react'
import type { ComponentProps } from 'react'
import type { ReactQueryDevtools } from '@tanstack/react-query-devtools'

const LazyDevtools = lazy(() =>
  import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
)

/**
 * Lazy, production-excluded wrapper for ReactQueryDevtools. Safe to import unconditionally —
 * the devtools chunk is only resolved when rendered outside of production and the dynamic
 * import fires. In production this returns null immediately.
 *
 * @example
 * import { BasaltQueryDevtools } from 'basalt-ui/query'
 *
 * function Root() {
 *   return (
 *     <QueryClientProvider client={client}>
 *       {children}
 *       <BasaltQueryDevtools initialIsOpen={false} />
 *     </QueryClientProvider>
 *   )
 * }
 */
export function BasaltQueryDevtools(props: ComponentProps<typeof ReactQueryDevtools>) {
  if (process.env['NODE_ENV'] === 'production') return null
  return (
    <Suspense fallback={null}>
      <LazyDevtools {...props} />
    </Suspense>
  )
}
