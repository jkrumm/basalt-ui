/**
 * The pathless `_app` layout: the frame (`AppShell`) every signed-in page renders in. A route
 * outside it (`login`, `welcome`) is a `<Page landmark>` with no shell. The auth gate is
 * `beforeLoad`: once the app has a sign-in route, throw `redirect({ to: '/login' })` from it when
 * there is no session, so a guarded page never flashes before the redirect.
 *
 * Scaffold written by `basalt-ui init` to `src/routes/_app.tsx`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppShell } from 'basalt-ui/shell'
import { NAV } from '../lib/nav'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

// Exported: react/only-export-components flags a non-exported component in a file that exports `Route`.
export function AppLayout() {
  return (
    <AppShell nav={NAV} brand={{ name: '{{APP_NAME}}' }}>
      <Outlet />
    </AppShell>
  )
}
