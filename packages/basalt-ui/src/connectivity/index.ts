/**
 * `./connectivity` — aggregated connectivity monitoring: browser online/offline, React Query
 * onlineManager, SSE EventSource, and health-check pings folded into a single status with
 * per-signal detail.
 *
 * Auto-mounted by BasaltProvider so basic browser detection requires zero consumer setup.
 * SSE and health ping are opt-in via BasaltProvider props.
 */

export { ConnectivityProvider } from './connectivity-provider'
export { ConnectivityIndicator } from './connectivity-indicator'
export { useConnectivity } from './use-connectivity'
export type {
  ConnectivityStatus,
  ConnectivitySnapshot,
  ConnectivityProviderProps,
  ConnectivityOverride,
} from './types'
