---
name: app-shell
use-when: mounting the application frame once, in the root route
file: apps/playground/src/routes/index.tsx
---

One `AppShell` wraps the root route's outlet. The nav, brand, badges, blocks, settings and account are data props, so the rail, the tab bar and the More sheet are projections of one declaration. The shell owns the skip link, the `main` landmark, the route announcer, the document title and print. Declare `NAV` at module scope with `defineNav` from `basalt-ui/router`, and register the router type so a `to` that names no route is a compile error.

```tsx
// routes/__root.tsx: one AppShell around the outlet. Everything else is data on its props.
export function ShellRoot() {
  return (
    <AppShell
      nav={NAV}
      brand={{ name: 'Basalt' }}
      badges={{ cards: { count: 4 } }}
      account={{ status: 'signed-out', onSignIn: () => undefined }}
    >
      <Outlet />
    </AppShell>
  )
}
```
