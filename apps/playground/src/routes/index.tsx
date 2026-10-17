import { createFileRoute } from '@tanstack/react-router'
import { ScenarioIndex } from '../demo/ScenarioIndex'

// The landing page lists the scenarios; the dashboard is one nav entry away. `/` used to redirect to
// the dashboard with `dashboardFilters.linkSearch()` — the store's own click-time reader, so the
// redirect restated no defaults (law C10: writing `range: stored.range ?? '30d'` would pin '30d' the
// day the store's fallback moves). Any link added here to a store-backed route keeps that rule.
export const Route = createFileRoute('/')({
  staticData: { title: 'Playground' },
  component: ScenarioIndex,
})
