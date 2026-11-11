import { Outlet, createRootRoute } from '@tanstack/react-router'
import { globals } from '../stores'

export const Route = createRootRoute({
  validateSearch: globals.validateSearch,
  search: { middlewares: globals.middlewares },
  component: Outlet,
})
