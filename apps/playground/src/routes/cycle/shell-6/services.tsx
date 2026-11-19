import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'
import { ServicesPending } from '../../../cycle/shell-6/pending'
import { deploysQuery, servicesQuery } from '../../../cycle/shell-6/queries'
import { ServicesPage, services } from '../../../cycle/shell-6/services-page'

const SHOT = z.object({ 'shot-state': z.enum(['empty', 'loading', 'error']).optional() })

export const Route = createFileRoute('/cycle/shell-6/services')({
  staticData: { title: 'Services' },
  validateSearch: services.extend(SHOT),
  search: { middlewares: services.middlewares },
  loaderDeps: ({ search }) => ({ service: search.service, shot: search['shot-state'] }),
  loader: async ({ context, deps }) => {
    const dial = deps.shot === 'empty' || deps.shot === 'error' ? deps.shot : undefined
    const deploys = context.queryClient
      .query(deploysQuery(deps.service, dial))
      .catch((error: unknown) => {
        if (
          typeof error === 'object' &&
          error !== null &&
          'status' in error &&
          error.status === 404
        ) {
          throw notFound({
            data: {
              message: `No service has the id "${deps.service}".`,
              link: { to: '/cycle/shell-6/services', label: 'Back to services' },
            },
          })
        }
        throw error
      })
    const [list, rows] = await Promise.all([
      context.queryClient.query(servicesQuery(dial)),
      deploys,
    ])
    return { services: list, deploys: rows }
  },
  pendingComponent: ServicesPending,
  component: ServicesRoute,
})

function ServicesRoute() {
  const data = Route.useLoaderData()
  const shot = Route.useSearch({ select: (s) => s['shot-state'] })
  return <ServicesPage data={shot === 'loading' ? undefined : data} />
}
