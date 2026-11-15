---
name: Facts
use when: 'the properties of one record are listed as label and value, such as the body of an inspector in a `PageAside`'
never when: 'the values are numbers to compare at a glance (use `StatGroup`) or the rows are records of their own (use `DataTable`)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: [facts, facts-row]
---

# Facts

A labelled list of facts about one record: a `dl` of `{ label, value }` rows. The columns follow
the list's own width, never the viewport: two label-and-value columns from the `regular`
container tier, one below it, so the same list reads right in a 360 px aside and in a page column.

## Signature

```ts
Facts({ rows }: FactsProps): ReactElement
  rows: readonly FactRow[]  // One row per entry, in order; labels are unique within one list
```

## Example

```tsx
<Facts
  rows={[
    { label: 'Version', value: deploy.version },
    { label: 'Duration', value: `${deploy.durationS} s` },
  ]}
/>
```
