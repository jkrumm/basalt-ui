---
name: BasaltProvider
use when: 'an app mounts its tree once at the entry, so the colour scheme, the locale and the link every link prop renders through are set in one place'
never when: 'a leaf renders on its own (it needs no provider: English, `auto` scheme, a plain anchor)'
subpath: basalt-ui/router
peers: []
slots: []
---

# BasaltProvider

The app's root provider: scheme, locale, `<html lang>` and the installed link, nothing else. The
entry imports it from `basalt-ui/router` beside `routerDefaults`, whose `link` it takes.

## Signature

```ts
BasaltProvider({ scheme, locale, lang, link, children, }: BasaltProviderProps): ReactNode
  scheme?: Scheme
  locale?: string
  lang?: string
  link?: LinkComponent
  children?: ReactNode
```
