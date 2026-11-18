import { createFileRoute } from '@tanstack/react-router'
import { Page, Section } from 'basalt-ui/page'
import type { ReactElement } from 'react'
import { TwoPane, seedBars } from '../../recipes/two-pane'

const BARS = seedBars()

/** The two-pane recipe as a page: price and momentum share one cursor and one y gutter. */
function TwoPaneRoute(): ReactElement {
  return (
    <Page area="recipe-two-pane">
      <Section title="Price and momentum" summary="Hover either pane: the cursor follows in both">
        <TwoPane bars={BARS} />
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/recipes/two-pane')({
  staticData: { title: 'Two panes' },
  component: TwoPaneRoute,
})
