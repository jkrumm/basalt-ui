import { createFileRoute } from '@tanstack/react-router'
import { Page, Section } from 'basalt-ui/page'
import type { ReactElement } from 'react'
import { RUNS } from '../../demo/runs'
import { Runs, runs } from '../../recipes/saved-views'

/** The saved-views recipe as a page: the toolbar saves the table's filter and sort as a named view. */
function SavedViewsRoute(): ReactElement {
  return (
    <Page area="recipe-saved-views">
      <Section title="Runs">
        <Runs data={RUNS} />
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/recipes/saved-views')({
  staticData: { title: 'Saved views' },
  validateSearch: runs.validateSearch,
  search: { middlewares: runs.middlewares },
  component: SavedViewsRoute,
})
