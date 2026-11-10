import { createFileRoute } from '@tanstack/react-router'
import { garmin } from '../stores'

// A hand wrapper over the store's validator: it works as a validator, but loses the brand, so a
// control write from this route is refused (controls-url-state.md 4.2).
export const Route = createFileRoute('/wrapped')({
  validateSearch: (raw: Record<string, unknown>) =>
    garmin.validateSearch['~standard'].validate(raw).value,
  component: () => <p>wrapped</p>,
})
