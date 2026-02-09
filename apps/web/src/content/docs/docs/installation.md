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

⚠️ **Important:** Use `basalt-ui/css`, not `basalt-ui` or `basalt-ui/src/index.css`

**What this imports:**
- Complete Tailwind v4 theme (`@theme inline` CSS)
- Self-hosted variable fonts (Instrument Sans Variable, JetBrains Mono Variable)
- CSS variables for light/dark modes
- Typography plugin configuration
- Animation utilities

**What you DON'T need:**
- No `tailwind.config.js` file required
- No manual font setup
- No PostCSS configuration

### Step 3: Add Dark Mode

Add the `dark` class to your HTML element:

```html
<html class="dark">
  <!-- Your app -->
</html>
```

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

**3. Import CSS in entry file:**
```typescript
// src/main.tsx
import './styles/globals.css';
```

**4. Create globals.css:**
```css
/* src/styles/globals.css */
@import "basalt-ui/css";
```

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

Basalt UI includes self-hosted variable fonts by default (Instrument Sans Variable and JetBrains Mono Variable). **No additional setup needed.**

**Fonts load automatically when you import basalt-ui CSS:**

```css
/* src/styles/global.css */
@import "basalt-ui/css";  /* Includes fonts, no separate import needed */
```

**Why self-hosted?**
- Privacy: No external CDN requests
- Performance: Fonts served from your domain (faster, no DNS lookup)
- Reliability: No dependency on Google Fonts availability
- Control: Font files bundled with your app

**Opinionated by design:**

Basalt UI uses Instrument Sans Variable and JetBrains Mono Variable as non-negotiable defaults. This ensures consistency across all integrations (ShadCN, Starlight, Tremor) and eliminates decision fatigue.

**If you need different fonts:** Fork the package and modify the font imports in `src/index.css`, or override the CSS variables (breaks consistency with Basalt UI philosophy).

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

### Self-Hosted Variable Fonts

Basalt UI includes two self-hosted variable fonts:

**Instrument Sans Variable** - Headings and body text
- Full variable font with weight axis (400-700)
- Optimized for UI and content
- Clean, modern sans-serif

**JetBrains Mono Variable** - Code blocks and monospace
- Full variable font with weight axis (400)
- Designed for programming
- Excellent readability

**Font stack:**

```css
--font-heading: "Instrument Sans Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-body: "Instrument Sans Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-mono: "JetBrains Mono Variable", "Menlo", "Monaco", "Courier New", monospace;
```

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
1. Verify `basalt-ui/css` is imported (fonts are included)
2. Check browser DevTools Network tab for font requests
3. Look for `InstrumentSans-Variable.woff2` and `JetBrainsMono-Variable.woff2`
4. Ensure no Content Security Policy blocking fonts

**Note:** Fonts are bundled automatically - no additional setup needed!

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

**Toggle dark mode:**
```javascript
// Toggle
document.documentElement.classList.toggle('dark');

// Enable
document.documentElement.classList.add('dark');

// Disable
document.documentElement.classList.remove('dark');
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
- [Documentation](https://basalt-ui.com)
