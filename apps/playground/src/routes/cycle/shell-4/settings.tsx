import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '../../../cycle/shell-4/SettingsPage'
import { settings } from '../../../cycle/shell-4/fleet-store'

// Shell cycle 4 (docs/v3/cycles/shell-4.md), page 3: settings with an InnerNav.
export const Route = createFileRoute('/cycle/shell-4/settings')({
  staticData: { title: 'Settings' },
  validateSearch: settings.validateSearch,
  search: { middlewares: settings.middlewares },
  component: SettingsPage,
})
