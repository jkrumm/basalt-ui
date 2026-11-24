---
name: PropertyList
use when: 'a record''s own properties are listed as label and value and the reader changes them where they are read: a supplier''s contact, lead time and terms'
never when: 'nothing on the list is editable (use Facts) or the change is a multi-field form with one Save (use a form)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [property-list]
---

# PropertyList

The properties of one record as label and value, each one editable in place: the value is a
button that becomes its editor (a text input, a number with its unit, a select, a day, a person)
and writes on Enter, on blur or on a pick, drops on Escape, and shows a failed save under the
field. The rows look like `Facts`: the same grid, the same two columns from the `regular`
container tier, so a read-only row (no `kind`) sits among editable ones. A validation error
shows after Enter or blur, never per keystroke.

## Signature

```ts
PropertyList({ rows }: PropertyListProps): ReactElement
  rows: readonly PropertyRow[]  // One row per entry, in order; ids are unique within one list
```

## Example

```tsx
<PropertyList
  rows={[
    { id: 'contact', kind: 'text', label: 'Contact', value: supplier.contact, autoComplete: 'off', onCommit: (name) => save({ contact: name }) },
    { id: 'lead', kind: 'number', label: 'Lead time', value: supplier.leadDays, unit: 'days', min: 0, max: 365, onCommit: (days) => save({ leadDays: days }) },
    { id: 'since', label: 'Supplier since', value: f.date(supplier.since) },
  ]}
/>
```
