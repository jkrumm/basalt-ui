---
name: basaltShiki
use when: 'an Astro site highlights fenced code with Astro''s own Shiki and renders it in basalt''s prose'
never when: 'the site is Starlight, whose expressive-code highlights the code (see `themeCssSelector` in docs/astro.md)'
subpath: basalt-ui/astro
peers: ['@astrojs/react', '@tailwindcss/vite', astro, tailwindcss]
slots: []
---

# basaltShiki

Astro's `markdown.shikiConfig` for basalt: a light and a dark theme, both written as custom
properties, so the page's scheme decides which one a block shows with no script and no repaint.

## Signature

```ts
basaltShiki: { themes: { light, dark }, defaultColor, wrap }
```

## Example

```tsx
import { basaltShiki } from 'basalt-ui/astro'
export default defineConfig({ markdown: { shikiConfig: basaltShiki } })
```
