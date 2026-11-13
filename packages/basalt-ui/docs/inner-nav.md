---
name: InnerNav
use when: 'a page has named sections or panes the URL should remember (settings, the sections of a record)'
never when: 'the state is a `replace` field (it is a type error) or the choices are views of one dataset (use `ViewTabs`) or an inspector for a row (use `PageAside`)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [inner-nav, inner-nav-filter]
---

# InnerNav

A page's inner sidebar: groups of section links on a `push` field, so each section is a history
entry and Back walks them. Every item is a real `<a href>` through the handle's `link()`, with
`aria-current` on the active one, so middle-click, copy-link and the status bar all work. One DOM
at every width: a standalone nav is a vertical list from the `wide` container tier and a
horizontally scrolling link strip below it (never a `Select`, which would lose the hrefs); inside
a `SplitPage` list pane it stays a list. An item may carry a count or dot `badge` and a `menu`
of two or more actions (a single action is a plain button elsewhere). A section change resets
the page's scroll; a write to a `filter` control does not.

## Signature

```ts
InnerNav<K extends string = string>({ label, state, filter, groups, }: InnerNavProps<K>): ReactElement
  label: string
  state: PushField<K>
  filter?: { readonly kind: "controls-slot"; readonly count: number; r…
  groups: readonly InnerNavGroup[]
```
