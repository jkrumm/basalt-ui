---
name: add-page
use-when: adding a destination to an AppShell app: one file route, one nav entry
file: apps/playground/src/routes/index.tsx
---

A page is a file route plus one entry in the app's `defineNav` declaration. The rail, the phone tab bar, the breadcrumb and the document title all read that entry, so nothing else lists the page. `PageBar title` renders the page's one `h1`; the shell shows it as the breadcrumb leaf. Put a page's actions in `PageBar actions` (at most five, one `primary`), never in the body.

```tsx
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
```
