---
name: setScheme
use when: 'a control or a command switches the color scheme, or an async restore must re-apply the stored one'
never when: 'the app picks the first scheme at mount (pass `BasaltProvider` `scheme`), or code writes `data-theme` or `basalt:scheme` by hand'
subpath: basalt-ui
peers: []
slots: []
---

# setScheme

`setScheme('dark' | 'light' | 'auto')` applies, stores the declared key (default `basalt:scheme`)
and mirrors the declared cookie. `setScheme()` re-reads storage and applies, overriding any attribute: call it after an
async restore (same-tab localStorage writes fire no storage event).

## Signature

```ts
setScheme(value?: Scheme, options?: { cookie?: string; key?: string; }): void
```

`Scheme` import from `basalt-ui`: `import type { Scheme } from 'basalt-ui'`.
