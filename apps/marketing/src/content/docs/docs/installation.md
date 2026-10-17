---
title: Installation
description: Install Basalt UI in your project
---

# Installation

Basalt UI is a Tailwind CSS v4 design system package. Follow these steps to install and configure it.

## Quick Start

### Step 1: Install Basalt UI and Dependencies

```bash
# Using Bun (recommended)
bun add basalt-ui
bun add -D @tailwindcss/typography shadcn tw-animate-css

# Using npm
npm install basalt-ui
npm install -D @tailwindcss/typography shadcn tw-animate-css

# Using pnpm
pnpm add basalt-ui
pnpm add -D @tailwindcss/typography shadcn tw-animate-css
```

**Why these dependencies?**
- `@tailwindcss/typography` - Powers the `.prose` class for content styling
- `shadcn` - Component CLI tool for adding UI components
- `tw-animate-css` - Animation utilities

**Note:** These are peer dependencies, meaning you install them separately. This prevents version conflicts and lets you control which versions you use.

### Step 2: Import the CSS

Add this to your main CSS file:

```css
/* src/styles/globals.css or app/globals.css */
@import "basalt-ui/css";
```

⚠️ **Critical:** This import **REPLACES** `@import "tailwindcss"` - do NOT use both!

```css
/* ❌ WRONG - Don't import both */
@import "tailwindcss";
@import "basalt-ui/css";

/* ✅ CORRECT - Only basalt-ui */
@import "basalt-ui/css";
```

**Why?** BasaltUI includes the complete Tailwind v4 theme. Importing both causes conflicts and duplicate CSS.

**Import path formats:**
- ✅ `basalt-ui/css` (correct)
- ❌ `basalt-ui` (wrong)
- ❌ `basalt-ui/src/index.css` (wrong)

**What this imports:**
- Complete Tailwind v4 theme (`@theme inline` CSS)
- Font-family CSS tokens (Instrument Sans Variable, JetBrains Mono Variable) — font files must be loaded by your app
- CSS variables for light/dark modes
- Typography plugin configuration
- Animation utilities

**What you DON'T need:**
- No `tailwind.config.js` file required
- No PostCSS configuration

:::note[Font loading]
basalt-ui defines font-family tokens but does **not** bundle font files. You need to load fonts in your app — see the [Fonts](#fonts) section below for per-framework setup.
:::

**Tailwind version requirement:**
Basalt UI requires **Tailwind CSS v4.1.18 or newer**. Earlier v4.0.x versions had critical bugs that are fixed in v4.1.18+.

### Step 3: Add Dark Mode

Add the `dark` class to your HTML element:

```html
<html class="dark">
  <!-- Your app -->
</html>
```

**Dynamic theme switching:**

See the [Dark Mode Toggle](#dark-mode-toggle-component) section below for complete React/Vue component examples.

### Step 4: Custom CSS Variables (Optional)

If you need project-specific design tokens or overrides, add them **AFTER** the basalt-ui import:

```css
/* src/styles/globals.css */
@import "basalt-ui/css";  /* Must come first */

/* Your custom overrides come after */
:root {
  --my-custom-color: oklch(0.7 0.1 200);
  --my-spacing: 2rem;
}

/* Override BasaltUI tokens if needed (not recommended) */
.dark {
  --background: oklch(0.15 0.01 285);  /* Darker than default */
}
```

**Important ordering rules:**
1. ✅ `@import "basalt-ui/css"` must be first
2. ✅ Your custom CSS variables come after
3. ❌ Don't define custom variables before the import (they'll be overridden)

## Framework-Specific Setup

### Vite (React, Vue, Svelte)

**1. Install Tailwind v4 Vite plugin:**
```bash
bun add -D @tailwindcss/vite
```

**2. Configure Vite:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(), // ⚠️ Must come before framework plugin
    react(),
  ],
});
```

**3. Install fonts:**
```bash
bun add @fontsource-variable/instrument-sans @fontsource-variable/jetbrains-mono
```

**4. Import CSS in entry file:**
```typescript
// src/main.tsx
import './styles/globals.css';
```

**5. Create globals.css:**
```css
/* src/styles/globals.css */

/* Self-hosted variable fonts */
@import "@fontsource-variable/instrument-sans";
@import "@fontsource-variable/jetbrains-mono";

