import { createFileRoute } from '@tanstack/react-router'
import { gym } from '../stores'

export const Route = createFileRoute('/gym')({
  validateSearch: gym.validateSearch,
  search: { middlewares: gym.middlewares },
  component: () => <pre>{JSON.stringify(gym.useValues())}</pre>,
})
