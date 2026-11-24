---
name: MOTION_EASE_STANDARD
use when: 'a `motion` transition changes an element that stays on screen (a width, a colour, a position).'
never when: 'the element arrives or leaves: use `MOTION_EASE_ENTER` or `MOTION_EASE_EXIT`.'
subpath: basalt-ui/tokens
peers: []
slots: []
---

# MOTION_EASE_STANDARD

The standard curve for a change in place (`--basalt-ease`, Tailwind `ease-standard`).

## Signature

```ts
MOTION_EASE_STANDARD: MotionBezier
```

`MotionBezier` import from `basalt-ui/tokens`: `import type { MotionBezier } from 'basalt-ui/tokens'`.
