/**
 * useConnectivity — reads the aggregated connectivity status from ConnectivityContext.
 *
 * Throws if used outside a ConnectivityProvider. `BasaltProvider` auto-mounts
 * `ConnectivityProvider`, so this hook works with zero setup in the common case; the removed
 * `useOnlineStatus` (formerly `basalt-ui/state`) is replaced by this hook (see MIGRATING.md).
 *
 * @example
 * const { status, details } = useConnectivity()
 * if (status === 'offline') return <OfflineBanner />
 */
import { useContext } from 'react'
import { ConnectivityContext } from './connectivity-provider'
import type { ConnectivitySnapshot } from './types'

export function useConnectivity(): ConnectivitySnapshot {
  const snapshot = useContext(ConnectivityContext)
  if (snapshot === null) {
    throw new Error(
      'useConnectivity() must be used within a <ConnectivityProvider>. ' +
        'Wrap your app in <BasaltProvider> (which auto-mounts ConnectivityProvider) ' +
        'or mount <ConnectivityProvider> manually.',
    )
  }
  return snapshot
}
