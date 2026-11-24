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
field makes one it refuses. A multi or range handle takes `options` and `facets` by member (a
multi's `'a'`, a range's `'7d'`), the way its handle lists them.

## Signature

```ts
spec<T>(handle: WidgetHandle<T>, label: string, options?: SpecOptions<T>): FilterSpec<T, "widget">
  key: string
  kind: "string" | "number" | "boolean" | "enum" | "multi" | "range"
  options?: readonly { value: T; label: string; }[]
  use: () => [T, (v: T) => void]
  useSource: () => { source: "own" | "inherited" | "override"; inherited: T | undefined; }
  clear: (options?: { replace?: boolean; }) => void
  isDefault: boolean
  scope: "widget"
```

`FilterSpec` import from `basalt-ui/controls`: `import type { FilterSpec } from 'basalt-ui/controls'`.

## Example

```tsx
spec(overview.widget.latency.range, 'Range', { as: 'segmented' }) // for a card slot
spec(globals.field.range, 'Range') // for a page bar or the shell
spec(globals.field.tags, 'Tags', { options: [{ value: 'api', label: 'API' }] }) // a multi
```
