---
name: installDomShims
use when: 'a jsdom or happy-dom test mounts a Base UI popup and the runner lacks a browser API it touches'
never when: 'the test runs in a real browser, or the runner is neither jsdom nor happy-dom (it throws)'
subpath: basalt-ui/testing
peers: []
slots: []
---

# installDomShims

Installs `ResizeObserver`, `IntersectionObserver`, `matchMedia`, `scrollTo` (window and element)
and `PointerEvent` on the current `window` and `globalThis`. Call it before the first render.

## Signature

```ts
installDomShims(): void
```
