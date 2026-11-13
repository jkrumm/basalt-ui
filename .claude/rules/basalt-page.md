---
source: basalt-ui
description: Shell, pages, controls, cards, tables, forms and content — compose the shipped frame.
paths:
  - '**/src/**'
---

# Basalt Page

A page is composed from the shipped frame; each bullet names what holds it.

## Shell and nav

- Declare the whole navigation once as `NavConfig` data and pass it to `AppShell`; never build the regions. [type:NavConfig]
- Nav badge keys are typed from the declared nav; a typo is a compile error. [type:NavBadges]
- Shell extensions are typed data (`GlobalAction`, `SidebarBlock`), never a node. [type:GlobalAction] [type:SidebarBlock]
- A page is named once: by its nav label, or by `PageBar` `title` where there is no shell; never a raw heading. [lint:primitive-bypass] [type:PageBarProps]

## Controls

- A control lives in one home: a `controls` slot of `PageBar`, `Section`, a card or a table, filled by `filterSlot`. [lint:control-home] [type:ControlsSlot]
- A filter or tab binds a `ControlHandle` and takes no `value` or `onChange`. [type:ControlHandle]
- Filters sit in one `FilterSet`; page and section switches are `ViewTabs`. [type:FilterSetProps] [type:ViewTabsProps]
- `PageBar` `actions` holds at most five entries and at most one `primary`. [type:PageBarProps]
- `PageAside` takes a required `title`; a detail host shows its entry in a sheet or in the aside. [type:PageAsideProps] [type:DetailHost]
- A split page passes `list` and `detail` as render functions. [type:SplitPageProps]

## Frames and cards

- A frame takes its phase from the query: pass `QueryStateLike` or `Phase`, never `data ?? []`. [type:QueryStateLike] [type:Phase]
- A card is a link, a button or inert, never both. [type:CardTarget]
- A card footer holds at most two facts; a fact value is data, never a node. [type:FootFacts]

## Tables

- A table is `DataTable` over `useDataTable`; never a raw table or the table library's hook. [lint:primitive-bypass] [lint:import-boundary]
- Columns come from the kind constructors; a raw column or a free `cell` is not a column. [type:KindColumn]
- A client table has no `rowCount`; a server table has a `rowCount` or a `cursor`, never both. [type:Mode]
- A row action is typed data: `label`, `onClick(row)`, optional `disabled(row)`. [type:RowAction]
- A virtual table passes `virtual` with a fixed scrollport height. [type:DataTableProps]

## Forms

- A field binds either a TanStack field or a store control, never both. [type:FormFieldProps]
- Form actions are typed data: at most five, one `primary` as the submit. [type:FormAction]
- A save error reaches the form through `toSubmitErrors(save)`. [type:ToSubmitErrors]

## Content and AI

- Render model or agent output as untrusted markdown: no sanitize override, no rehype plugins. [lint:untrusted-markdown] [type:UntrustedMarkdownProps]
- Switch over `MessagePart` exhaustively and end with `satisfies never`. [type:MessagePart]
- A model block is declared with `defineBlock`; the catalog wraps it in a boundary. [type:Block]

not guarded:

- A section, card or table title is its frame's `title`; never an in-body heading.
- Date range navigation sits in the `controls` slot, not in `actions`.
- Count active filters and reset them with the store, never a hand count.
