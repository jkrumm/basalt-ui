---
name: FavouriteToggle
use when: 'a record''s page or panel should offer to pin it to the rail'
never when: 'the app has no `AppShell`, or the pin is a per-user setting that belongs on a settings page'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: []
---

# FavouriteToggle

The star button that adds a record to the rail's Favourites section and takes it off again. It is
a toggle (`aria-pressed`) named by the action it would do, and draws nothing outside an `AppShell`
or on a phone, where the rail that lists favourites is not drawn.
A `PageBar`, a `Peek` and a `Dock` draw it from their `favourite` prop; use the component itself
for a star of your own. `PageAside` takes no `favourite` prop.

## Signature

```ts
FavouriteToggle({ className, ...input }: FavouriteToggleProps): ReactElement | null
  id: string
  label: string
  target: string | NavTarget
  icon?: IconComponent  // Drawn on the rail row for this session; a stored favourite keeps no glyph
  className?: string  // Layout only
```

`FavouriteToggleProps` import from `basalt-ui/page`: `import type { FavouriteToggleProps } from 'basalt-ui/page'`.

`IconComponent`, `NavTarget` import from `basalt-ui`: `import type { IconComponent, NavTarget } from 'basalt-ui'`.

## Example

```tsx
<FavouriteToggle id="issue-12" label="Issue 12" icon={Bug} target={navTarget(linkOptions({ to: '/issues/12' }))} />
```
