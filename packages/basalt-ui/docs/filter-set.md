---
name: FilterSet
use when: 'a page has two or more filters for the same data and they must fit a phone without scrolling or wrapping'
never when: 'the control is a single field of a form (use `FormField`) or one control that overrides a global in a card (use `filterSlot`)'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: []
---

# FilterSet

Draws a list of `spec(...)`s as pills in one row: each pill names its filter beside its value
(`Region: All`), opens as a row form, and the tail that does not fit folds into `+N`. Below the
`@regular` container the row becomes one `Filters (n)` button that opens a sheet. `n` counts the filters off their default (a multi that
holds every option counts as none). The row ends with `Reset all` while any spec differs from its
default, and the sheet has its own; either unsets them all. In the page bar three specs or more
are one `Filter` trigger with the active count instead, keeping the view row one line: its
popover groups an enum as chips and a multi as checkboxes, and its footer says `Showing N of M`
from `match` beside `Reset all`. Inside a `ControlHome` the home's
presentation applies: a `row` home draws the row forms stacked.

## Signature

```ts
FilterSet(props: FilterSetProps): ReactElement | ReactNode
  specs: readonly FilterSpec<any, FilterScope>[]
  match?: { shown: number; total: number; }  // The rows the filters keep, of all: the folded set's "Showing N of M"
```

`FilterSpec` import from `basalt-ui/controls`: `import type { FilterSpec } from 'basalt-ui/controls'`.

## Example

```tsx
<FilterSet
  specs={[
    spec(overview.field.range, 'Range'),
    spec(overview.field.region, 'Region', { options: regions }),
  ]}
/>
```
