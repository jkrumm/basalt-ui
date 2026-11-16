---
name: add-page
use-when: adding a destination to an AppShell app: one file route, one nav entry
---

A page is a file route under `src/routes/_app/`, the pathless layout `init` writes, plus one entry in the app's `defineNav` declaration. A route outside `_app` renders with no shell. The rail, the phone tab bar, the breadcrumb and the document title all read that entry, so nothing else lists the page. `PageBar title` renders the page's one `h1`; the shell shows it as the breadcrumb leaf. Put a page's actions in `PageBar actions` (at most five, one `primary`), never in the body.

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { Page, PageBar, Section } from 'basalt-ui/page'

// src/routes/_app/runs.tsx: a page is one file under `_app`, the layout that mounts the shell,
// plus one nav entry in `src/lib/nav.tsx`, e.g.:
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

export const Route = createFileRoute('/_app/runs')({ component: RunsPage })
```
