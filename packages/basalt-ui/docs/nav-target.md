---
name: navTarget
use when: 'a prop that takes a link (a breadcrumb parent, a card `href`, an inner-nav entry) must open a typed route'
never when: 'the destination is an external URL or a plain path string (pass the string)'
subpath: basalt-ui/router
peers: []
slots: []
---

# navTarget

Wraps `linkOptions({ ... })` as an opaque target for any prop typed `string | NavTarget`. The
options stay validated against the registered router (a typo in `to` is a compile error); the
target itself carries nothing a caller can read or build by hand.

## Signature

```ts
navTarget<const TOptions>(options: ValidateLinkOptions<RegisteredRouter, TOptions>): NavTarget
```
