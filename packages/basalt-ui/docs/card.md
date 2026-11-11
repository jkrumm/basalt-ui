---
name: Card
use when: ''
never when: ''
subpath: basalt-ui/ui/card
peers: ['@base-ui/react']
slots: [card, card-band, card-info, icon-tile, inset, card-phase]
---

# Card

The base card: a surface with a radius and a ring. Works with no provider; polymorphism only
through `render`.

## `cardVariants`

Part `card`.

- `flush`: `true`, `false` (default `false`)

## Slots

- `card`
- `card-band`
- `card-info`
- `icon-tile`
- `inset`
- `card-phase`
