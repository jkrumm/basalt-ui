# Basalt UI

[![npm version](https://img.shields.io/npm/v/basalt-ui.svg)](https://www.npmjs.com/package/basalt-ui)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/jkrumm/basalt-ui/blob/master/LICENSE)

> Design system for the modern stack. One Tailwind theme that makes your components, docs, and charts look like they belong together.

**[Documentation](https://basalt-ui.com?utm_source=basalt_ui_readme)** · **[GitHub](https://github.com/jkrumm/basalt-ui)** · **[npm](https://www.npmjs.com/package/basalt-ui)**

Building modern apps often means combining ShadCN components, Starlight docs, Tremor dashboards, and more — each with its own styling.

Basalt UI is a single Tailwind CSS theme that brings them all together. Import once, get consistent design everywhere. More integrations are on the way.

### Why Basalt UI?

Most teams don't use just one UI tool anymore.

You combine component libraries, documentation frameworks, and charting tools — and they rarely look like they belong together.

Basalt UI solves this with a single Tailwind configuration that works across your stack.

No rewrites. No heavy abstractions. Just consistent design, everywhere.

### What Basalt UI gives you

- **One Tailwind theme** shared across apps, docs, and dashboards
- **Zero configuration** - just import one CSS file
- **Self-hosted fonts** bundled automatically (Instrument Sans Variable, JetBrains Mono Variable)
- **Out-of-the-box support** for ShadCN, Starlight, and Tremor
- **Matching light and dark modes** by default
- **Framework-agnostic** - works with Next.js, Vite, Astro, and more
- **No config file needed** - uses Tailwind v4's CSS-first approach

More integrations will be added over time.

---

## Quick Start

### Installation

**Step 1: Install basalt-ui and peer dependencies**

```bash
# Using Bun
bun add basalt-ui
bun add -D @tailwindcss/typography shadcn tw-animate-css

# Using npm
npm install basalt-ui
npm install -D @tailwindcss/typography shadcn tw-animate-css

# Using pnpm
pnpm add basalt-ui
pnpm add -D @tailwindcss/typography shadcn tw-animate-css
```

**Step 2: Import the CSS**

```css
/* src/styles/globals.css or app/globals.css */
@import "basalt-ui/css";
```

**⚠️ Important:** Use `basalt-ui/css`, not `basalt-ui` or `basalt-ui/src/index.css`

**Step 3: Add dark mode support**

```html
<html class="dark">
  <!-- Your app -->
</html>
```

**📖 Complete Guide:** For framework-specific setup (Vite, Next.js, Astro), troubleshooting, font loading details, and advanced integration patterns, see the **[Installation Documentation](https://basalt-ui.com/docs/installation?utm_source=basalt_ui_readme)**.

---

## Usage Examples

**Content areas** - Use `.prose` for automatic semantic styling:

```html
<article class="prose">
  <h2>Section Title</h2>
  <p>This paragraph looks great with <a href="#">automatic styling</a>.</p>
  <code>inline code</code> and <pre><code>code blocks</code></pre>
</article>
```

**UI components** - Use defined utilities (no global conflicts):

```html
<div class="p-4 bg-card text-foreground rounded-lg shadow">
  <h3 class="text-h3 font-bold">Card Title</h3>
  <p class="text-muted-foreground">Card content</p>
</div>
```

---

## How It Works

### Package Exports

Basalt UI exports CSS files only (no config needed):

```json
{
  "exports": {
    "./css": "./src/index.css",        // Main design system
    "./starlight": "./src/starlight.css"  // Starlight docs integration
  }
}
```

**What you get:**
- Complete Tailwind v4 theme via `@theme inline` CSS
- Self-hosted variable fonts (bundled automatically)
- CSS variables for light/dark modes
- Typography plugin configuration
- Animation utilities

**What you DON'T need:**
- ❌ No `tailwind.config.js` file
- ❌ No manual font setup
- ❌ No theme configuration
- ❌ No PostCSS config

### Dependencies

**Peer Dependencies** (you install):
- `tailwindcss` v4+ - Core CSS framework
- `@tailwindcss/typography` - Powers `.prose` class
- `shadcn` - Component CLI tool
- `tw-animate-css` - Animation utilities

**Direct Dependencies** (bundled):
- `@fontsource-variable/instrument-sans` - Heading and body font
- `@fontsource-variable/jetbrains-mono` - Monospace font

**Why peer dependencies?**
- Prevents version conflicts across your project
- You control which versions to use
- Reduces duplicate packages in node_modules
- Standard practice for plugin ecosystems

---

## Framework & Library Compatibility

Basalt UI works seamlessly with:

- ✅ **Next.js** - App Router with Tailwind v4
- ✅ **Vite** - React, Vue, Svelte, Solid
- ✅ **Astro** - Static sites and SSR
- ✅ **ShadCN UI** - All components work out of the box
- ✅ **Tremor** - Charts and dashboards
- ✅ **Starlight** - Documentation framework

See the **[Installation Guide](https://basalt-ui.com/docs/installation?utm_source=basalt_ui_readme)** for framework-specific setup examples and integration details.

---

## The Basalt UI Difference

### Before (Standard Tailwind)

```html
<!-- Arbitrary values everywhere -->
<div class="text-[17px] p-[13px] bg-[#f3f3f3]">
  <!-- Components conflict with global styles -->
  <h2>Heading</h2>  <!-- Styled globally -->
  <Table>...</Table>  <!-- Inherits unwanted styles -->
</div>
```

**Problems:**
- Arbitrary values lead to inconsistency
- Global semantic HTML styles conflict with component libraries
- Tremor/ShadCN components inherit unwanted styles

### After (Basalt UI)

```html
<!-- Defined tokens only -->
<div class="text-body p-4 bg-card">
  <!-- Content areas: Use .prose -->
  <article class="prose">
    <h2>Heading</h2>  <!-- Styled within .prose -->
  </article>

  <!-- Components: Clean, no conflicts -->
  <Table>...</Table>  <!-- Works perfectly -->
</div>
```

**Benefits:**
- Consistent, predictable design tokens
- `.prose` for content, clean components for UI
- No conflicts with ShadCN/Tremor
- Design system enforces consistency

---

## Why "Basalt UI"?

Basalt is a volcanic rock formed from cooled lava. It's:
- **Strong and foundational** - Like a mature design system
- **Natural and earthy** - Inspiring the zinc + nature accent palette
- **Structured but organic** - Restrictive yet beautiful

The design system embodies this aesthetic: professional structure with warm, natural character.

---

## Requirements

### Peer Dependencies (Required)
- **Tailwind CSS v4+** - Core CSS framework (uses `@theme inline` syntax)
- **@tailwindcss/typography v0.5+** - Typography plugin for `.prose` class
- **tw-animate-css v1.4+** - Animation utilities
- **shadcn v3.8+** - Component utilities

All peer dependencies must be installed in your project.

### Browser Support
- Modern browsers with OKLCH support (Chrome 111+, Edge 111+, Safari 16.4+, Firefox 113+)

---

## Contributing

Basalt UI is **opinionated by design**. Contributions should:

1. Maintain restrictive philosophy
2. Use OKLCH for all colors
3. Preserve semantic HTML defaults
4. Follow volcanic nature aesthetic
5. Document changes in CLAUDE.md

Open an issue before major changes to discuss alignment with project philosophy.

---

## License

Apache 2.0 License - Use freely, modify as needed, keep attribution.

---

**Built with intention. Designed for consistency. Inspired by nature.**

🌋 Basalt UI - Where volcanic aesthetics meet modern design systems.
