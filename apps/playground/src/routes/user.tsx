import { createFileRoute } from '@tanstack/react-router'
import { UserStatePage } from '../demo/UserStatePage'

export const Route = createFileRoute('/user')({
  staticData: { title: 'User' },
  component: UserStatePage,
})
