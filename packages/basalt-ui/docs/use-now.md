---
name: useNow
use when: 'a surface shows an age or a countdown that must advance between data updates (the "updated 5 s ago" beside a live indicator).'
never when: 'the value is a deadline you can compute once; or for animation (use CSS, not a timer).'
subpath: basalt-ui
peers: ['@tanstack/react-router-devtools', beautiful-mermaid, rehype-sanitize, remark-gfm, remend, shiki]
slots: []
---

# useNow

The current time in epoch ms, refreshed every `ms`.

## Signature

```ts
useNow(ms: number): number
```
