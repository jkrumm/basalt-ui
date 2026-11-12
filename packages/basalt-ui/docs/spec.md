---
name: spec
use when: 'you bind a global, page or widget field to a filter slot'
never when: 'you need a control the kinds do not cover (use `filterSlot.custom`)'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: []
---

# spec

The data a control is drawn from: a handle, its label and how to offer it (`options`, `facets`,
`clearable`, `placeholder`, `as`). A widget handle makes a spec a card slot accepts; a global or page
field makes one it refuses.

## Signature

```ts
spec<T>(handle: WidgetHandle<T>, label: string, options?: SpecOptions<T>): FilterSpec<T, "widget">
  key: string
  kind: "string" | "number" | "boolean" | "range" | "enum" | "multi"
  options?: readonly { value: T; label: string; }[]
  use: () => [T, (v: T) => void]
  useSource: () => { source: "own" | "inherited" | "override"; inherited…
  clear: () => void
  isDefault: boolean
  scope: "widget"
```
