import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '../../../cycle/shell-1/SettingsPage'
import { settings } from '../../../cycle/shell-1/fleet-store'

// Shell cycle 1 (docs/v3/cycles/shell-1.md), page 3: settings with an InnerNav.
export const Route = createFileRoute('/cycle/shell/settings')({
  staticData: { title: 'Settings' },
  validateSearch: settings.validateSearch,
  search: { middlewares: settings.middlewares },
  component: SettingsPage,
})
