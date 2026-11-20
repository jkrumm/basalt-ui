---
name: basaltAstro
use when: 'an Astro site renders `basalt-ui/static` parts and wants basalt''s CSS, fonts and head scripts'
never when: 'the site is a Vite or TanStack Start app (use `basalt()` from `basalt-ui/vite`)'
subpath: basalt-ui/astro
peers: ['@tailwindcss/vite', tailwindcss]
slots: []
---

# basaltAstro

The Astro integration of the `site` profile. Put it after `react()`; do not also add
`@tailwindcss/vite` by hand.

## Signature

```ts
basaltAstro(options?: BasaltAstroOptions): BasaltAstroIntegration
  scheme?: ThemeScriptOptions  // Options of the no-flash scheme script (`basalt-ui/theme-script`)
  fonts?: boolean  // Register basalt's faces with the Astro Fonts API (Fontsource provider)
```

## Example

```tsx
import react from '@astrojs/react'
import { defineConfig } from 'astro/config'
import { basaltAstro } from 'basalt-ui/astro'

export default defineConfig({ integrations: [react(), basaltAstro()] })
```
