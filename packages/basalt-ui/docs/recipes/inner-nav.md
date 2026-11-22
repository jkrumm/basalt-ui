---
name: inner-nav
use-when: a page of sibling sections or records with a list beside the one open pane (settings)
---

`SplitPage` pairs a list with a pane; `InnerNav` is the list. The section is a push field, so every item is a real `<a href>` and Back walks the sections you opened. Pass the field's `useIsSet()` as `selected`: below the narrow tier the list shows while it is unset and the pane once a section is open, the fallback section included (choosing it writes `?section=<fallback>`; `clear()` closes the pane). The DOM is the same at every width. Group items under labels; give an item a `badge` for a count or an attention dot. `PANES` maps a section id to its pane; a section without one shows its copy.

```tsx
import { useRouterState } from '@tanstack/react-router'
import { InnerNav, Page, PageBar, SettingsLayout, SplitPage } from 'basalt-ui/page'
import type { ReactElement } from 'react'

function SettingsPane({ id }: { id: SectionId }): ReactElement {
  const { title, body } = COPY[id]
  const [edited] = settings.field.edited.use()
  // Under a router a hash change is a `pushState`, which fires no event: pass the row from the router.
  const hash = useRouterState({ select: (state) => state.location.hash })
  return (
    <SettingsLayout title={title} description={body} {...(hash !== '' && { row: hash })}>
      {id === 'profile' && <ProfilePane edited={edited} />}
      {id === 'preferences' && <PreferencesPane />}
      {id === 'notifications' && <NotificationsPane />}
      {id === 'workspace' && <WorkspacePane />}
    </SettingsLayout>
  )
}

export function SettingsPage(): ReactElement {
  const [current] = section.use()
  const [q] = settings.field.q.use()
  const selected = section.useIsSet()
  return (
    <Page area="settings">
      <PageBar title="Settings" />
      <SplitPage
        selected={selected}
        list={() => (
          <InnerNav
            label="Settings sections"
            state={section}
            filter={searchFilter}
            groups={groupsFor(q)}
          />
        )}
        detail={() => <SettingsPane id={current} />}
      />
    </Page>
  )
}
```
