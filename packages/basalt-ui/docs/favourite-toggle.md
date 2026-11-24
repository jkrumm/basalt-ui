---
name: FavoriteToggle
use when: 'a record''s page or panel should offer to pin it to the rail'
never when: 'the app has no `AppShell`, or the pin is a per-user setting that belongs on a settings page'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: []
---

# FavoriteToggle

The star button that adds a record to the rail's Favorites section and takes it off again. It is
a toggle (`aria-pressed`) named by the action it would do, and draws nothing outside an `AppShell`
or on a phone, where the rail that lists favorites is not drawn.
A `PageBar`, a `Peek` and a `Dock` draw it from their `favorite` prop; use the component itself
for a star of your own. `PageAside` takes no `favorite` prop.

## Signature

```ts
FavoriteToggle({ className, ...input }: FavoriteToggleProps): ReactElement | null
  id: string
  label: string
  target: string | NavTarget
  icon?: IconComponent  // Drawn on the rail row for this session; a stored favorite keeps no glyph
  className?: string  // Layout only
```

`FavoriteToggleProps` import from `basalt-ui/page`: `import type { FavoriteToggleProps } from 'basalt-ui/page'`.

`IconComponent`, `NavTarget` import from `basalt-ui`: `import type { IconComponent, NavTarget } from 'basalt-ui'`.

## Example

```tsx
<FavoriteToggle id="issue-12" label="Issue 12" icon={Bug} target={navTarget(linkOptions({ to: '/issues/12' }))} />
```
