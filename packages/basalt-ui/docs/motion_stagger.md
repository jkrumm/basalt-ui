---
name: MOTION_STAGGER
use when: 'reading the step itself; a delay for an index is `staggerDelay(index)`.'
never when: 'multiplying it by an index: `staggerDelay` also caps the delay at the slow step.'
subpath: basalt-ui/tokens
peers: []
slots: []
---

# MOTION_STAGGER

The delay between two items of a staggered list, in seconds (`--basalt-stagger`, 30 ms).

## Signature

```ts
MOTION_STAGGER: 0.03
```
