---
name: ControlView
use when: 'a home draws one `FilterSpec` and must show when a card overrides its global'
never when: 'you are laying out a page: put a `spec` in a `filterSlot` and let the home render it'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: [control-view, override-badge, override-note, override-reset]
---

# ControlView

One bound control, drawn from its `spec`: the label (visible in every presentation, so a select at
a generic default such as `All` still says what it filters), the input of the handle's kind and, when a
widget overrides its global, the cue and the reset. The cue is a neutral `Local` chip (text, never
colour alone) titled `Overrides global: <value>`, with `Use global` on a row and `Reset <label> to
global` elsewhere. The presentation comes from the home; there is no `variant` prop.

## Signature

```ts
ControlView({ spec, className }: ControlViewProps): ReactElement
  spec: FilterSpec<any>
  className?: string  // Layout only (`w-full`, `ml-auto`)
```

`FilterSpec` import from `basalt-ui/controls`: `import type { FilterSpec } from 'basalt-ui/controls'`.

## Example

```tsx
<ControlView spec={spec(overview.widget.latency.range, 'Range')} />
```