/* basalt-ui design tokens (includes Tailwind v4) */
@import "basalt-ui/css";
```

Font imports must come **before** `basalt-ui/css` so the `@font-face` declarations are in scope when Tailwind processes the font-family tokens.

:::tip[Zero FOUT with fontaine]
Add `vite-plugin-fontaine` to generate metric-calibrated fallbacks and reach near-zero CLS. See [Font Performance](#font-performance) below.
:::

### Next.js (App Router)

**1. Create global CSS file:**
```css
/* app/globals.css */
@import "basalt-ui/css";
```

**2. Import in root layout:**
```typescript
// app/layout.tsx
import './globals.css';

export default function RootLayout({ children }) {
  return (
    <html className="dark">
      <body>{children}</body>
    </html>
  );
}
```

**Note:** Tailwind v4 CSS imports work automatically in Next.js 15+ with App Router. No config file needed!

### Astro

**1. Install Tailwind CSS v4 Vite plugin:**
```bash
bun add -D @tailwindcss/vite
```

**2. Add plugin to Astro config:**
```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
});
```

**3. Create global CSS file:**
```css
/* src/styles/global.css */
@import "basalt-ui/css";
```

**4. Import in layout:**
```astro
---
// src/layouts/Layout.astro
import '../styles/global.css';
---
<html class="dark">
  <body>
    <slot />
  </body>
</html>
```

#### Font Loading

Use the **Astro 6 Fonts API** — it downloads fonts at build time, serves them
from `/_astro/fonts/` with content-hashed filenames, injects preload hints
automatically, and generates metric-calibrated fallbacks. No extra packages needed.

**`astro.config.mjs`:**
```js
import { defineConfig, fontProviders } from 'astro/config'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Instrument Sans',
      cssVariable: '--font-instrument-sans',
      weights: [400, 500, 600, 700],
      styles: ['normal'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains-mono',
      weights: [400, 500, 700],
      styles: ['normal'],
    },
  ],
  vite: { plugins: [tailwindcss()] },
})
```

**Layout.astro:**
```astro
---
import { Font } from 'astro:assets'
import '../styles/global.css'
---
<html>
  <head>
    <Font cssVariable="--font-instrument-sans" preload />
    <Font cssVariable="--font-jetbrains-mono" preload />
  </head>
  <body><slot /></body>
</html>
```

The `preload` attribute injects `<link rel="preload" as="font">` for the correct
unicode-range subsets — fonts arrive before the first paint with zero FOUT.

:::tip[Full guide]
See [Astro Font Optimization](/docs/astro-fonts) for Starlight head injection,
Astro 4/5 fallback approach, and troubleshooting.
:::

## Integration with UI Libraries

### ShadCN UI

Basalt UI works seamlessly with ShadCN:

```bash
# Install ShadCN CLI
npx shadcn@latest init

# Choose "Zinc" as base color when prompted

# Add components
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
```

**How it works:**
- ShadCN components use classes like `bg-primary`, `text-foreground`
- Basalt UI provides these via CSS variables
- Dark mode switches automatically with `.dark` class
- No additional configuration needed

### Tremor Charts

Tremor Raw chart components use Basalt colors automatically:

```tsx
import { AreaChart } from '@tremor/react';

<AreaChart
  data={chartData}
  index="date"
  categories={["sales"]}
  colors={["blue"]}  // Uses Basalt OKLCH blue
/>
```

**Available colors:**
- `blue`, `red`, `emerald`, `amber`, `violet`, `cyan`, `indigo`
- Sequential: `chart-blue-1` through `chart-blue-8`

### Starlight Documentation

For Astro Starlight, import the dedicated CSS file:

```typescript
// astro.config.mjs
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'My Docs',
      customCss: [
        'basalt-ui/starlight',
      ],
    }),
  ],
});
```

## Fonts

basalt-ui defines font-family tokens but does **not** bundle font files. This
keeps the package framework-agnostic and lets each app pick the best loading
strategy for its stack.

**Tokens defined by the package:**

```css
--font-heading: "Instrument Sans Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-body:    "Instrument Sans Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-mono:    "JetBrains Mono Variable", "Menlo", "Monaco", "Courier New", monospace;
```

**Fonts used:**

| Font | Role | Variable axes |
|-|-|-|
| Instrument Sans Variable | Headings + body | weight 400–700, width 75–100% |
| JetBrains Mono Variable | Code + monospace | weight 100–800 |

## Font Performance

The goal is zero FOUT (Flash of Unstyled Text) and zero CLS (Cumulative Layout
Shift). The approach differs by framework.

### Astro 6 (recommended)

The **Astro 6 Fonts API** handles everything in one step: downloads fonts at
build time, serves them from `/_astro/fonts/` with content-hashed filenames,
generates metric-calibrated fallbacks, and injects preload hints automatically.

See the complete setup in the [Astro section above](#astro) and the
[Astro Font Optimization guide](/docs/astro-fonts) for full details.

### Vite / React

**1. Install fonts:**
```bash
bun add @fontsource-variable/instrument-sans @fontsource-variable/jetbrains-mono
```

**2. Import in your global CSS (before `basalt-ui/css`):**
```css
@import "@fontsource-variable/instrument-sans";
@import "@fontsource-variable/jetbrains-mono";
@import "basalt-ui/css";
```

This gives you self-hosted fonts with `font-display: swap` — text is visible
immediately and the web font swaps in when loaded. To eliminate the visual
jump on swap (CLS), add metric-calibrated fallbacks with fontaine:

**3. Optional — zero CLS with fontaine:**
```bash
bun add -D fontaine
```

```ts
// vite.config.ts
import { FontaineTransform } from 'fontaine'

