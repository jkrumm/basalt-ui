import { createFileRoute } from '@tanstack/react-router'
import { Page } from 'basalt-ui/page'
import type { ReactElement } from 'react'
import { RUNS } from '../../demo/runs'
import { Runs, runs } from '../../recipes/view-switch'

/** The view-switch recipe as a page: its own page bar tabs switch the runs between table and cards. */
function ViewSwitchRoute(): ReactElement {
  return (
    <Page area="recipe-view-switch">
      <Runs data={RUNS} />
    </Page>
  )
}

export const Route = createFileRoute('/recipes/view-switch')({
  staticData: { title: 'View switch' },
  validateSearch: runs.validateSearch,
  search: { middlewares: runs.middlewares },
  component: ViewSwitchRoute,
})
