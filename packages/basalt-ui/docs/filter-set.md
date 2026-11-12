---
name: FilterSet
use when: 'a page has two or more filters for the same data and they must fit a phone without scrolling or wrapping'
never when: 'the control is a single field of a form (use `FormField`) or one control that overrides a global in a card (use `filterSlot`)'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: []
---

# FilterSet

Draws a list of `spec(...)`s as pills in one row: each pill prints its value, opens as a row form,
and the tail that does not fit folds into `+N`. Below the `@regular` container the row becomes one
`Filters (n)` button that opens a sheet. `n` counts the filters off their default (a multi that
holds every option counts as none), and the sheet's `Reset all` unsets them. Inside a
`ControlHome` the home's presentation applies: a `row` home draws the row forms stacked.

## Signature

```ts
FilterSet(props: FilterSetProps): ReactElement | ReactNode
  one of: specs | children
  specs: readonly FilterSpec<any, FilterScope>[]
  children: ReactNode
  className?: string  [with children]
  style?: CSSProperties  [with children]
  classNames?: Partial<Record<"root" | "sheet", string>>  [with children]
  inline?: number  [with children]
```
