---
name: ControlHome
use when: 'you place controls in a surface that is not a slot of a composite (an aside, a sheet, a toolbar)'
never when: 'you want a different look for one control: the home decides the look, never a prop'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: []
---

# ControlHome

Hosts controls and gives them the presentation of its `home`. A `FilterSet` or a `filterSlot`
inside reads it; with no home around, a control is a `pill`. A home with nothing to draw renders
nothing, so an empty slot leaves no gap.

## Signature

```ts
ControlHome({ home, children }: ControlHomeProps): ReactElement | null
  home: HomeName
  children?: ReactNode
```
