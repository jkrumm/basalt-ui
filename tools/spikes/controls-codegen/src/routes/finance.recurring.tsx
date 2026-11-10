import { createFileRoute } from '@tanstack/react-router'
import { fin } from '../stores'

// Repeats the validator, as argo's child pages do today.
export const Route = createFileRoute('/finance/recurring')({
  validateSearch: fin.validateSearch,
  component: () => <pre>{JSON.stringify(fin.useValues())}</pre>,
})
