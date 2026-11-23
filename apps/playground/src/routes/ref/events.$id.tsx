import { createFileRoute, linkOptions } from '@tanstack/react-router'
import { EmptyState, Page, PageBar } from 'basalt-ui/page'
import { navTarget } from 'basalt-ui/router'
import type { ReactElement } from 'react'
import { visitOf } from '../../demo/ref-schedule'
import { VisitFacts } from '../../demo/ref-visit'

export const Route = createFileRoute('/ref/events/$id')({
  staticData: { title: 'Schedule entry' },
  component: EventRoute,
})

const parent = { label: 'Schedule', href: navTarget(linkOptions({ to: '/ref/schedule' })) }

/** A schedule entry's own page: the full view of what the peek shows beside the schedule. */
function EventRoute(): ReactElement {
  const { id } = Route.useParams()
  const visit = visitOf(id)
  if (visit === undefined) {
    return (
      <Page area="ref-event">
        <PageBar title="Entry" parent={parent} />
        <EmptyState cause={`No schedule entry has the id ${id}.`} />
      </Page>
    )
  }
  return (
    <Page area="ref-event">
      <PageBar title={visit.title} parent={parent} />
      <VisitFacts visit={visit} />
    </Page>
  )
}
