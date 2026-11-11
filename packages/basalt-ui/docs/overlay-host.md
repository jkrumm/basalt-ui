---
name: OverlayHost
use when: 'an app opens overlays by key through `defineOverlays`'
never when: 'the app has no imperative overlays (omit it; it then ships nothing)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: []
---

# OverlayHost

Renders the overlays a registry has open, newest on top: a `dialog` or a `sheet` by the spec's
`as`. Mount it once, beside the router, as an explicit child: it is the only part of the overlay
system that loads `ui/dialog` and `ui/sheet`. It renders nothing on the server and during
hydration, so a stack never mismatches.

## Signature

```ts
OverlayHost<T extends OverlayMap>({ overlays, defaultOpen, }: OverlayHostProps<T>): ReactElement
  overlays: OverlayRegistry<T>
  defaultOpen?: OverlayCall<T>
```
