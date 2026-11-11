---
name: useSizeClass
use when: 'frame chrome must mount one of two components by viewport width (a docked aside or a sheet)'
never when: 'the layout of page content changes with width (use a container tier, `CardGrid`) or only the look changes (use CSS)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: []
---

# useSizeClass

The viewport class, `'compact' | 'medium' | 'expanded'`, for the one read CSS cannot make: which
of two components to mount (a docked aside or a sheet). The server and the hydration pass read
`'compact'`, so the markup always matches and the real class lands one commit later; a
client-rendered app reads it on its first render. Chrome only: a page lays out by container
(`CardGrid`), never by this.

## Signature

```ts
useSizeClass(): SizeClass
```
