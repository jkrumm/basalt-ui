---
name: ToastHost
use when: 'the app calls `notify`'
never when: 'the app has no toasts: leaving it out keeps Base UI Toast out of the bundle'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: []
---

# ToastHost

The one toast host: mount it once, inside the app, as an explicit child. It drains the `notify`
queue (anything sent before it mounted included) into the viewport and never moves focus. An
error is announced urgently (mirrored into a `role=alert`), everything else politely.

## Signature

```ts
ToastHost(): ReactElement
```
