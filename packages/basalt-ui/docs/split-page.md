---
name: SplitPage
use when: 'a page is a list of things plus the pane for the chosen one (settings sections, a record browser)'
never when: 'the detail is a transient inspector over a table (use `PageAside`) or the choices are views of one dataset (use `ViewTabs`)'
subpath: basalt-ui/page
peers: ['@base-ui/react', '@tanstack/react-router']
slots: [split-page, split-page-detail, split-page-list]
---

# SplitPage

A master and a detail on one page. From the `wide` container tier the list is a sticky column
beside the detail; below it one pane shows, the list while `selected` is false and the detail
once it is true. Both render props always mount and CSS alone hides the other pane, so there is
no viewport read and no second tree. The list column scrolls on its own (`ScrollArea`); the
detail grows with the page, so the page's own scrollport (the shell's main region) stays the one
that scrolls the detail.

## Signature

```ts
SplitPage({ selected, onBack, backLabel, list, detail, }: SplitPageProps): ReactElement
  selected: boolean  // Narrow: the list while unset, the pane when set
  onBack?: () => void  // The way back below the `wide` tier, written from the same field that `selected` reads: the pane field's `clear`
  backLabel?: string  // The back link's text; names the list (`Settings`)
  list: () => ReactNode
  detail: () => ReactNode
```

## Example

```tsx
<SplitPage
  selected={store.field.section.useIsSet()}
  onBack={store.field.section.clear}
  list={() => <InnerNav label="Settings" state={store.field.section} groups={GROUPS} />}
  detail={() => <SettingsPane section={section} />}
/>
```
