import { createFileRoute } from '@tanstack/react-router'
import { fin } from '../stores'

// Inherits the validator from the /finance layout.
export const Route = createFileRoute('/finance/')({
  component: () => <pre>{JSON.stringify(fin.useValues())}</pre>,
})
