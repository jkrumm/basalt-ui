---
name: defineNav
use when: 'an app declares its rail, tab bar, breadcrumb and palette destinations once, at module scope'
never when: 'the destinations are one-off links with no shared nav (use a plain Link)'
subpath: basalt-ui/router
peers: ['@tanstack/react-router']
slots: []
---

# defineNav

Declares the whole navigation (sections, pinned items, mobile tuning) as one typed, pure config.

## Signature

```ts
defineNav<const S extends ReadonlyArray<AnyNavSection>, const P extends ReadonlyArray<AnyNavItem> = [], const T extends ReadonlyArray<NavTabId<{ sections: S; pinned: P; }>> = []>(config: RegisteredOr<NavConfigInput<S, P, T>>): NavConfig<S, P, T>
```

`NavConfig` import from `basalt-ui/router`: `import type { NavConfig } from 'basalt-ui/router'`.

## Example

```tsx
// src/lib/nav.tsx, module scope: anchor identity keys on these objects
export const NAV = defineNav({
  sections: [
    {
      id: 'training',
      label: 'Training',
      items: [
        { id: 'overview', label: 'Overview', icon: Gauge, link: linkOptions({ to: '/' }), mobile: 'tab' }, // '/' is always exact
        {
          id: 'finance', label: 'Finance', short: 'Money', icon: Wallet, exact: true, mobile: 'tab',
          link: linkOptions({ to: '/finance' }),
          children: [
            { id: 'month', label: 'Month', link: linkOptions({ to: '/finance/$month', params: { month: 'latest' } }) },
          ],
        },
        {
          id: 'jobs', label: 'Jobs', icon: Play, link: linkOptions({ to: '/jobs' }),
          activeWhen: ({ pathname }) => pathname.startsWith('/runs'),
        },
      ],
    },
  ],
  pinned: [{ id: 'settings', label: 'Settings', icon: Cog, link: linkOptions({ to: '/settings' }), mobile: 'more' }], // rail bottom
})
```
