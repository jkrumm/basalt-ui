---
name: motionPreset
use when: 'outside a component (a test, a list built in a loader), or where you read reduced motion yourself.'
never when: 'inside a component: `useMotionPreset` reads reduced motion for you.'
subpath: basalt-ui/motion
peers: [motion]
slots: []
---

# motionPreset

A preset's props. `overlay` fades and scales in on the fast step; `item` fades and rises 4 px on the
base step, staggered by `index`; `card` fades, rises 8 px and scales on the standard spring. Every
exit fades on the fast step. With `reduced` the element shows its end state at once and leaves at once.

## Signature

```ts
motionPreset(name: MotionPresetName, options?: MotionPresetOptions): MotionPresetProps
```

`MotionPresetName`, `MotionPresetOptions`, `MotionPresetProps` import from `basalt-ui/motion`: `import type { MotionPresetName, MotionPresetOptions, MotionPresetProps } from 'basalt-ui/motion'`.

## Example

```tsx
<motion.li {...motionPreset('item', { index: i, reduced: prefersReduced })} />
```
