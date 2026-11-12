---
name: inner-nav
use-when: a page of sibling sections or records with a list beside the one open pane (settings)
file: apps/playground/src/routes/settings.tsx
---

`SplitPage` pairs a list with a pane; `InnerNav` is the list. The section is a push field, so every item is a real `<a href>` and Back walks the sections you opened. Pass the field's `isSet` as `selected`: below the narrow tier the list shows while it is unset and the pane once a section is open. The DOM is the same at every width. Group items under labels; give an item a `badge` for a count or an attention dot.

```tsx
function SettingsPane({ id }: { id: SectionId }): ReactElement {
  const { title, body } = COPY[id]
  return (
    <Section title={title}>
      <p className="m-0 text-sm text-muted-foreground">{body}</p>
    </Section>
  )
}

export function SettingsPage(): ReactElement {
  const [current] = section.use()
  const selected = useIsSet()
  return (
    <Page area="settings">
      <PageBar title="Settings" />
      <SplitPage
        selected={selected}
        list={() => <InnerNav label="Settings sections" state={section} groups={GROUPS} />}
        detail={() => <SettingsPane id={current} />}
      />
    </Page>
  )
}
```
