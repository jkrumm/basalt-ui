# Basalt UI Setup Guide

Complete setup guide for integrating Basalt UI into your project, including common pitfalls and solutions.

## Prerequisites

Before starting, ensure you have:
- **Tailwind CSS v4+** installed
- **Node.js 18+** or **Bun 1.0+**
- A supported bundler (Vite, Next.js, Astro, etc.)

---

## Installation Steps

### 1. Install Basalt UI

```bash
# Using Bun (recommended)
bun add basalt-ui

# Using npm
npm install basalt-ui

# Using pnpm
pnpm add basalt-ui
```

### 2. Install Peer Dependencies

**All peer dependencies are required** - the CSS imports them directly.

```bash
# Using Bun
bun add -D @tailwindcss/typography shadcn tw-animate-css

# Using npm
npm install -D @tailwindcss/typography shadcn tw-animate-css

# Using pnpm
pnpm add -D @tailwindcss/typography shadcn tw-animate-css
```

**Why these are needed:**
- `@tailwindcss/typography` - Used by `@plugin` directive for `.prose` class
- `tw-animate-css` - Imported by `@import "tw-animate-css"`
- `shadcn` - Imported by `@import "shadcn/tailwind.css"`

### 3. Import Basalt UI CSS

**⚠️ Critical:** Use the correct import path `basalt-ui/css`

```css
/* src/styles/globals.css (or your main CSS file) */
@import "basalt-ui/css";
```

**Common mistakes:**
```css
/* ❌ Wrong - will not work */
@import "basalt-ui";
@import "basalt-ui/src/index.css";
@import "basalt-ui/index.css";

/* ✅ Correct - only this works */
@import "basalt-ui/css";
```

---

## Framework-Specific Setup

### Vite (React, Vue, Svelte, Solid)

**1. Install Tailwind Vite plugin:**
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
    tailwindcss(), // ⚠️ Must come BEFORE framework plugin
    react(),
  ],
});
```

**3. Create globals.css:**
```css
/* src/styles/globals.css */
@import "basalt-ui/css";
```

**4. Import in entry point:**
```typescript
// src/main.tsx
import './styles/globals.css';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

**5. Add dark mode class to HTML:**
```html
<!-- index.html -->
<html class="dark">
  <body>
    <div id="root"></div>
  </body>
</html>
```

---

### Next.js (App Router)

**1. Create globals.css:**
```css
/* app/globals.css */
@import "basalt-ui/css";
```

**2. Import in root layout:**
```typescript
// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your App',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
```

**Note:** Next.js 15+ with App Router supports Tailwind v4 CSS imports natively - no additional config needed.

---

### Astro

**1. Install Tailwind integration:**
```bash
bun add -D @astrojs/tailwind
```

**2. Configure Astro:**
```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [
    tailwind({
      // Let Tailwind handle CSS processing
      applyBaseStyles: false,
    }),
  ],
});
```

**3. Create global CSS:**
```css
/* src/styles/global.css */
@import "basalt-ui/css";
```

**4. Import in base layout:**
```astro
---
// src/layouts/Layout.astro
import '../styles/global.css';

interface Props {
  title: string;
}

const { title } = Astro.props;
---
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width" />
    <title>{title}</title>
  </head>
  <body>
    <slot />
  </body>
</html>
```

---

## Verification

After setup, verify everything works:

### 1. Check Build Output

```bash
# Development
bun run dev
# or
npm run dev

# Production build
bun run build
# or
npm run build
```

**Look for:**
- ✅ No CSS import errors
- ✅ Tailwind classes are applied
- ✅ Dark mode switches correctly

### 2. Test Basic Styling

Create a test component:

```html
<div class="p-4 bg-card text-foreground rounded-lg shadow">
  <h2 class="text-h2 font-bold">Test Card</h2>
  <p class="text-muted-foreground">If you see styled text, it works!</p>
  <button class="bg-primary text-primary-foreground px-4 py-2 rounded">
    Click Me
  </button>
</div>
```

**Expected result:**
- Card with subtle background and shadow
- Bold heading with proper size
- Muted text color for description
- Blue button with white text

---

## Common Issues & Solutions

### Issue: `"./css" is not exported under the condition "style"`

**Symptom:** Build fails with export condition error

**Cause:** Older basalt-ui version missing `"style"` export condition (required by Tailwind v4 Vite plugin)

