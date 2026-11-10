import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { garmin } from '../stores'

// `extend` keeps the brand while adding a foreign param.
export const Route = createFileRoute('/garmin-health')({
  validateSearch: garmin.extend(z.object({ item: z.string().optional() })),
  search: { middlewares: garmin.middlewares },
  component: () => <pre>{JSON.stringify(garmin.useValues())}</pre>,
})
