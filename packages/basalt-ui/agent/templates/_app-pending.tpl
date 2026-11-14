/**
 * `defaultPendingComponent`: shown after 300 ms of loading, and for at least 300 ms once shown, so a
 * fast route never flashes it. Without this component the router never arms that timer.
 *
 * Scaffold written by `basalt-ui init` to `src/components/route-pending.tsx`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import { EmptyState } from 'basalt-ui/page'

export function RoutePending() {
  return (
    <div role="status" aria-live="polite">
      <EmptyState why="Loading this page." />
    </div>
  )
}
