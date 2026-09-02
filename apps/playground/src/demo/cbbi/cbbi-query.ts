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
import { fetchCbbi } from './cbbi-data'
import type { CbbiRow } from './cbbi-data'

const HOUR = 60 * 60 * 1000

// `basalt-ui/query` re-exports the HOOKS but none of their RESULT TYPES, so the return type is
// left to inference rather than reaching past the seam for `UseQueryResult` — the one import this
// page is not allowed to dual-source (basalt/query-dual-import).
export function useCbbi() {
  return useQuery<CbbiRow[], Error>({
    queryKey: ['cbbi'],
    queryFn: fetchCbbi,
    staleTime: HOUR,
    gcTime: 4 * HOUR,
    retry: 1,
  })
}
