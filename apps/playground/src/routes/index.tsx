/**
 * The landing page is the tour: the stops of the nav's `tour` section in order, each a card that
 * links to its page and names the parts it proves.
 */
import { Link, createFileRoute } from '@tanstack/react-router'
import { CardGrid, Page } from 'basalt-ui/page'
import { Card } from 'basalt-ui/ui/card'
import type { ReactElement } from 'react'
import { NAV } from '../demo/nav-model'
import { TOUR } from '../demo/tour'

const STOPS = (NAV.sections.find((section) => section.id === 'tour')?.items ?? []).filter(
  (item) => item.id !== 'home',
)

function IndexRoute(): ReactElement {
  return (
    <Page area="home">
      <CardGrid min="narrow">
        {STOPS.map((item, index) => {
          const stop = TOUR[item.id]
          return (
            <Card key={item.id} render={<Link {...item.link} />}>
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span className="text-muted-foreground tabular-nums">{index + 1}</span>
                  {item.label}
                </span>
                <span className="text-sm text-muted-foreground">{stop?.line}</span>
                <span className="font-mono text-xs text-muted-foreground">{stop?.parts}</span>
              </div>
            </Card>
          )
        })}
      </CardGrid>
    </Page>
  )
}

export const Route = createFileRoute('/')({
  staticData: { title: 'Tour' },
  component: IndexRoute,
})
