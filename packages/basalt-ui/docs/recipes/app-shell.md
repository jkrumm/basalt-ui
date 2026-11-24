---
name: app-shell
use-when: mounting the application frame once, in the `_app` layout route
---

One `AppShell` wraps the outlet of the `_app` layout route (`src/routes/_app.tsx`, written by `init`); `__root.tsx` stays a bare outlet. The nav, brand, badges, blocks, settings and account are data props, so the rail, the tab bar and the More sheet are projections of one declaration. The shell owns the skip link, the `main` landmark, the route announcer, the document title and print. Declare `NAV` at module scope with `defineNav` from `basalt-ui/router`, and register the router type so a `to` that names no route is a compile error.

```tsx
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
```
