/**
 * `defaultNotFoundComponent`: a path no route matched.
 *
 * Scaffold written by `basalt-ui init` to `src/components/route-missing.tsx`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import { EmptyState } from 'basalt-ui/page'

export function RouteMissing() {
  return (
    <EmptyState
      why="This page does not exist. Check the address, or start from the home page."
      action={{ label: 'Go home', href: '/' }}
    />
  )
}
