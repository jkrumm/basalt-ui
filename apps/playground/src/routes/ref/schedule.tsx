import { createFileRoute, linkOptions } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Schedule } from 'basalt-ui/cards'
import { shotState } from 'basalt-ui/data'
import { Page, PageBar } from 'basalt-ui/page'
import { defineControls, field, navTarget } from 'basalt-ui/router'
import { Calendar } from 'basalt-ui/ui/calendar'
import { Truck } from 'lucide-react'
import type { ReactElement } from 'react'
import { TODAY } from '../../demo/ref-inventory'
import { visitsQuery } from '../../demo/ref-schedule'
import type { Visit } from '../../demo/ref-schedule'

/** The view and the shown day live in the address: a shared link opens the same week. */
const store = defineControls({
  id: 'ref-schedule',
  scope: 'page',
  fields: {
    view: field
      .enum(['week', 'month', 'day'], 'week')
      .labels({ week: 'Week', month: 'Month', day: 'Day' }),
    date: field.string(''),
  },
})

const visitLink = (v: Visit) =>
  navTarget(linkOptions({ to: '/ref/events/$id', params: { id: v.id } }))

/**
 * The reference schedule: the inventory's deliveries and supplier calls by the week, the month or
 * the day, the mini month and the next entries in the rail. An entry is a record link, so the
 * app's peek opens it beside the schedule and the address holds it.
 */
function ScheduleRoute(): ReactElement {
  const query = shotState(useQuery(visitsQuery))
  return (
    <Page area="ref-schedule" fill>
      <PageBar
        actions={[
          {
            id: 'new',
            label: 'Book delivery',
            icon: Truck,
            primary: true,
            onClick: () => undefined,
          },
        ]}
      />
      <div data-shot="schedule" className="flex min-h-0 flex-1 flex-col">
        <Schedule
          label="Deliveries and supplier calls"
          events={query.data}
          phase={query}
          view={store.field.view}
          date={store.field.date}
          href={visitLink}
          onSlot={() => undefined}
          rail={{ month: Calendar }}
          now={TODAY}
        />
      </div>
    </Page>
  )
}

export const Route = createFileRoute('/ref/schedule')({
  staticData: { title: 'Schedule' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: ScheduleRoute,
})
