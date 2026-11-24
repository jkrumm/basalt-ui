# Controls

Every control has a home; the home draws it and the handle holds its state. Props are in the generated docs: [ControlHome](node_modules/basalt-ui/docs/control-home.md), [FilterSet](node_modules/basalt-ui/docs/filter-set.md), [ViewTabs](node_modules/basalt-ui/docs/view-tabs.md), [filterSlot](node_modules/basalt-ui/docs/filter-slot.md), [ControlView](node_modules/basalt-ui/docs/control-view.md).

## Homes

- A page filter lives in the page bar as a [FilterSet](node_modules/basalt-ui/docs/filter-set.md) of `spec(...)`s: one or two are pills in the row, the overflow folds into `+N`, and below the `@regular` container one filters button with a count opens a sheet. Three or more fold into one trigger, labelled Filter, with the active count; pass `filterSlot(specs, { match: { shown, total } })` so its popover says how many rows they keep.- A list page's [PageBar](node_modules/basalt-ui/docs/page-bar.md) is its view row, one line: `tabs` with `badges` (a count per named view, `attention` for the one that needs the reader) on the left; `search`, the filters, `layout`, `settings` and the one primary on the right, in the order the bar fixes. A fill page puts `StatGroup variant="flush"` under it, every cell with a sub-line. `basalt-ui add list-page` writes this row.
- A view switch of the same data is [ViewTabs](node_modules/basalt-ui/docs/view-tabs.md) bound to an enum handle, with `history: 'push'` when Back should walk the tabs. A list of sections beside the page is an inner nav.
- A control in a surface that is not a slot of a composite (an aside, a sheet, a toolbar) goes inside [ControlHome](node_modules/basalt-ui/docs/control-home.md) with a `home` name; the home sets the look, never a prop.- A card holds at most two controls through [filterSlot](node_modules/basalt-ui/docs/filter-slot.md). A global control lives in the shell's global controls or the page bar; a global handle in a card slot is a type error.

## Handles and cues

- A control takes a `handle` and nothing else: `value`, `onChange` and `size` are type errors. The kind of the handle picks the renderer, and the closed `as` hint on `spec()` picks among a few.
- A card that overrides a global shows [ControlView](node_modules/basalt-ui/docs/control-view.md)'s neutral "Local" cue and a way back to the global. Declare the binding on the widget field; the card never renders the global's control.
- Saved views are a pointer to a snapshot of the page's keys, kept in a store; the URL stays the one owner of state.

## Waivers

- A raw selection control outside a home is a waiver with a reason, on the line: `oxlint-disable-next-line basalt/control-home -- <why>`. A waiver is counted per app; a handle-bound composite is clean without one.
- A custom control that has no handle (a `useState` closure) goes through `filterSlot.custom`, which is where its waiver is read.

not guarded:

- Never rebuild a filter as a raw Select or Segmented with local state; one filter in three UIs collapses to one spec.
- Never pass a home a control a second look through `className`; change the home.
