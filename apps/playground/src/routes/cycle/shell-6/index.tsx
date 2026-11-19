import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { DAYS, OverviewPage, overview } from '../../../cycle/shell-6/overview-page'
import { overviewQuery } from '../../../cycle/shell-6/queries'
import { OverviewPending } from '../../../cycle/shell-6/pending'

const SHOT = z.object({ 'shot-state': z.enum(['empty', 'loading', 'error']).optional() })

export const Route = createFileRoute('/cycle/shell-6/')({
  staticData: { title: 'Fleet overview' },
  validateSearch: overview.extend(SHOT),
  search: { middlewares: overview.middlewares },
  loaderDeps: ({ search }) => ({ window: search.window, shot: search['shot-state'] }),
  loader: ({ context, deps }) =>
    context.queryClient.query(
      overviewQuery(
        DAYS[deps.window],
        deps.shot === 'empty' || deps.shot === 'error' ? deps.shot : undefined,
      ),
    ),
  pendingComponent: OverviewPending,
  component: OverviewRoute,
})

function OverviewRoute() {
  const data = Route.useLoaderData()
  const shot = Route.useSearch({ select: (s) => s['shot-state'] })
  return <OverviewPage data={shot === 'loading' ? undefined : data} />
}
