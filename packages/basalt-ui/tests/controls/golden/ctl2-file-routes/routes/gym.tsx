import { createFileRoute } from '@tanstack/react-router'
import { gym } from '../stores'

type Item = { item?: string }

// A foreign param through extend(): any Standard Schema; the brand survives.
const itemSchema = {
  '~standard': {
    version: 1,
    vendor: 'fixture',
    validate: (value: unknown) => {
      const item = (value as Item).item
      return { value: typeof item === 'string' ? { item } : {} }
    },
    types: undefined as unknown as { input: Item; output: Item },
  },
} as const

export const Route = createFileRoute('/gym')({
  validateSearch: gym.extend(itemSchema),
  search: { middlewares: gym.middlewares },
  component: () => <pre>{JSON.stringify(gym.useValues())}</pre>,
})
