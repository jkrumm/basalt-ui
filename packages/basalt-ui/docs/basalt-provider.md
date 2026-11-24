---
name: BasaltProvider
use when: 'an app mounts its tree once at the entry, so the color scheme, the locale, the link every link prop renders through and the push binding are set in one place'
never when: 'a leaf renders on its own (it needs no provider: English, `auto` scheme, a plain anchor)'
subpath: basalt-ui/router
peers: ['@tanstack/react-router']
slots: []
---

# BasaltProvider

The app's root provider: scheme, locale, `<html lang>`, the installed link and an optional push
binding, nothing else. The entry imports it from `basalt-ui/router` beside `routerDefaults`, whose
`link` it takes.

## Signature

```ts
BasaltProvider({ scheme, locale, lang, link, live, children, }: BasaltProviderProps): ReactNode
  scheme?: Scheme  // Stamped on `<html data-theme>` and stored raw
  locale?: string  // BCP 47 tag the formatters read
  lang?: string  // `<html lang>`, written in an effect
  link?: LinkComponent  // The link every link prop renders through: `routerDefaults().link` for an app on TanStack Router, so a `string | NavTarget` target navigates without a document load
  live?: LiveBinding  // A push binding (`bindInvalidation(queryClient, channel, o)`) started once on the client when the provider mounts and stopped on unmount; a server render starts nothing
  children?: ReactNode
```

`BasaltProviderProps`, `LinkComponent`, `LiveBinding`, `Scheme` import from `basalt-ui`: `import type { BasaltProviderProps, LinkComponent, LiveBinding, Scheme } from 'basalt-ui'`.

## Example

```tsx
<BasaltProvider link={routerDefaults().link} locale="en">
  <RouterProvider router={router} />
</BasaltProvider>
```
