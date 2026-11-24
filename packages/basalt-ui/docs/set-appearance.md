---
name: setAppearance
use when: 'an app control or command changes the reader''s density, frame or accent outside `AppearanceSwitcher`'
never when: 'the switcher already offers the choice, or code writes `data-density`, `data-frame`, `data-accent` or `basalt:appearance` by hand'
subpath: basalt-ui
peers: []
slots: []
---

# setAppearance

`setAppearance({ density: 'normal', accent: 'violet', frame: null })` applies the change to
`<html>` at once and stores the merged result. `setAppearance()` re-reads storage and applies it,
overriding the attributes: call it after an async restore.

## Signature

```ts
setAppearance(change?: AppearanceChange): void
  density?: "dense" | "normal" | "comfortable" | null
  frame?: "panel" | "flush" | null
  accent?: "blue" | "violet" | "rose" | "orange" | "green" | "teal" | null
```
