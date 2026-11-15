---
name: routerDefaults
use when: 'an app on TanStack Router builds its router, so preloading, pending timing, scroll restoration and route transitions are set once'
never when: 'the app has no router (a link prop renders a plain anchor with no `link` installed)'
subpath: basalt-ui/router
peers: []
slots: []
---

# routerDefaults

The router options basalt holds and the `LinkComponent` that opens a `navTarget`.

## Signature

```ts
routerDefaults(input?: RouterDefaultsInput): { options: RouterDefaultOptions; link: RouterLinkComponent; }
  router?: () => object  // The router the options go into, read lazily at navigation time (it does not exist yet when the options are bu…
```

## Example

```tsx
const { options, link } = routerDefaults({ router: () => router })
export const router = createRouter({
  routeTree,
  ...options,
  defaultPendingComponent: RoutePending,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: RouteMissing,
})

<BasaltProvider link={link}>
  <RouterProvider router={router} />
</BasaltProvider>
```
