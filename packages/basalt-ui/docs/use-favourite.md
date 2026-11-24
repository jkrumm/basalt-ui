---
name: useFavourite
use when: 'a record needs its own favourite control (a menu row, a keyboard shortcut) rather than the star'
never when: 'the star `FavouriteToggle`, a `PageBar` `favourite` or a panel''s `favourite` already draws what you need'
subpath: basalt-ui/page
peers: ['@base-ui/react', '@tanstack/react-router']
slots: []
---

# useFavourite

Whether a record is a favourite and a function that flips it, or `null` outside an `AppShell`.
The glyph is remembered while the record is a favourite, so the rail row wears it.

## Signature

```ts
useFavourite(input: FavouriteInput): { on: boolean; toggle: () => void; } | null
  id: string
  label: string
  target: string | NavTarget
  icon?: IconComponent  // Drawn on the rail row for this session; a stored favourite keeps no glyph
```

`FavouriteInput` import from `basalt-ui/page`: `import type { FavouriteInput } from 'basalt-ui/page'`.

## Example

```tsx
const favourite = useFavourite({ id: 'issue-12', label: 'Issue 12', target: navTarget(linkOptions({ to: '/issues/12' })) })
```
