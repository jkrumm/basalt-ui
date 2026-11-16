---
name: routerDefaults
use when: 'an app on TanStack Router builds its router, so preloading, pending timing, scroll restoration and route transitions are set once'
never when: 'the app has no router (a link prop renders a plain anchor with no `link` installed)'
subpath: basalt-ui/router
peers: ['@tanstack/react-router']
slots: []
---

# routerDefaults

The router options basalt holds and the `LinkComponent` that opens a `navTarget`.

## Signature

```ts
routerDefaults(): { options: RouterDefaultOptions; link: RouterLinkComponent; bind: (router: object) => void; }
```

## Example

```tsx
// The three screens are the app's own, scaffolded by `basalt-ui init` into `src/components/`;
// no subpath exports them.
const { options, link, bind } = routerDefaults()
export const router = createRouter({
  routeTree,
  ...options,
  defaultPendingComponent: RoutePending,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: RouteMissing,
})
bind(router)

export const app = (
  <BasaltProvider link={link}>
    <RouterProvider router={router} />
  </BasaltProvider>
)
```
