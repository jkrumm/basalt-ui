import { createFileRoute } from '@tanstack/react-router'
import { MobileNavPillPage } from '../demo/MobileNavPillPage'

// The mobile bar's active pill, with and without an icon dependency — the surface both round-4
// pill defects are looked at on. See the page's own JSDoc.
export const Route = createFileRoute('/mobile-nav-pill')({
  staticData: { title: 'Mobile nav pill' },
  component: MobileNavPillPage,
})
