import { createFileRoute, redirect } from '@tanstack/react-router'

/** The app has one landing page: the scenario index at `/scenarios`. */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/scenarios', replace: true })
  },
})
