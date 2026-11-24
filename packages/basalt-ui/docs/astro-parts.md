---
name: ASTRO_PARTS
use when: 'deciding whether a part on an Astro page needs a client directive, and which one'
never when: 'the page is an app page (a Vite or TanStack Start app hydrates the whole tree)'
subpath: basalt-ui/astro
peers: ['@astrojs/react', '@tailwindcss/vite', astro, tailwindcss]
slots: []
---

# ASTRO_PARTS

Every part the Astro matrix measures, in its order: how each behaves with no JavaScript and the
render mode it measured best in. `basaltAstro()` fails a build on a `required` part outside an island.

## Signature

```ts
ASTRO_PARTS: readonly AstroPart[]
```

`AstroPart` import from `basalt-ui/astro`: `import type { AstroPart } from 'basalt-ui/astro'`.
