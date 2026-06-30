import { createFileRoute, redirect } from '@tanstack/react-router'

// The shell's first destination is the dashboard; `/` has no content of its own.
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/dashboard' })
  },
})
