import { createFileRoute } from '@tanstack/react-router'
import { Facts, Page, PageAside, Section } from 'basalt-ui/page'
import { useWindowChrome } from 'basalt-ui/shell'
import type { ReactElement } from 'react'

// #region page-aside
// A docked aside: a page claims the shell's right region, which opens at the full-width size class
// and becomes a sheet opened from the header on a phone.
function AsideBody(): ReactElement {
  return (
    <PageAside title="Display" dock="always" width={320}>
      <p className="m-0 text-sm text-muted-foreground">
        The aside is the shell's fourth region: docked here, a sheet from the header on a phone.
      </p>
    </PageAside>
  )
}
// #endregion

/**
 * The shell: what the one `AppShell` in `routes/__root.tsx` draws, read from the declarations that
 * drive it. The window chrome row reads `useWindowChrome`; open the page with
 * `?chrome=native-overlay` to see the desktop window's header.
 */
function ShellRoute(): ReactElement {
  const { chrome, leadInset } = useWindowChrome()
  return (
    <Page area="shell">
      <Section title="Navigation">
        <Facts
          rows={[
            { label: 'Declared', value: 'Once, with defineNav in demo/nav-model.tsx' },
            { label: 'Sections', value: 'Tour open; Reference, Kit, Forms and Recipes folded' },
            { label: 'Phone tabs', value: 'Start, Parts, Settings, Dashboard; the rest in More' },
            { label: 'Badge', value: 'Mail shows 3, its folded section carries the sum' },
            { label: 'Palette', value: 'Mod K, or the search row of the rail' },
          ]}
        />
      </Section>
      <Section title="Rail and header">
        <Facts
          rows={[
            { label: 'Workspace', value: 'The switcher at the top of the rail' },
            { label: 'Progress', value: 'Getting started, pinned above the footer' },
            { label: 'Footer', value: 'Settings menu and the signed-out account row' },
            { label: 'Appearance', value: 'Density, frame and accent, from the header' },
            { label: 'Window chrome', value: chrome },
            { label: 'Lead inset', value: `${leadInset} px` },
          ]}
        />
      </Section>
      <AsideBody />
    </Page>
  )
}

export const Route = createFileRoute('/shell')({
  staticData: { title: 'Shell' },
  component: ShellRoute,
})
