import { createFileRoute } from '@tanstack/react-router'
import { Page, PageAside, PageBar, Section } from 'basalt-ui/page'

// #region page-aside
// A docked aside: a page claims the shell's right region, which opens at the full-width size class
// and becomes a sheet opened from the header on a phone.
function AsideBody() {
  return (
    <PageAside title="Display" dock="always" width={320}>
      <p className="m-0 text-sm text-muted-foreground">The aside is a fourth shell region.</p>
    </PageAside>
  )
}
// #endregion

/**
 * The shell demo: a page bar with an action, and a docked `PageAside`. The navigation, the rail and
 * the tab bar are the subject; the body says what to look at.
 */
function ShellRoute() {
  return (
    <Page area="shell">
      <PageBar
        title="Shell"
        actions={[{ id: 'tour', label: 'Take a tour', primary: true, onClick: () => undefined }]}
      />
      <Section title="Navigation">
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm text-muted-foreground">
          <li>
            One typed definition (demo/nav-model.tsx) feeds the rail, the tab bar and the
            breadcrumb.
          </li>
          <li>Four destinations are mobile tabs; the rest fold into More.</li>
          <li>The Cards entry carries a count badge.</li>
          <li>The Scenarios section is built from the scenario registry.</li>
        </ul>
      </Section>
      <Section title="Rail footer">
        <p className="m-0 text-sm text-muted-foreground">
          Settings and the account menu sit in the footer; the progress block pins above them.
        </p>
      </Section>
      <AsideBody />
    </Page>
  )
}

export const Route = createFileRoute('/shell')({
  staticData: { title: 'Shell' },
  component: ShellRoute,
})
