import { linkOptions } from '@tanstack/react-router'
import type { AnyRoute } from '@tanstack/react-router'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { defineNav } from 'basalt-ui/router'
import { AppShell } from 'basalt-ui/shell'
import type { ReactElement } from 'react'

// Type-only: `defineNav` refuses to type-check until a router is registered. No router is built and
// nothing here runs; the registered type only lets the nav's `to` values compile.
declare module '@tanstack/react-router' {
  interface Register {
    router: { routeTree: AnyRoute }
  }
}
const NAV = defineNav({
  sections: [
    {
      id: 'overview',
      label: 'Overview',
      items: [
        { id: 'home', label: 'Home', mobile: 'tab', link: linkOptions({ to: '/' }) },
        { id: 'runs', label: 'Runs', mobile: 'tab', link: linkOptions({ to: '/runs' }) },
        {
          id: 'settings',
          label: 'Settings',
          mobile: 'more',
          link: linkOptions({ to: '/settings' }),
        },
      ],
    },
  ],
})

export function Demo(): ReactElement {
  return (
    <AppShell nav={NAV} brand={{ name: 'Basalt' }}>
      <Page area="home">
        <PageBar title="Home" />
        <Section title="Overview">
          <p className="m-0 text-sm text-muted-foreground">Twelve runs are open.</p>
        </Section>
      </Page>
    </AppShell>
  )
}
