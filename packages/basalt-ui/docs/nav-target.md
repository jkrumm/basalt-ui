---
name: navTarget
use when: 'a prop that takes a link (a breadcrumb parent, a card `href`, an inner-nav entry) must open a typed route'
never when: 'the destination is an external URL or a plain path string (pass the string)'
subpath: basalt-ui/router
peers: ['@tanstack/react-router']
slots: []
---

# navTarget

Wraps `linkOptions({ ... })` as an opaque target for any prop typed `string | NavTarget`. The
options stay validated against the registered router (a typo in `to` is a compile error); the
target itself carries nothing a caller can read or build by hand.

## Signature

```ts
navTarget<const TOptions>(options: NavTargetOptions<TOptions>): NavTarget
```

`NavTarget` import from `basalt-ui`: `import type { NavTarget } from 'basalt-ui'`.

## Example

```tsx
<PageBar title="Run 12" parent={{ label: 'Runs', href: navTarget(linkOptions({ to: '/runs' })) }} />
```
