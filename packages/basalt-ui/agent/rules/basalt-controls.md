---
source: basalt-ui
description: The control tier from basalt-ui/controls — FilterSet, the FieldHandle-bound filters, ViewTabs, and the date picker behind basalt-ui/controls-dates. Where a control may live, how it binds to a store, and which props it does not have.
paths:
  - 'src/**'
  - 'apps/**/src/**'
---

# Basalt Controls — filters, tabs, and their homes

basalt-ui ships `./controls` — every interactive filter and tab, each bound to a store field rather
than to `useState`. Ground truth:
<https://github.com/jkrumm/basalt-ui/blob/master/docs/CONTROLS-SPEC.md>.

## The laws that decide a review

| #   | Law                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | A control lives in exactly one home — the page bar, a section/widget header, or a form row — entered only through a slot prop.                |
| C2  | A basalt filter or tab has no `value`/`onChange`. It takes `field`, and owns both the URL write and the localStorage mirror.                  |
| C3  | Tab and filter state never lives in `useState`. It derives from a store field on the URL lane or the local lane.                              |
| C5  | The home sets the size tier (`ctl` = 30px). An element inside a home slot carries no `size`, `w`, `fullWidth`, `visibleFrom` or `hiddenFrom`. |
| C7  | A home never scrolls horizontally and never wraps. Overflow folds into a menu — computed by basalt, not by the page.                          |
| C9  | A responsive swap belongs to the control. Rendering the same control twice under `visibleFrom`/`hiddenFrom` is an error.                      |
| C15 | Every touch target inside a home is at least 36px below `sm`; sheet rows are 44px.                                                            |

## The controls

Each takes `field` — a `FieldHandle` from `createSearchStore` (URL lane) or `createLocalStore`
(local lane). None takes `value`, `onChange` or `size`: those props do not exist, so a wrong call
site is a tsc error rather than a review comment.

| Export              | Props beyond `field`                  | Reads                                          |
| ------------------- | ------------------------------------- | ---------------------------------------------- |
| `FilterSet`         | `inline?` (default 1)                 | —                                              |
| `RangeFilter`       | `icon?`, `customPicker?`, `label?`    | preset label, or `Mar 1 – Mar 14` when custom  |
| `CompareFilter`     | `label?` (default `Compare`), `icon?` | the selected comparison basis                  |
| `SelectFilter`      | `label`, `icon?`, `clearable?`        | the filter's name at rest, the option once set |
| `MultiSelectFilter` | `label`, `icon?`, `noun?`             | `All channels` / `3 channels`                  |
| `SearchFilter`      | `placeholder?`, `label?`              | a debounced text box, not a pill               |
| `ToggleFilter`      | `label`, `icon?`                      | a pill that flips on press                     |
| `ViewTabs`          | `options?` (each with `only?`)        | a segmented track, a `Select` on small screens |

`ActionGroup`, `OverflowMenu` and `SyncButton` live on the same subpath and take typed action data,
never children.

## Binding one to a store

```tsx
import { createSearchStore, field } from 'basalt-ui/router-tanstack'
import { FilterSet, RangeFilter, MultiSelectFilter, ViewTabs } from 'basalt-ui/controls'
import { DateRangePicker } from 'basalt-ui/controls-dates'

export const analytics = createSearchStore({
  key: 'analytics',
  fields: {
    range: field.range({ presets: ['7d', '30d', '90d'], fallback: '30d', custom: true }),
    channels: field.multi(CHANNELS, []),
    tab: field.enum(['overview', 'detail'], 'overview', { persist: false }),
  },
}).labels({
  range: { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' },
})

// route: validateSearch: analytics.validateSearch
<FilterSet>
  <RangeFilter field={analytics.field.range} customPicker={DateRangePicker} />
  <MultiSelectFilter field={analytics.field.channels} label="All channels" />
</FilterSet>
<ViewTabs field={analytics.field.tab} />
```

Four rules the example encodes:

- Option LABELS come from `store.labels()`, once, at definition — never from a per-control prop and
  never from a lookup table in the page.
- A field's lanes are declared once (`{ url, persist, history }`) and resolve URL over localStorage
  over fallback, uniformly for every field kind.
- A page component takes the param as a PROP where it needs the value, or reads
  `store.useValues()`. Never `useSearch({ from: '/some/route' })` — a sibling route fails that
  `from`.
- A nav link carrying a store field passes `store.linkSearch` BY REFERENCE. A `search:` object
  literal inside a nav definition pins the fallback on every click.

## FilterSet owns the responsive behaviour

Do not build the mobile story at the call site. `FilterSet` measures its own children and, above
`sm`, folds the tail into a `+N` pill once the row would overflow — it never scrolls and never
wraps. Below `sm` the first `inline` children stay pills and one `Filters (n)` pill opens a bottom
sheet in which EVERY child renders its full-width 44px form, applies immediately, and answers one
`Reset all`.

`n` and `Reset all` are DERIVED: each filter reports whether its field is non-default. So adding a
filter to the set is one JSX line — there is no count to maintain, no reset handler to extend, and
no list of fields to keep in sync.

## The date picker is injected, not imported

`basalt-ui/controls-dates` exports `DateRangePicker` and needs `@mantine/dates` (an optional peer).
Pass it through `RangeFilter`'s `customPicker` prop:

```tsx
<RangeFilter field={analytics.field.range} customPicker={DateRangePicker} />
```

`basalt-ui/controls` itself resolves and renders with no `@mantine/dates` installed, which is what
lets a consumer that has no date picker use every other control. Never import `@mantine/dates` from
a shared module, and never reach for `DateInput`/`DatePickerInput` directly inside a home slot — a
raw Mantine selection control in a home is the thing the controls exist to replace.

## Anti-patterns

| Instead of                                             | Write                                                |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `useState` + a `SegmentedControl` in the page body     | a store field + `ViewTabs` in the home's `tabs` slot |
| a raw `Select`/`MultiSelect`/`Chip.Group` as a filter  | `SelectFilter` / `MultiSelectFilter`                 |
| `<X visibleFrom="sm"/>` next to `<X hiddenFrom="sm"/>` | one control — the swap is already inside it          |
| `size="xs"` on a button in a home slot                 | nothing; the home sets the tier                      |
| a hand-written `presetToParams`                        | `field.toWindow(value)`                              |
| a hand-counted `Filters (3)` badge                     | nothing; `FilterSet` derives it                      |
| `overflowX: 'auto'` on a filter row                    | nothing; the fold is basalt's                        |
