---
name: AppearanceSwitcher
use when: 'a settings page or a header popover lets the reader pick theme, accent, density or layout'
never when: 'the app offers only light and dark (a three-way switch is enough), or on a content site (`ThemeSwitch`)'
subpath: basalt-ui/controls
peers: ['@base-ui/react']
slots: [appearance-switcher]
---

# AppearanceSwitcher

The reader's appearance in one part: theme, accent color, density and layout, each applied to
`<html>` the moment it is picked and kept across reloads (`setScheme`, `setAppearance`), with a
reset that returns every row to the app's default. Theme, density and layout are choice tiles,
the accent a swatch row. It keys on its container, so it fits a settings row and a popover alike.

## Signature

```ts
AppearanceSwitcher({ accents, rows, defaultFrame, className, }: AppearanceSwitcherProps): ReactElement
  accents?: readonly ("blue" | "violet" | "rose" | "orange" | "green" | "teal")[]  // The accents this app ships (`basalt-ui tokens:css --accents`), its base accent first: picking the first clears `data-accent`
  rows?: readonly AppearanceRow[]  // The rows to show, in this order
  defaultFrame?: "panel" | "flush"  // The `frame` the app's `AppShell` takes, shown while the reader chose none
  className?: string  // Layout only (`w-full`, `max-w-md`)
```

`AppearanceSwitcherProps` import from `basalt-ui/controls`: `import type { AppearanceSwitcherProps } from 'basalt-ui/controls'`.

## Example

```tsx
<AppearanceSwitcher accents={['blue', 'violet', 'teal']} />
```
