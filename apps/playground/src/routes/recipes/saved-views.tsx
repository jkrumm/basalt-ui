import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { RUNS } from '../../demo/runs'
import { Runs, runs } from '../../recipes/saved-views'

/** The saved-views recipe as a list page: the view row holds the views, the panel edits one. */
function SavedViewsRoute(): ReactElement {
  return <Runs data={RUNS} />
}

export const Route = createFileRoute('/recipes/saved-views')({
  staticData: { title: 'Saved views' },
  validateSearch: runs.validateSearch,
  search: { middlewares: runs.middlewares },
  component: SavedViewsRoute,
})
