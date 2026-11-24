---
name: MOTION_DURATION
use when: 'a `motion` transition or a script needs a duration; the guide is `docs/motion.md`.'
never when: 'CSS or Tailwind can time it: use `duration-fast` or `var(--basalt-dur-fast)`, which collapse under reduced motion on their own.'
subpath: basalt-ui/tokens
peers: []
slots: []
---

# MOTION_DURATION

The duration scale in seconds: `fast` for hover, press and small overlays, `base` for enter, exit
and reveal, `slow` for large surfaces (sheet, dock, peek). Same values as `--basalt-dur-*`.

## Signature

```ts
MOTION_DURATION: { fast, base, slow }
```

## Example

```tsx
<motion.div animate={{ opacity: 1 }} transition={{ duration: MOTION_DURATION.base, ease: MOTION_EASE_ENTER }} />
```
