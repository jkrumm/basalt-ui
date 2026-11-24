---
name: siteScript
use when: 'a content site outside Astro (TanStack Start, Vite) needs the theme switch, the copy button and the tabs without the astro integration'
never when: 'the site is Astro: `basaltAstro()` inlines both head scripts itself'
subpath: basalt-ui/static
peers: [react]
slots: []
---

# siteScript

The inline script the static parts share: `ThemeSwitch` applies and stores the scheme, `SiteCodeBlock`
copies its block. `basaltAstro()` inlines it after `themeScript()` with the same scheme options.
About 1.4 kB gzip; a unit test holds it and `themeScript()` under 2 kB together.
A TanStack Start or Vite content site inlines `themeScript()` then `siteScript()` in its head with the same scheme options.

## Signature

```ts
siteScript(options?: SiteScriptOptions): string
  key?: string
  attribute?: string
  cookie?: string
```

`SiteScriptOptions` import from `basalt-ui/static`: `import type { SiteScriptOptions } from 'basalt-ui/static'`.
