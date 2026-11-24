---
name: MOTION_EASE_ENTER
use when: 'a hand-built `motion` enter that no preset covers.'
never when: 'an overlay, list item or card enters: `useMotionPreset` already uses it.'
subpath: basalt-ui/tokens
peers: []
slots: []
---

# MOTION_EASE_ENTER

Decelerate: an element arriving (`--basalt-ease-enter`, Tailwind `ease-enter`).

## Signature

```ts
MOTION_EASE_ENTER: MotionBezier
```

`MotionBezier` import from `basalt-ui/tokens`: `import type { MotionBezier } from 'basalt-ui/tokens'`.
