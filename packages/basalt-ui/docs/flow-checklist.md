---
name: FlowChecklist
use when: 'a `FlowCanvas` carries issues and its `PageAside` lists what to fix before the flow runs'
never when: 'the list is tasks, not problems on the canvas (use `RowList`)'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: [flow-checklist, flow-checklist-item]
---

# FlowChecklist

The checklist of a flow's issues, for the panel beside a `FlowCanvas`: a line that says how many
are open, then one item per issue with its tone's mark, its label and its hint. An item is a
button: it unfolds the group that holds the issue, brings the row (or the group, or the edge's
target) into the canvas frame and focuses it. With no issue it is one line that says all is set.

## Signature

```ts
FlowChecklist({ flow, issues }: FlowChecklistProps): ReactElement
  flow: FlowHandle  // The handle the canvas draws from: an item reveals its anchor there
  issues: readonly FlowIssue[]  // The same issues the canvas marks
```

`FlowChecklistProps` import from `basalt-ui/cards`: `import type { FlowChecklistProps } from 'basalt-ui/cards'`.

## Example

```tsx
<PageAside title="Workflow" dock="always" width={360}>
  <FlowChecklist flow={flow} issues={issues} />
</PageAside>
```
