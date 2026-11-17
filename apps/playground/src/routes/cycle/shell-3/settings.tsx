import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '../../../cycle/shell-3/SettingsPage'
import { settings } from '../../../cycle/shell-3/fleet-store'

// Shell cycle 3 (docs/v3/cycles/shell-3.md), page 3: settings with an InnerNav.
export const Route = createFileRoute('/cycle/shell-3/settings')({
  staticData: { title: 'Settings' },
  validateSearch: settings.validateSearch,
  search: { middlewares: settings.middlewares },
  component: SettingsPage,
})
