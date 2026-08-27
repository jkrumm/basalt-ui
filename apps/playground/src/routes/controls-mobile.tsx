import { createFileRoute } from '@tanstack/react-router'
import { ControlsMobilePage } from '../demo/ControlsMobilePage'
import { mobileFilters } from '../demo/controls-mobile-store'

// The phone surface for the controls tier: the `Filters (n)` sheet, the shared kebab, the sticky
// in-flow row 2, and a `stickyHeader` table clearing it. See the page's own JSDoc.
export const Route = createFileRoute('/controls-mobile')({
  staticData: { title: 'Controls (mobile)' },
  validateSearch: mobileFilters.validateSearch,
  component: ControlsMobilePage,
})
