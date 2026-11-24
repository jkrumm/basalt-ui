---
source: basalt-ui
description: Shell, pages, controls, cards, tables, forms and content — compose the shipped frame.
paths:
  - '**/src/**'
---

# Basalt Page

A page is composed from the shipped frame; each bullet names what holds it.

## Shell and nav

- Declare the whole navigation once with `defineNav` and pass it to `AppShell`; a link to an unregistered route, an unknown badge key or a second badge on a row does not compile. [type:NavConfig] [type:NavBadges]
- Shell extensions are typed data (`GlobalAction`, `SidebarBlock`), never a node. [type:GlobalAction] [type:SidebarBlock]
- A route's page returns `Page` as its root, or `SplitPage` with `list` and `detail` as render functions; never a `div`, a fragment or a wrapper: `Page` owns the gutter and the top inset, so a page sets no padding or gap of its own. [lint:page-root] [type:SplitPageProps]
- A page is named once: by its nav label, or by `PageBar` `title` where there is no shell; never a raw heading, an in-body `h1` included. A record page gives `PageBar` an `identity` (face, subtitle, tags) and never repeats its name in an `EntityTitle` below; its properties are `PropertyList` when edited in place, `Facts` when none is. [lint:primitive-bypass] [type:PageBarProps]
- A nav or link `search` keeps the keys its route owns; never a literal search object or a store's link search. [lint:router-search]

## Controls

- A control lives in one home: a `controls` slot of `PageBar`, `Section`, a card or a table, filled by `filterSlot`. [lint:control-home] [type:ControlsSlot]
- A filter or tab binds a `ControlHandle`, never `value` or `onChange`; filters sit in one `FilterSet`, page and section switches are `ViewTabs`. [type:ControlHandle] [type:FilterSetProps] [type:ViewTabsProps]
- `PageBar` `actions` holds at most five entries and at most one `primary`. [type:PageBarProps]
- `PageAside` takes a required `title`; a detail host shows its entry in a sheet or in the aside. [type:PageAsideProps] [type:DetailHost]

## Frames and cards

- A frame takes its phase from the query: pass `QueryStateLike` or `Phase`, never `data ?? []`; a figure derived from rows is computed in the ready phase only. [type:QueryStateLike] [type:Phase]
- Page code keys on its container, never a viewport class, and scrolls through the scroll primitive, never a raw overflow box. [lint:viewport-keyed] [lint:raw-scroll]
- `InnerNav` state is a push field: a `ControlHandle` with `history: 'push'`; a replace handle does not compile, and a `menu` needs two entries. [type:PushField] [type:InnerNavProps]
- A card is a link, a button or inert, never both; its footer holds at most two facts, each data, never a node. [type:CardTarget] [type:FootFacts]

## Tables

- A table is `DataTable` over `useDataTable`; never a raw table or the table library's hook. [lint:primitive-bypass] [lint:import-boundary]
- Columns come from the kind constructors; a raw column or a free `cell` is not a column. [type:KindColumn]
- A client table has no `rowCount`; a server table has a `rowCount` or a `cursor`, never both. [type:Mode]
- A row action is typed data: `id`, `label`, `onClick(row)`, optional `disabled(row)`. [type:RowAction]
- A virtual table passes `virtual` with a fixed scrollport height. [type:DataTableProps]

## Forms

- A field binds either a TanStack field or a store control, never both. [type:FormFieldProps]
- Form actions are typed data: at most five, one `primary` as the submit. [type:FormAction]
- A save error reaches the form through `toSubmitErrors(save)`. [type:ToSubmitErrors]

## Content and AI

- Render model or agent output with `contentTrust="untrusted"`: no sanitize override, no rehype plugins. [lint:untrusted-markdown] [type:UntrustedMarkdownProps]
- Switch over `MessagePart` exhaustively with `satisfies never`; declare a model block with `defineBlock`. [type:MessagePart] [type:Block]

not guarded:

- A section, card or table title is its frame's `title`; never an in-body heading. A page of rows leads with a card of figure, context line and footer; every headline names its base as a signed delta.
- Date range navigation sits in the `controls` slot, not in `actions`; count and reset active filters with the store.
- `CardGrid` takes a `min` tier (`narrow`, `regular`, `wide`), never a column count or a width.
- One `PageBar` per `Page`, one lit attention badge: the dev build asserts both. A shortcut that runs an action is a `defineCommands` entry, one chord per command in an area (`defineCommands` throws on a second; `listed: false` keeps it out of the palette); a key that is no command is `useHotkey` from `@tanstack/react-hotkeys` (optional peer, pinned exact, `target` a ref); never a hand-written `window` `keydown`.
- App CSS never targets `data-slot` or a shell class; stylelint `selector-disallowed-list` holds it where configured.
- Build the router from `routerDefaults` and the template's `_app` layout, never a router factory of your own.
