import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { fin } from '../stores'

// The layout mounts the store: validator, and the [strip, retain] middlewares for the subtree.
export const Route = createFileRoute('/finance')({
  validateSearch: fin.validateSearch,
  search: { middlewares: fin.middlewares },
  component: () => (
    <nav>
      <Link to="/finance/spending">spending</Link>
      <Link to="/finance/tax" search={{ year: '2025' }}>
        tax
      </Link>
      <Outlet />
    </nav>
  ),
})
