---
name: defineOverlays
use when: 'a dialog or sheet opens from anywhere (a row action, a command) and its keys and payloads should be checked at compile time'
never when: 'the overlay is route-addressable or one trigger owns its open state (use `Dialog` or `Sheet` with a trigger)'
subpath: basalt-ui/page
peers: ['@base-ui/react']
slots: []
---

# defineOverlays

Defines the overlays of an app once and returns the typed handle that opens them: `open('key',
payload)` fails to compile on a key that was not defined and on a payload the body does not
take. Each overlay is a title and a render function; a form dialog is an entry whose `render`
returns the form. Mount `<OverlayHost overlays={OVERLAYS} />` once beside the router. An app that
defines none, or never mounts the host, ships none of it.

## Signature

```ts
defineOverlays<const T extends OverlayMap>(specs: T): OverlayRegistry<T>
```