**Solution:**
```bash
bun update basalt-ui
# or
npm update basalt-ui
```

Verify package.json exports include:
```json
{
  "exports": {
    "./css": {
      "style": "./src/index.css",
      "import": "./src/index.css"
    }
  }
}
```

---

### Issue: `Can't resolve '@tailwindcss/typography'`

**Symptom:** Build fails when importing basalt-ui CSS

**Cause:** Peer dependencies not installed

**Solution:**
```bash
bun add -D @tailwindcss/typography shadcn tw-animate-css
```

**Why this happens:** basalt-ui's CSS directly imports these packages:
```css
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@plugin "@tailwindcss/typography";
```

When basalt-ui is installed, devDependencies aren't included - only peerDependencies. Your project must provide them.

---

### Issue: `Cannot find module 'basalt-ui'`

**Symptom:** Import error when building

**Cause:** Using incorrect import path

**Solution:** Change import to use exported path:
```css
/* ❌ Wrong */
@import "basalt-ui";

/* ✅ Correct */
@import "basalt-ui/css";
```

**Technical explanation:** The package.json exports field defines available paths:
```json
{
  "exports": {
    "./css": "./src/index.css",
    "./starlight": "./src/starlight.css"
  }
}
```

Only `/css` and `/starlight` are exported - not the package root.

---

### Issue: Styles not applying

**Symptom:** Components look unstyled, Tailwind classes don't work

**Possible causes & solutions:**

**1. CSS not imported in entry point**
```typescript
// Make sure this line exists in your main file
import './styles/globals.css';
```

**2. Vite plugin order incorrect**
```typescript
// ❌ Wrong - framework plugin first
plugins: [react(), tailwindcss()]

// ✅ Correct - Tailwind first
plugins: [tailwindcss(), react()]
```

**3. Missing Tailwind plugin (Vite projects)**
```bash
bun add -D @tailwindcss/vite
```

**4. CSS import path incorrect**
```css
/* Check your import */
@import "basalt-ui/css"; /* Must be exactly this */
```

**5. Browser doesn't support OKLCH**
- Update to Chrome 111+, Safari 15.4+, Firefox 113+
- OKLCH is required for color system

---

### Issue: Dark mode not working

**Symptom:** Colors don't change when toggling dark mode

**Solution 1:** Add `dark` class to `<html>`:
```html
<html class="dark">
  <!-- Your app -->
</html>
```

**Solution 2:** Toggle dynamically with JavaScript:
```typescript
// Toggle dark mode
document.documentElement.classList.toggle('dark');

// Set explicitly
document.documentElement.classList.add('dark');
document.documentElement.classList.remove('dark');
```

**Note:** Basalt uses `.dark` class strategy, NOT `prefers-color-scheme` media query.

---

### Issue: `.prose` class not working

**Symptom:** Content inside `.prose` looks unstyled

**Cause:** `@tailwindcss/typography` plugin not installed

**Solution:**
```bash
bun add -D @tailwindcss/typography
```

**Verify it's working:**
```html
<article class="prose">
  <h2>Heading</h2>
  <p>This should have nice typography styles.</p>
  <a href="#">This link should be styled blue</a>
</article>
```

---

## Package.json Example

For reference, here's a complete package.json for a Vite React project:

```json
{
  "name": "my-app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "basalt-ui": "^0.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/typography": "^0.5.19",
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "shadcn": "^3.6.0",
    "tailwindcss": "^4.0.0",
    "tw-animate-css": "^1.4.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

---

## Next Steps

Once setup is complete:

1. **Install ShadCN components:** [ShadCN UI Docs](https://ui.shadcn.com)
   ```bash
   bunx --bun shadcn@latest add button card input
   ```

2. **Add Tremor charts:** [Tremor Raw Docs](https://tremor.so)
   ```bash
   bun add @tremor/react
   ```

3. **Read the full documentation:** See [README.md](./README.md) for:
   - Color system architecture
   - Typography utilities
   - Component examples
   - Customization guide

---

## Getting Help

If you encounter issues not covered here:

1. Check [GitHub Issues](https://github.com/jkrumm/basalt-ui/issues)
2. Open a new issue with:
   - Your package.json
   - Build/bundler config
   - Error messages
   - Framework & versions

---

**Built with intention. Designed for consistency. Inspired by nature.**

🌋 Basalt UI
