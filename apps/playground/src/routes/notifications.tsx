import { createFileRoute } from '@tanstack/react-router'
import { NotificationsDemoPage } from '../demo/NotificationsDemoPage'

export const Route = createFileRoute('/notifications')({
  staticData: { title: 'Notifications' },
  component: NotificationsDemoPage,
})
