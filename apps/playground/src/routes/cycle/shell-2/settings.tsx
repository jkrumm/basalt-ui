import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '../../../cycle/shell-2/SettingsPage'
import { settings } from '../../../cycle/shell-2/fleet-store'
import { SCREENS } from '../../../cycle/shell-2/route-screens'

// Shell cycle 2 (docs/v3/cycles/shell-2.md), page 3: settings with an InnerNav.
export const Route = createFileRoute('/cycle/shell-2/settings')({
  ...SCREENS,
  staticData: { title: 'Settings' },
  validateSearch: settings.validateSearch,
  search: { middlewares: settings.middlewares },
  component: SettingsPage,
})
