import { createFileRoute } from '@tanstack/react-router'
import { ScenarioView } from '../scenarios/ScenarioView'
import { validateShotSearch } from '../scenarios/shot-state'

// One dynamic route for every scenario fixture (docs/waves/design-parity/SPEC.md § 2, D9): the
// registry in `scenarios/` owns the pages, `basalt-ui shot` reaches a state through `?shot-state=`.
export const Route = createFileRoute('/scenarios/$name')({
  staticData: { title: 'Scenarios' },
  validateSearch: validateShotSearch,
  component: ScenarioRoute,
})

function ScenarioRoute() {
  const { name } = Route.useParams()
  const search = Route.useSearch()
  return <ScenarioView name={name} shotState={search['shot-state']} />
}