export default defineConfig({
  plugins: [
    tailwindcss(),
    FontaineTransform.vite({
      fallbacks: {
        'Instrument Sans Variable': ['Helvetica Neue', 'Segoe UI', 'Roboto', 'Arial'],
        'JetBrains Mono Variable': ['Consolas', 'Menlo', 'SF Mono', 'Courier New'],
      },
      resolvePath: (id) => new URL('node_modules/' + id, import.meta.url),
    }),
    react(),
  ],
})
```

fontaine reads your font files at build time and generates `@font-face` overrides
for the fallback fonts with matched metrics. When the metrics match, the swap is
visually invisible and CLS reaches zero.

### Next.js

**1. Install fonts:**
```bash
bun add @fontsource-variable/instrument-sans @fontsource-variable/jetbrains-mono
```

**2. Import in `app/globals.css`:**
```css
@import "@fontsource-variable/instrument-sans";
@import "@fontsource-variable/jetbrains-mono";
@import "basalt-ui/css";
```

**3. Optional — zero CLS with fontaine:**
```ts
// next.config.ts
import { FontaineTransform } from 'fontaine'

const nextConfig = {
  webpack(config) {
    config.plugins.push(
      FontaineTransform.webpack({
        fallbacks: {
          'Instrument Sans Variable': ['Helvetica Neue', 'Segoe UI', 'Roboto', 'Arial'],
          'JetBrains Mono Variable': ['Consolas', 'Menlo', 'SF Mono', 'Courier New'],
        },
        resolvePath: (id) => new URL('node_modules/' + id, import.meta.url),
      })
    )
    return config
  },
}
```

:::note[Monorepo resolvePath]
When `node_modules` is hoisted to the monorepo root, adjust the path:
```js
resolvePath: (id) => new URL('../../node_modules/' + id, import.meta.url)
```
:::

## Requirements

### Peer Dependencies
- **Tailwind CSS v4+** - Core CSS framework
- **@tailwindcss/typography** - Typography plugin for `.prose` class
- **tw-animate-css** - Animation utilities
- **shadcn** - Component utilities

All must be installed in your project (listed above).

### Browser Support
Modern browsers with OKLCH color support:
- Chrome 111+
- Edge 111+
- Safari 16.4+
- Firefox 113+

## Troubleshooting

### Error: "./css" is not exported under the condition "style"

**Cause:** Using Tailwind v4 Vite plugin with older basalt-ui version.

**Fix:** Update basalt-ui to latest version:
```bash
bun update basalt-ui
# or
npm update basalt-ui
```

### Error: Can't resolve '@tailwindcss/typography'

**Cause:** Peer dependencies not installed.

**Fix:** Install all required peer dependencies:
```bash
bun add -D @tailwindcss/typography shadcn tw-animate-css
```

### Error: Cannot find module 'basalt-ui'

**Cause:** Using incorrect import path.

**Fix:** Use `basalt-ui/css` (not `basalt-ui` or `basalt-ui/src/index.css`):
```css
/* ❌ Wrong */
@import "basalt-ui";
@import "basalt-ui/src/index.css";

