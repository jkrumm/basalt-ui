---
name: routerDefaults
use when: 'an app on TanStack Router builds its router, so preloading, pending timing, scroll restoration and route transitions are set once'
never when: 'the app has no router (pages take the plain-anchor `LinkComponent` default)'
subpath: basalt-ui/router
peers: []
slots: []
---

# routerDefaults

The router options basalt holds and the `LinkComponent` that opens a `navTarget`.

## Signature

```ts
routerDefaults(input?: RouterDefaultsInput): { options: RouterDefaultOptions; link: RouterLinkComponent; }
  router?: () => object
```
