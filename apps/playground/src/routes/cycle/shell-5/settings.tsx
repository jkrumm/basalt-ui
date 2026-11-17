import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '../../../cycle/shell-5/SettingsPage'
import { settings } from '../../../cycle/shell-5/fleet-store'

// Shell cycle 5 (docs/v3/cycles/shell-5.md), page 3: settings with an InnerNav.
export const Route = createFileRoute('/cycle/shell-5/settings')({
  staticData: { title: 'Settings' },
  validateSearch: settings.validateSearch,
  search: { middlewares: settings.middlewares },
  component: SettingsPage,
})
