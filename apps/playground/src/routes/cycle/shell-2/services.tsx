import { createFileRoute, notFound } from '@tanstack/react-router'
import type { ReactElement } from 'react'
import { ServicesPage } from '../../../cycle/shell-2/ServicesPage'
import { fleetApi } from '../../../cycle/shell-2/fleet-api'
import { services } from '../../../cycle/shell-2/fleet-store'
import { SCREENS } from '../../../cycle/shell-2/route-screens'

// Shell cycle 2 (docs/v3/cycles/shell-2.md), page 2: the services list. The loader is the route's
// pending (first visit, 700 ms), error (the overview's "Simulate outage") and missing (an unknown
// `?service=`) states.
export const Route = createFileRoute('/cycle/shell-2/services')({
  ...SCREENS,
  staticData: { title: 'Services' },
  validateSearch: services.validateSearch,
  search: { middlewares: services.middlewares },
  loaderDeps: ({ search }) => ({ service: search.service }),
  loader: async ({ deps }) => {
    const list = await fleetApi.services()
    if (
      deps.service !== undefined &&
      deps.service !== '' &&
      !list.some((s) => s.id === deps.service)
    )
      throw notFound({
        data: {
          message: `There is no service named ${deps.service}.`,
          link: { to: '/cycle/shell-2/services', label: 'Back to the services' },
        },
      })
    return list
  },
  component: ServicesRoute,
})

function ServicesRoute(): ReactElement {
  return <ServicesPage list={Route.useLoaderData()} />
}
