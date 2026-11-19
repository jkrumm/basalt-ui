import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SettingsPending } from '../../../cycle/shell-6/pending'
import { settingsQuery } from '../../../cycle/shell-6/queries'
import { SettingsPage, settingsStore } from '../../../cycle/shell-6/settings-page'

const SHOT = z.object({ 'shot-state': z.enum(['empty', 'loading', 'error']).optional() })

export const Route = createFileRoute('/cycle/shell-6/settings')({
  staticData: { title: 'Fleet settings' },
  validateSearch: settingsStore.extend(SHOT),
  search: { middlewares: settingsStore.middlewares },
  loaderDeps: ({ search }) => ({ shot: search['shot-state'] }),
  loader: ({ context, deps }) =>
    context.queryClient.query(
      settingsQuery(deps.shot === 'empty' || deps.shot === 'error' ? deps.shot : undefined),
    ),
  pendingComponent: SettingsPending,
  component: SettingsRoute,
})

function SettingsRoute() {
  const settings = Route.useLoaderData()
  const shot = Route.useSearch({ select: (s) => s['shot-state'] })
  return <SettingsPage settings={shot === 'loading' ? undefined : settings} />
}
