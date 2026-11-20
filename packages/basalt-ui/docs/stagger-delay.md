---
name: staggerDelay
use when: 'a hand-built `motion` list enter staggers its items.'
never when: 'the item uses `useMotionPreset(''item'', { index })`, which applies it; or in CSS, where `stagger` with `--i` does.'
subpath: basalt-ui/tokens
peers: []
slots: []
---

# staggerDelay

The enter delay of the item at `index`, in seconds. It grows by {@link MOTION_STAGGER} per item and
stops at `MOTION_DURATION.slow`, so a long list does not keep its tail waiting.

## Signature

```ts
staggerDelay(index: number): number
```

## Example

```tsx
items.map((item, i) => <motion.li key={item.id} transition={{ delay: staggerDelay(i) }} />)
```
