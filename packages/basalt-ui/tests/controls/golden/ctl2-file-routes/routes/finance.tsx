import { Outlet, createFileRoute } from '@tanstack/react-router'
import { fin } from '../stores'

// The layout mounts the store; its children inherit the validator.
export const Route = createFileRoute('/finance')({
  validateSearch: fin.validateSearch,
  search: { middlewares: fin.middlewares },
  component: Outlet,
})
