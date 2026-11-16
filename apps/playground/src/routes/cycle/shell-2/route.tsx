import { Outlet, createFileRoute } from '@tanstack/react-router'
import { SCREENS } from '../../../cycle/shell-2/route-screens'

// Shell cycle 2 (docs/v3/cycles/shell-2.md): the fleet app's layout route. It draws nothing of its
// own; it holds the not-found screen for a path under /cycle/shell-2 that no page matches.
export const Route = createFileRoute('/cycle/shell-2')({
  ...SCREENS,
  component: Outlet,
})
