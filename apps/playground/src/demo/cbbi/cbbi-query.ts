/**
 * The one query behind the CBBI page.
 *
 * `basalt-ui/query` re-exports react-query's own surface (the same seam `QueryDemoPage` uses), so
 * the page has one import for the client factory, the provider and the hook. The playground mounts
 * NO app-wide `QueryClientProvider` — `main.tsx` only wires `BasaltProvider` — so the provider is
 * page-local, exactly as `QueryDemoPage` does it.
 *
 * The upstream file is `cache-control: max-age=3600` and ~1.5 MB, so the client mirrors it: an hour
 * of freshness, a four-hour cache floor above it (a `gcTime` below `staleTime` would evict a
 * still-fresh 1.5 MB payload and re-download it on the next mount), and ONE retry — a CORS or a
 * 404 fails the same way three times.
 */
import { useQuery } from 'basalt-ui/query'
// `basalt-ui/query` re-exports the HOOKS but none of their RESULT TYPES, so the annotation on the
// exported hook below has to reach past the seam the same module tells callers not to dual-import.
// A type-only import costs no second runtime copy; it is still the one place this page names
// `@tanstack/react-query` directly.
import type { UseQueryResult } from '@tanstack/react-query'
import { fetchCbbi } from './cbbi-data'
import type { CbbiRow } from './cbbi-data'

const HOUR = 60 * 60 * 1000

export function useCbbi(): UseQueryResult<CbbiRow[], Error> {
  return useQuery({
    queryKey: ['cbbi'],
    queryFn: fetchCbbi,
    staleTime: HOUR,
    gcTime: 4 * HOUR,
    retry: 1,
  })
}
