---
name: quality
use when: 'a browser test must prove a route is accessible, never scrolls the document sideways and keeps focus visible and unobscured'
never when: 'the test runs in jsdom or happy-dom (these read layout and computed colour), or checks the markup of a single component'
subpath: basalt-ui/testing
peers: []
slots: []
---

# quality

```ts
// The browser-lane assertions over a consumer's own route list. Every function takes a Playwright
// `Page`; `axe` loads the optional axe-core Playwright peer (4.14.x) on first use.
import { quality } from 'basalt-ui/testing'
const ROUTES = ['/', '/runs', '/settings'] // your own list, read from your router if it has one
for (const route of ROUTES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${route} ${scheme}`, async ({ page }) => {
      await quality.setScheme(page, scheme) // before goto: writes basalt:scheme, then asserts data-theme
      await page.goto(route)
      await quality.axe(page, { overlays: ['dialog', 'menu'] }) // serious/critical fail; returns incomplete
      await quality.overflow(page) // 320, 390, 768, 1440, 1800: the document never scrolls sideways
      await quality.ringWalk(page) // Tab through every stop: solid ring, 3:1, not clipped
      await quality.focusNotObscured(page) // 2.4.11: no focused element sits under sticky chrome
      await quality.textSpacing(page) // 1.4.12: nothing clips at line-height 1.5, 0.12em, 0.16em
    })
  }
}
```

## Signature

```ts
quality: { setScheme, axe, overflow, ringWalk, focusNotObscured, textSpacing }
```
