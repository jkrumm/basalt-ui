---
name: MOTION_EASE_EXIT
use when: 'a hand-built `motion` exit that no preset covers.'
never when: 'an overlay, list item or card leaves: `useMotionPreset` already uses it.'
subpath: basalt-ui/tokens
peers: []
slots: []
---

# MOTION_EASE_EXIT

Accelerate: an element leaving (`--basalt-ease-exit`, Tailwind `ease-exit`).

## Signature

```ts
MOTION_EASE_EXIT: MotionBezier
```

`MotionBezier` import from `basalt-ui/tokens`: `import type { MotionBezier } from 'basalt-ui/tokens'`.
