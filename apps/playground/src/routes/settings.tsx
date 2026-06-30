import { createFileRoute } from '@tanstack/react-router'
import { SettingsPage } from '../demo/SettingsPage'

export const Route = createFileRoute('/settings')({
  staticData: { title: 'Settings' },
  component: SettingsPage,
})
