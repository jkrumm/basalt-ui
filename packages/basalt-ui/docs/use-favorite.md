---
name: useFavorite
use when: 'a record needs its own favorite control (a menu row, a keyboard shortcut) rather than the star'
never when: 'the star `FavoriteToggle`, a `PageBar` `favorite` or a panel''s `favorite` already draws what you need'
subpath: basalt-ui/page
peers: ['@base-ui/react', '@tanstack/react-router']
slots: []
---

# useFavorite

Whether a record is a favorite and a function that flips it, or `null` outside an `AppShell`.
The glyph is remembered while the record is a favorite, so the rail row wears it.

## Signature

```ts
useFavorite(input: FavoriteInput): { on: boolean; toggle: () => void; } | null
  id: string
  label: string
  target: string | NavTarget
  icon?: IconComponent  // Drawn on the rail row for this session; a stored favorite keeps no glyph
```

`FavoriteInput` import from `basalt-ui/page`: `import type { FavoriteInput } from 'basalt-ui/page'`.

`IconComponent`, `NavTarget` import from `basalt-ui`: `import type { IconComponent, NavTarget } from 'basalt-ui'`.

## Example

```tsx
const favorite = useFavorite({ id: 'issue-12', label: 'Issue 12', target: navTarget(linkOptions({ to: '/issues/12' })) })
```
