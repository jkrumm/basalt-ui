---
name: defineNav
use when: 'an app declares its rail, tab bar, breadcrumb and palette destinations once, at module scope'
never when: 'the destinations are one-off links with no shared nav (use a plain Link)'
subpath: basalt-ui/router
peers: []
slots: []
---

# defineNav

Declares the whole navigation (sections, pinned items, mobile tuning) as one typed, pure config.

## Signature

```ts
defineNav<const S extends ReadonlyArray<AnyNavSection>, const P extends ReadonlyArray<AnyNavItem> = [], const T extends ReadonlyArray<NavTabId<{ sections: S; pinned: P; }>> = []>(config: RegisteredOr<NavConfigInput<S, P, T>>): NavConfig<S, P, T>
```
