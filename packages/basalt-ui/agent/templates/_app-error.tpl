/**
 * `defaultErrorComponent`: branches on a structural `status` (any error that carries a numeric one,
 * as an API client's does): 403 is forbidden, 401 sends the user to the session path, anything
 * else is the crash copy with a retry.
 *
 * Scaffold written by `basalt-ui init` to `src/components/route-error.tsx`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import type { ErrorComponentProps } from '@tanstack/react-router'
import { EmptyState } from 'basalt-ui/page'

/** The session path: where a 401 goes. Change it to the app's sign-in route. */
const SIGN_IN = '/login'

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('status' in error)) return undefined
  return typeof error.status === 'number' ? error.status : undefined
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  const status = statusOf(error)
  if (status === 403) return <EmptyState why="You do not have access to this page." />
  if (status === 401)
    return (
      <EmptyState
        why="Your session ended. Sign in again to continue."
        action={{ label: 'Sign in', href: SIGN_IN }}
      />
    )
  return (
    <EmptyState
      why="Something went wrong loading this page. Try again."
      action={{ label: 'Try again', onSelect: reset }}
    />
  )
}
