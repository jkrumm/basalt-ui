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
that scrolls the detail. With `scroll="panes"` both panes fill the page's height instead, and each brings its own scroller.

## Signature

```ts
SplitPage({ selected, onBack, backLabel, list, detail, resize, scroll, }: SplitPageProps): ReactElement
  selected: boolean  // Narrow: the list while unset, the pane when set
  onBack?: () => void  // The way back below the `wide` tier, written from the same field that `selected` reads: the pane field's `clear`
  backLabel?: string  // The back link's text; names the list (`Settings`)
  list: () => ReactNode
  detail: () => ReactNode
  resize?: { id: string; initial?: number; min?: number; max?: number; }  // The list column's width becomes the reader's: a separator on its end edge (pointer, arrows, Home and End, Enter or a double click to reset), remembered on the device per id
  scroll?: "page" | "panes"  // Who scrolls: 'page' (default) the list in its own ScrollArea and the detail with the page; 'panes' both panes are bounded to the page's height and each brings its own scroller (a virtual list, a ScrollArea), for a fill page such as a mailbox
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
