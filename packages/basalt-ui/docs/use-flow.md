---
name: useFlow
use when: 'a page draws a `FlowCanvas`, alone or with a `FlowChecklist` in its `PageAside`'
never when: 'the page draws a `ChainView`, which keeps its own viewport'
subpath: basalt-ui/cards
peers: ['@base-ui/react']
slots: []
---

# useFlow

The handle of the flow `id`: the pointer tool, the folds the reader left, and the reveal a
checklist calls. `id` names the persisted folds, so it is stable per flow (a workflow's id).

## Signature

```ts
useFlow({ id }: { id: string; }): FlowHandle
  id: string
```

## Example

```tsx
const flow = useFlow({ id: `workflow:${workflow.id}` })
<FlowCanvas flow={flow} label="Reorder" columns={columns} edges={edges} issues={issues} />
<PageAside title="Workflow"><FlowChecklist flow={flow} issues={issues} /></PageAside>
```
