/**
 * Connectivity types — aggregated online/offline/degraded status with per-signal detail.
 *
 * The ConnectivityProvider aggregates browser navigator.onLine, React Query's onlineManager,
 * an optional SSE EventSource, and an optional health-check endpoint into a single status.
 * Signals that are null (not configured/available) are treated as passing.
 */

export type ConnectivityStatus = 'online' | 'offline' | 'degraded'

export type ConnectivitySnapshot = {
  status: ConnectivityStatus
  /** Per-signal breakdown for debugging / detailed indicators */
  details: {
    browserOnline: boolean // navigator.onLine
    // React Query onlineManager — a module-level singleton, so it is always readable regardless of
    // whether a QueryClient is mounted; never null on the client (the pre-hydration SSR snapshot
    // reports an optimistic `true`, matching `browserOnline`, rather than an "unknown" null).
    queryOnline: boolean
    sseOpen: boolean | null // EventSource readyState === OPEN — null when no sseUrl configured
    healthPassing: boolean | null // /health ping succeeded — null when no healthUrl configured
  }
}

export type ConnectivityOverride = {
  browserOnline?: boolean
  queryOnline?: boolean
  sseOpen?: boolean | null
  healthPassing?: boolean | null
}

export type ConnectivityProviderProps = {
  children: React.ReactNode
  /** Optional SSE endpoint. When set, an EventSource is opened and its readyState is monitored. */
  sseUrl?: string
  /** Optional health-check endpoint. When set, periodic GET requests monitor backend reachability. */
  healthUrl?: string
  /** Interval in ms for health pings. Default: 30_000 (30s). */
  healthIntervalMs?: number
  /** Override individual signal values for testing / simulation. Non-overridden keys use real signals. */
  override?: ConnectivityOverride
}
