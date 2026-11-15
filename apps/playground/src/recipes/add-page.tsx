import { createFileRoute } from '@tanstack/react-router'
import { Page, PageBar, Section } from 'basalt-ui/page'

// #region recipe:add-page
// A page is one file route plus one nav entry in the app's `defineNav` declaration, e.g.:
//   { id: 'runs', label: 'Runs', icon: Flask, mobile: 'tab', link: linkOptions({ to: '/runs' }) }
// The shell names the page from that entry and `PageBar title` renders the one h1.
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

export const Route = createFileRoute('/overview')({ component: RunsPage })
// #endregion
