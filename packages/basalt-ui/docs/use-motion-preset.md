---
name: useMotionPreset
use when: 'a popover or panel you build, a list item or a card enters and leaves; spread it on a `motion` element inside `AnimatePresence`. Guide: `docs/motion.md`.'
never when: 'a basalt part already animates (dialog, sheet, popover, menu, tooltip, toast); a page without React (use `animate-enter-*`).'
subpath: basalt-ui/motion
peers: [motion]
slots: []
---

# useMotionPreset

A preset's `motion` props, collapsed when the user prefers reduced motion or an ancestor
`<MotionConfig reducedMotion="always">` asks for it: the element then shows its end state at once.

## Signature

```ts
useMotionPreset(name: MotionPresetName, options?: { readonly index?: number; }): MotionPresetProps
```

`MotionPresetName`, `MotionPresetProps` import from `basalt-ui/motion`: `import type { MotionPresetName, MotionPresetProps } from 'basalt-ui/motion'`.

## Example

```tsx
const enter = useMotionPreset('item', { index })
return <motion.li {...enter}>{row.name}</motion.li>
```
