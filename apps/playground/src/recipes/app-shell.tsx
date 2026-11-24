// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:app-shell
import { Outlet } from '@tanstack/react-router'
import { AppShell } from 'basalt-ui/shell'
import { NAV } from '../lib/nav'

// src/routes/_app.tsx: the pathless layout `init` writes. One AppShell around the outlet;
// everything else is data on its props. A route outside `_app` renders with no shell.
export function AppLayout() {
  return (
    <AppShell
      nav={NAV}
      brand={{ name: 'Basalt' }}
      badges={{ board: { count: 4 } }}
      account={{ status: 'signed-out', onSignIn: () => undefined }}
    >
      <Outlet />
    </AppShell>
  )
}
// #endregion
