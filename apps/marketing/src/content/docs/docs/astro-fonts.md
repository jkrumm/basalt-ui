---
title: Astro Font Optimization
description: Eliminate font flickering in Astro projects using the Astro 6 Fonts API
---

# Astro Font Optimization

Basalt UI ships `@fontsource-variable` packages as peer dependencies so fonts
work in any framework. In Astro apps you can go further: the **Astro 6 Fonts
API** downloads fonts at build time, serves them from `/_astro/fonts/` with
content-hashed filenames, and auto-injects `<link rel="preload">` so the
browser fetches fonts before the first paint.

The result: **zero FOUT on first load**, no third-party font requests, and
automatic fallback metric adjustments (the role previously filled by
`vite-plugin-fontaine`).

---

## Option A — Astro 6 Fonts API (Recommended)

Requires **Astro 6+**. The Fonts API is stable — no experimental flag needed.

### 1. Upgrade to Astro 6

```bash
npx @astrojs/upgrade
```

### 2. Configure `astro.config.mjs`

```js
import { defineConfig, fontProviders } from 'astro/config'

export default defineConfig({
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Instrument Sans', // Fontsource registry name, not the CSS font-family
      cssVariable: '--font-instrument-sans',
      weights: [400, 500, 600, 700],
      styles: ['normal'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'JetBrains Mono', // Fontsource registry name
      cssVariable: '--font-jetbrains-mono',
      weights: [400, 500, 700],
      styles: ['normal'],
    },
  ],
})
```

`fontProviders.fontsource()` fetches font files from the Fontsource registry
during the build and caches them locally — no `@fontsource-variable/*` npm
packages needed in the Astro app itself.

### 3. Add `<Font>` to your layout

```astro
---
import { Font } from 'astro:assets'
---
<head>
  <Font cssVariable="--font-instrument-sans" preload />
  <Font cssVariable="--font-jetbrains-mono" preload />
</head>
```

`preload` injects a `<link rel="preload" as="font">` for the woff2 subset that
matches the page's Unicode range. Remove the attribute to skip preloading
(useful for secondary/icon fonts).

### 4. Reference in CSS

The API injects a `--font-instrument-sans` CSS variable containing the
`font-family` value. Basalt UI's `index.css` already maps this to the
`--font-sans` token via:

```css
@theme inline {
  --font-sans: var(--font-instrument-sans, 'Instrument Sans Variable', sans-serif);
  --font-mono: var(--font-jetbrains-mono, 'JetBrains Mono Variable', monospace);
}
```

When the Fonts API is active the variable resolves to the build-time hashed
font stack; when it is absent (e.g. non-Astro consumers) the fallback chain
kicks in.

### 5. Remove conflicting tooling

If you previously used `vite-plugin-fontaine`, remove it — the Fonts API
generates equivalent metric fallbacks natively:

```bash
bun remove fontaine
```

---

## Option B — Manual Preloads + Fontaine (Astro 4 / 5)

Use this approach when you cannot upgrade to Astro 6.

### Fontaine for metric fallbacks

```bash
bun add -D fontaine
```

```js
// astro.config.mjs
import { FontaineTransform } from 'fontaine'

export default defineConfig({
  vite: {
    plugins: [
      FontaineTransform.vite({
        fallbacks: {
          'Instrument Sans Variable': ['Helvetica Neue', 'Segoe UI', 'Arial'],
          'JetBrains Mono Variable': ['Consolas', 'Menlo', 'Courier New'],
        },
        resolvePath: (id) => new URL(`../../node_modules/${id}`, import.meta.url),
      }),
    ],
  },
})
```

### Manual preload links

Find the exact woff2 path from the built `dist/` output and hardcode it:

```astro
<link
  rel="preload"
  as="font"
  type="font/woff2"
  href="/_fonts/instrument-sans-latin-400-normal.woff2"
  crossorigin
/>
```

**Caveat:** Filenames are content-hashed and will change when font versions
update. You must re-check the path after every `@fontsource-variable` upgrade.

---

## Troubleshooting

### Double `@font-face` rules

Basalt UI's `index.css` declares `@font-face` for non-Astro consumers. When the
Fonts API is active, both sets load and the browser picks whichever it resolves
first. This is harmless but wastes bandwidth.

To suppress the basalt-ui declarations in your Astro app, override them in your
`global.css` after the basalt-ui import:

```css
@import 'basalt-ui'; /* or relative path in monorepo */

/* Suppress @fontsource declarations — Astro Fonts API serves these instead */
@font-face {
  font-family: 'Instrument Sans Variable';
  src: local('');
}
@font-face {
  font-family: 'JetBrains Mono Variable';
  src: local('');
}
```

`src: local('')` matches nothing and effectively disables the rule, letting the
Fonts API's hashed files win.

### Variable font axes not loading

The `weights` array in the config controls which static instances are
downloaded. For variable fonts you only need one entry per style (the range is
encoded in the woff2 file). If you see a specific weight missing, verify the
font file covers that range via the Fontsource registry.

### Build fails with "Cannot find font"

`fontProviders.fontsource()` resolves font names from the Fontsource registry
at build time. The `name` field must match the **Fontsource registry family name**, not the
CSS `font-family` value. Use `"Instrument Sans"` (the registry name), not
`"Instrument Sans Variable"` (the CSS family). Check the font's
`metadata.json` → `"family"` field for the exact value.