/* ✅ Correct */
@import "basalt-ui/css";
```

### Styles not applying / Components look unstyled

**Possible causes:**
1. CSS import order incorrect
2. Missing Tailwind plugin configuration
3. Dark mode class not applied

**Fixes:**
1. Ensure `basalt-ui/css` is imported in your entry CSS file
2. For Vite: Add `@tailwindcss/vite` plugin BEFORE framework plugin
3. For Next.js: Ensure globals.css is imported in root layout
4. Add `class="dark"` to your `<html>` element
5. Check browser console for CSS loading errors

### Vite plugin order

**Error:** Styles not loading in Vite projects

**Cause:** Tailwind plugin must come before framework plugin

**Fix:**
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    tailwindcss(),  // ✅ First
    react(),        // ✅ Second
  ],
});

// ❌ Wrong order:
// plugins: [react(), tailwindcss()]
```

### Fonts not loading

**Symptom:** Using fallback system fonts instead of Instrument Sans

**Check:**
1. Verify fonts are loaded per your framework (see [Font Performance](#font-performance))
2. Check browser DevTools Network tab for font requests
3. Look for font files (e.g. `InstrumentSans-Variable.woff2`)
4. Ensure font imports come **before** `basalt-ui/css` in your CSS
5. Ensure no Content Security Policy blocking fonts

**Note:** basalt-ui provides font-family tokens only — you must load fonts in your app.

### ShadCN components wrong colors

**Symptom:** ShadCN components not using Basalt colors

**Fix:**
1. Import `basalt-ui/css` BEFORE running `shadcn init`
2. Choose "Zinc" as base color during initialization
3. Basalt provides CSS variables (`--background`, `--primary`, etc.)
4. Components automatically use these

**Verify:**
```tsx
<Button variant="default">Primary Button</Button>
// Should be blue (Basalt primary color)
```

### Dark mode not working

**Symptom:** Dark mode not activating

**Cause:** Missing `.dark` class on `<html>` element

**Fix:**
```html
<!-- ✅ Correct -->
<html class="dark">

<!-- ❌ Wrong -->
<body class="dark">  <!-- Must be on html! -->
```

## Dark Mode Toggle Component

### React Example

```tsx
'use client'; // For Next.js App Router

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || 'dark';
    setTheme(initialTheme);
    document.documentElement.classList.toggle('dark', initialTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    localStorage.setItem('theme', newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
    </button>
  );
}
```

### Vue 3 Example

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';

const theme = ref<'light' | 'dark'>('dark');

onMounted(() => {
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
  const initialTheme = savedTheme || 'dark';
  theme.value = initialTheme;
  document.documentElement.classList.toggle('dark', initialTheme === 'dark');
});

const toggleTheme = () => {
  const newTheme = theme.value === 'dark' ? 'light' : 'dark';
  theme.value = newTheme;
  document.documentElement.classList.toggle('dark', newTheme === 'dark');
  localStorage.setItem('theme', newTheme);
};
</script>

<template>
  <button
    @click="toggleTheme"
    class="rounded-md bg-primary px-4 py-2 text-primary-foreground"
    aria-label="Toggle theme"
  >
    {{ theme === 'dark' ? '🌙 Dark' : '☀️ Light' }}
  </button>
</template>
```

### Vanilla JavaScript

```javascript
// Toggle dark mode
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Load saved theme on page load
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.classList.toggle('dark', savedTheme === 'dark');
```

### TypeScript errors

If you see TypeScript errors related to basalt-ui, ensure you have the latest version:
```bash
bun update basalt-ui
```

**If errors persist:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "types": ["vite/client"]
  }
}
```

### Monorepo resolution issues

**Symptom:** Can't resolve `basalt-ui/css` in monorepo workspace

**Fix (Option 1):** Use relative path:
```css
/* apps/web/src/styles/global.css */
@import "../../../../packages/basalt-ui/src/index.css";
```

**Fix (Option 2):** Use `@source` directive (Tailwind v4):
```css
@import "tailwindcss";
@import "basalt-ui/css";

@source "../../../packages/basalt-ui/src";
```

**Fix (Option 3):** Ensure workspace protocol:
```json
{
  "dependencies": {
    "basalt-ui": "workspace:*"
  }
}
```

## Next Steps

After installation:
- Explore [Typography](/docs/typography) for content styling
- Review [Color System](/docs/colors) for theming
- Check [Spacing](/docs/spacing) for layout utilities

## Getting Help

- [GitHub Issues](https://github.com/jkrumm/basalt-ui/issues)
- [Documentation](https://basalt-ui.com?utm_source=installation_docs)
