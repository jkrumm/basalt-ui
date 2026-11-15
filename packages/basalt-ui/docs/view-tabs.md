---
name: ViewTabs
use when: 'a page or section has a few views of the same data and the visitor must be able to link to one'
never when: 'the choice filters rows (use a `spec` in a `FilterSet`) or is a list of sections beside the page (use `InnerNav`)'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: []
---

# ViewTabs

The view switch of a page or a section, bound to a `handle`. The URL (or any lane) owns the
value: a link with `?tab=history` renders History on the first server pass, and Back walks the
tabs when the field is `history: 'push'`. One mount per form, swapped in CSS at `md`.

## Signature

```ts
ViewTabs<T extends string>(props: ViewTabsProps<T>): ReactNode
  // either handle or field
  handle?: ControlHandle<T>
  options?: readonly ViewTabsOption<T>[] | readonly LegacyViewTabsOptio…  // Defaults to `handle.options` (every declared value, labelled by `.labels()`)
  label?: string  // The switch's accessible name; both forms carry it; default 'View'
  disabled?: boolean
  className?: string  // Layout only (`w-full`, `ml-auto`)
  field?: FieldHandle<EnumField<T>>
  value?: never
  onChange?: never
  size?: never
  style?: CSSProperties  [with field]  // Merged onto the root element's own inline style, if it has one
```

## Example

```tsx
<ViewTabs
  handle={overview.field.tab}
  label="Overview view"
  options={[
    { value: 'all', label: 'All' },
    { value: 'errors', label: 'Errors' },
    { value: 'train', label: 'Train', only: 'sm-down' },
  ]}
/>
```
