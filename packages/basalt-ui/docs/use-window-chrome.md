---
name: useWindowChrome
use when: 'a component placed in the header or over its corner must clear the native window buttons'
never when: 'the layout can use `var(--chrome-lead-inset)` in CSS instead'
subpath: basalt-ui/shell
peers: ['@base-ui/react']
slots: []
---

# useWindowChrome

The window chrome of the shell this component sits in: `chrome` and `leadInset`, the px at the
header's lead edge that the window's own buttons cover (0 on the web). Read it to keep your own
header content out of that strip. Outside an `AppShell` it reads `web`.

## Signature

```ts
useWindowChrome(): WindowChrome
```
