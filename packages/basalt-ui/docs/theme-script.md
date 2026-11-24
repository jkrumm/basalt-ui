---
name: themeScript
use when: 'a host renders its own `<head>` (TanStack Start, a content site outside Astro) and must set the scheme before paint'
never when: 'the app builds with `basalt()` from `basalt-ui/vite` or `basaltAstro()` from `basalt-ui/astro`, which inline it already'
subpath: basalt-ui/static
peers: [react]
slots: []
---

# themeScript

Boot script for `<head>`. Four duties: read (key, cookie, default), validate, stamp
`attribute` for light or dark when none exists yet, tolerate throwing storage. `auto` stamps
nothing. Logic is its own copy of `readScheme`; parity is tested, not shared. A second statement
does the same for the appearance object: each valid `density`, `frame` and `accent` becomes its
`data-*` attribute unless the page already has one (its copy of `readAppearance`, tested alike).

## Signature

```ts
themeScript(options?: ThemeScriptOptions): string
  key?: string
  attribute?: string
  default?: Scheme
  cookie?: string
  appearance?: false  // `false` stamps only the scheme; by default the appearance `setAppearance` stored is stamped too
```

`ThemeScriptOptions` import from `basalt-ui/theme-script`: `import type { ThemeScriptOptions } from 'basalt-ui/theme-script'`.

`Scheme` import from `basalt-ui`: `import type { Scheme } from 'basalt-ui'`.
