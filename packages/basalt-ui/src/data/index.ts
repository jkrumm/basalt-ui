/** `basalt-ui/data` — v3 data layer. Peers: `@tanstack/react-query` (optional). */

export { makeQueryClient } from './query-client'
export { optimistic } from './optimistic'
export { unwrap } from './unwrap'
export { windowKey } from './window-key'
export { liveQuery } from './live/live-query'
export type { Freshness } from './live/live-query'
export { createSyncedState } from './synced'
export { bindInvalidation } from './live/bind-invalidation'
export { useConnection } from './live/connection'
export { useFreshness } from './live/freshness'
export type { FreshnessOptions } from './live/freshness'
