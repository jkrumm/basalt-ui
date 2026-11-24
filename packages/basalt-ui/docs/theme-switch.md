---
name: ThemeSwitch
use when: 'a content page needs the reader''s light or dark choice'
never when: 'the app already runs `BasaltProvider` (use the shell''s own switch)'
subpath: basalt-ui/static
peers: [react]
slots: [theme-switch]
---

# ThemeSwitch

Light, dark or system: three toggle buttons in one group. Static markup; `siteScript()` makes
them work (it applies and stores the choice under `basalt:scheme`, as `setScheme` does, and keeps
`aria-pressed` in step). Without the script the page follows the system scheme.

## Signature

```ts
ThemeSwitch({ label, labels, className }: ThemeSwitchProps): ReactElement
  label: string  // The group's accessible name ("Color scheme")
  labels: Readonly<Record<Scheme, string>>  // Each option's accessible name; the buttons show only a glyph
  className?: string
```

`ThemeSwitchProps` import from `basalt-ui/static`: `import type { ThemeSwitchProps } from 'basalt-ui/static'`.

`Scheme` import from `basalt-ui`: `import type { Scheme } from 'basalt-ui'`.

## Example

```tsx
<ThemeSwitch label="Color scheme" labels={{ light: 'Light', dark: 'Dark', auto: 'System' }} />
```
