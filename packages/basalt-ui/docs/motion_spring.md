---
name: MOTION_SPRING
use when: 'a `motion` element moves or resizes in a way the user caused (`layout`, a drag release, a dealt card).'
never when: 'data arrives or a list fills: a tween on the scale reads calmer; and never `bouncy` for anything the user did not cause.'
subpath: basalt-ui/tokens
peers: []
slots: []
---

# MOTION_SPRING

The two springs. `standard` settles with no overshoot; `bouncy` overshoots by about 3 % (a card that
lands, a chip that pops). As CSS they are `--basalt-spring` and `--basalt-spring-bouncy`.

## Signature

```ts
MOTION_SPRING: { standard: { type, visualDuration, bounce }, bouncy: { type, visualDuration, bounce } }
```

## Example

```tsx
<motion.div layout transition={MOTION_SPRING.standard} />
```
