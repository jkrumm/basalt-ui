import { createFileRoute } from '@tanstack/react-router'
import { ComponentsPage } from '../demo/ComponentsPage'
import { validateShotSearch } from '../scenarios/shot-state'

export const Route = createFileRoute('/components')({
  staticData: { title: 'Components' },
  validateSearch: validateShotSearch,
  component: ComponentsRoute,
})

function ComponentsRoute() {
  const search = Route.useSearch()
  return <ComponentsPage shotState={search['shot-state']} />
}
