---
name: FavouriteToggle
use when: 'a record''s page or panel should offer to pin it to the rail'
never when: 'the app has no `AppShell`, or the pin is a per-user setting that belongs on a settings page'
subpath: basalt-ui/page
peers: ['@base-ui/react', '@tanstack/react-router']
slots: []
---

# FavouriteToggle

The star button that adds a record to the rail's Favourites section and takes it off again. It is
a toggle (`aria-pressed`) named by the action it would do, and draws nothing outside an `AppShell`
or on a phone, where the rail that lists favourites is not drawn.
Drop it in a `PageBar`'s `actions`; a `Peek`, `Dock` or `PageAside` header draws it from its
`favourite` prop.

## Signature

```ts
FavouriteToggle({ className, ...input }: FavouriteToggleProps): ReactElement | null
  id: string
  label: string
  target: string | NavTarget
  icon?: IconComponent  // Drawn on the rail row for this session; a stored favourite keeps no glyph
  className?: string  // Layout only
```

## Example

```tsx
<FavouriteToggle id="issue-12" label="Issue 12" icon={Bug} target={navTarget(linkOptions({ to: '/issues/12' }))} />
```
