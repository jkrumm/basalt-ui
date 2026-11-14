# Controls

Every control has a home; the home draws it and the handle holds its state. Props are in the generated docs: [ControlHome](docs/control-home.md), [FilterSet](docs/filter-set.md), [ViewTabs](docs/view-tabs.md), [filterSlot](docs/filter-slot.md), [ControlView](docs/control-view.md).

## Homes

- A page filter lives in the page bar as a [FilterSet](docs/filter-set.md) of `spec(...)`s: pills in one row, the overflow folds into `+N`, and below the `@regular` container one filters button with a count opens a sheet. Region `filter-set` in `apps/playground/src/routes/overview.tsx`.
- A view switch of the same data is [ViewTabs](docs/view-tabs.md) bound to an enum handle, with `history: 'push'` when Back should walk the tabs. Region `view-tabs` in the same file. A list of sections beside the page is an inner nav.
- A control in a surface that is not a slot of a composite (an aside, a sheet, a toolbar) goes inside [ControlHome](docs/control-home.md) with a `home` name; the home sets the look, never a prop. The docked aside is region `page-aside` in `apps/playground/src/routes/shell.tsx`.
- A card holds at most two controls through [filterSlot](docs/filter-slot.md). A global control lives in the shell's global controls or the page bar; a global handle in a card slot is a type error.

## Handles and cues

- A control takes a `handle` and nothing else: `value`, `onChange` and `size` are type errors. The kind of the handle picks the renderer, and the closed `as` hint on `spec()` picks among a few.
- A card that overrides a global shows [ControlView](docs/control-view.md)'s neutral "Local" cue and a way back to the global. Declare the binding on the widget field; the card never renders the global's control.
- Saved views are a pointer to a snapshot of the page's keys, kept in a store; the URL stays the one owner of state.

## Waivers

- A raw selection control outside a home is a waiver with a reason, on the line: `oxlint-disable-next-line basalt/control-home -- <why>`. A waiver is counted per app; a handle-bound composite is clean without one.
- A custom control that has no handle (a `useState` closure) goes through `filterSlot.custom`, which is where its waiver is read.

not guarded:

- Never rebuild a filter as a raw Select or Segmented with local state; one filter in three UIs collapses to one spec.
- Never pass a home a control a second look through `className`; change the home.
