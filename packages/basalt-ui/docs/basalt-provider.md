---
name: BasaltProvider
use when: 'an app mounts its tree once at the entry, so the colour scheme, the locale, the link every link prop renders through and the push binding are set in one place'
never when: 'a leaf renders on its own (it needs no provider: English, `auto` scheme, a plain anchor)'
subpath: basalt-ui/router
peers: []
slots: []
---

# BasaltProvider

The app's root provider: scheme, locale, `<html lang>`, the installed link and an optional push
binding, nothing else. The entry imports it from `basalt-ui/router` beside `routerDefaults`, whose
`link` it takes.

## Signature

```ts
BasaltProvider({ scheme, locale, lang, link, live, children, }: BasaltProviderProps): ReactNode
  scheme?: Scheme
  locale?: string
  lang?: string
  link?: LinkComponent
  live?: LiveBinding
  children?: ReactNode
```
