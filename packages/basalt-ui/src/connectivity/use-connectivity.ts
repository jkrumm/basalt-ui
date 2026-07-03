/**
 * useConnectivity — reads the aggregated connectivity status from ConnectivityContext.
 *
 * Throws if used outside a ConnectivityProvider. For the provider-less simple boolean,
 * use the deprecated `useOnlineStatus` from `basalt-ui/state`.
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
