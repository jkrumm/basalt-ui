import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { AppShell } from 'basalt-ui/shell'
import { NAV } from '../demo/nav-model'
import { SCENARIO_INFO } from '../scenarios/scenario-info'

// #region recipe:add-page
// A page is one file route plus one nav entry, e.g. in demo/nav-model.tsx:
//   { id: 'runs', label: 'Runs', icon: Flask, mobile: 'tab', link: linkOptions({ to: '/runs' }) }
// The shell names the page from that entry and `PageBar title` renders the one h1.
export function RunsPage() {
  return (
    <Page area="runs">
      <PageBar
        title="Runs"
        actions={[{ id: 'new', label: 'New run', primary: true, onClick: () => undefined }]}
      />
      <Section title="Latency">
        <p className="text-sm text-muted-foreground">Last 7 days, p95 per route.</p>
      </Section>
    </Page>
  )
}
// #endregion

// #region recipe:app-shell
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
// #endregion

/** The landing page: the shell recipes in one line each, then every scenario a human opens. */
function IndexRoute() {
  return (
    <Page area="home">
      <PageBar title="Playground" />
      <Section title="Recipes">
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
          <li>
            <span className="font-medium">add-page</span>
            <span className="text-muted-foreground"> — a file route plus one nav entry.</span>
          </li>
          <li>
            <span className="font-medium">app-shell</span>
            <span className="text-muted-foreground"> — one AppShell in the root route.</span>
          </li>
          <li>
            <Link to="/shell" className="font-medium underline-offset-4 hover:underline">
              Shell
            </Link>
            <span className="text-muted-foreground"> — a page bar and a docked aside.</span>
          </li>
        </ul>
      </Section>
      <Section title="Open a scenario">
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
          {SCENARIO_INFO.map(({ id, title, blurb }) => (
            <li key={id}>
              <Link
                to="/scenarios/$name"
                params={{ name: id }}
                className="font-medium underline-offset-4 hover:underline"
              >
                {title}
              </Link>
              <span className="text-muted-foreground"> — {blurb}</span>
            </li>
          ))}
        </ul>
      </Section>
    </Page>
  )
}

export const Route = createFileRoute('/')({
  staticData: { title: 'Playground' },
  component: IndexRoute,
})
