import { createFileRoute } from '@tanstack/react-router'
import { Page, PageBar, Section } from 'basalt-ui/page'

// #region recipe:add-page
// src/routes/_app/runs.tsx: a page is one file under `_app`, the layout that mounts the shell,
// plus one nav entry in `src/lib/nav.tsx`, e.g.:
//   { id: 'runs', label: 'Runs', icon: Flask, mobile: 'tab', link: linkOptions({ to: '/runs' }) }
// The shell names the page from that entry and `PageBar title` renders the one h1.
// The route tree (`src/routeTree.gen.ts`) is written by the router plugin on the next `vite` run;
// `tsc` reads it, so `build` is `vite build && tsc -b`, never `tsc -b` first.
function RunsPage() {
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

export const Route = createFileRoute('/_app/runs')({ component: RunsPage })
// #endregion
