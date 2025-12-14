# Basalt UI

[![npm version](https://img.shields.io/npm/v/basalt-ui.svg)](https://www.npmjs.com/package/basalt-ui)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](https://github.com/jkrumm/basalt-ui/blob/master/LICENSE)

> Design system for the modern stack. One Tailwind theme that makes your components, docs, and charts look like they belong together.

**[Documentation](https://basalt-ui.com)** · **[GitHub](https://github.com/jkrumm/basalt-ui)** · **[npm](https://www.npmjs.com/package/basalt-ui)**

Building modern apps often means combining ShadCN components, Starlight docs, Tremor dashboards, and more — each with its own styling.

Basalt UI is a single Tailwind CSS theme that brings them all together. Import once, get consistent design everywhere. More integrations are on the way.

### Why Basalt UI?

Most teams don't use just one UI tool anymore.

You combine component libraries, documentation frameworks, and charting tools — and they rarely look like they belong together.

Basalt UI solves this with a single Tailwind configuration that works across your stack.

No rewrites. No heavy abstractions. Just consistent design, everywhere.

### What Basalt UI gives you

- One Tailwind theme shared across apps, docs, and dashboards
- Out-of-the-box support for ShadCN, Starlight, and Tremor
- Matching light and dark modes by default
- A consistent look without custom glue code

More integrations will be added over time.

---

## Quick Start

### Installation

```bash
bun add basalt-ui
# or
npm install basalt-ui
```

### Setup

Import the CSS in your main file:

```css
/* src/index.css or app/globals.css */
@import "basalt-ui";
```

Add dark mode support to your HTML:

```html
<html class="dark">
  <!-- Your app -->
</html>
```

### Use It

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

## The Basalt UI Difference

### Before (Standard Tailwind + Global Styles)

```html
<!-- Global styles conflict with components -->
<article>
  <h2>Section Title</h2>              <!-- Always styled globally -->
  <Table>                             <!-- Inherits global table styles -->
    <TableHeader>...</TableHeader>    <!-- Styling conflicts! -->
  </Table>
</article>
```

**Problems:**
- Global semantic HTML styles conflict with component libraries
- Arbitrary values everywhere (`text-[17px]`, `p-[13px]`)
- Tremor/ShadCN components inherit unwanted styles
- Inconsistent spacing and sizing

### After (Basalt UI)

```html
<!-- Content areas: Use .prose -->
<article class="prose">
  <h2>Section Title</h2>              <!-- Styled within .prose -->
  <p>Perfect typography...</p>
</article>

<!-- Components: Clean, no conflicts -->
<Table>                               <!-- No inherited styles -->
  <TableHeader>...</TableHeader>      <!-- Works perfectly -->
</Table>

<!-- Custom UI: Defined tokens -->
<div class="p-4 rounded-md">
  <p class="text-h3">Use semantic sizes</p>
</div>
```

**Benefits:**
- `.prose` for content, clean components for UI
- No conflicts with ShadCN/Tremor
- Consistent, predictable tokens only
- Design system enforces consistency

---

## Color System

### Foundation Palette Architecture

Basalt UI uses a **three-layer color system** inspired by Nord's architecture:

**1. Foundation Palette** → Core OKLCH values defined once
**2. Semantic Tokens** → Meaningful names that reference foundation
**3. UI Utilities** → Tailwind classes that use semantic tokens

This DRY approach means changing `--light-2` once updates the background across your entire light mode.

#### Light Tones
Light mode backgrounds, dark mode text, elevated surfaces:

```css
light-1  /* oklch(0.99 0.002 90) - Brightest (cards, popovers) */
light-2  /* oklch(0.985 0.002 90) - Main background (light mode) */
light-3  /* oklch(0.96 0.004 270) - Muted backgrounds */
light-4  /* oklch(0.93 0.005 270) - Borders, inputs */
```

#### Dark Tones
Dark mode backgrounds, light mode text:

```css
dark-1   /* oklch(0.195 0.012 285) - Near-black (reserved) */
dark-2   /* oklch(0.24 0.012 285) - Main background (dark mode) */
dark-3   /* oklch(0.26 0.012 285) - Cards (dark mode) */
dark-4   /* oklch(0.31 0.012 285) - Borders, muted (dark mode) */
```

#### Text Tones
Subdued text for secondary information:

```css
text-subdued-light  /* oklch(0.5 0.014 285) - Muted text (light mode) */
text-subdued-dark   /* oklch(0.8 0.012 285) - Muted text (dark mode) */
```

#### Extreme Tones
High contrast text:

```css
white    /* oklch(0.99 0.002 90) - Text on dark backgrounds */
```

### Semantic Tokens (Reference Foundation)

Semantic tokens provide meaningful names and reference the foundation palette:

```css
/* Light Mode */
background   /* var(--light-2) - Main background */
foreground   /* var(--dark-4) - Primary text */
card         /* var(--light-1) - Elevated surfaces */
muted        /* var(--light-3) - Subtle backgrounds */
border       /* var(--light-4) - Borders, dividers */
muted-foreground  /* var(--text-subdued-light) - Secondary text */

/* Dark Mode */
background   /* var(--dark-2) - Main background */
foreground   /* var(--light-3) - Soft white */
card         /* var(--dark-3) - Elevated surfaces */
muted        /* var(--dark-4) - Subtle backgrounds */
border       /* var(--dark-4) - Borders, dividers */
muted-foreground  /* var(--text-subdued-dark) - Secondary text */
```

**Why this matters:** Change `--light-2` once → updates background across light mode everywhere.

#### Blue Primary

Professional, trustworthy accent for interactive elements:

```css
blue        /* oklch(0.6965 0.0591 248.69) - Primary blue */
blue-foreground  /* oklch(0.99 0.002 90) - White text on blue */

blue-light  /* oklch(0.78 0.045 249) - Hover states */
blue-light-foreground  /* oklch(0.265 0.015 285) - Dark text on blue-light */

blue-deep   /* oklch(0.5944 0.0772 254.03) - Strong emphasis */
blue-deep-foreground  /* oklch(0.99 0.002 90) - White text on blue-deep */
```

#### Expressive Colors

Expressive, semantic colors for errors, warnings, success, and special states:

```css
red         /* oklch(0.6061 0.1206 15.34) - Errors, destructive actions */
red-foreground  /* oklch(0.99 0.002 90) - White text on red */

orange      /* oklch(0.6929 0.0963 38.24) - Warnings, annotations */
orange-foreground  /* oklch(0.265 0.015 285) - Dark text on orange */

yellow      /* oklch(0.8549 0.0892 84.09) - Caution, highlights */
yellow-foreground  /* oklch(0.265 0.015 285) - Dark text on yellow */

green       /* oklch(0.7683 0.0749 131.06) - Success, confirmations */
green-foreground  /* oklch(0.265 0.015 285) - Dark text on green */

purple      /* oklch(0.6921 0.0625 332.66) - Special features */
purple-foreground  /* oklch(0.99 0.002 90) - White text on purple */
```

#### Sequential Chart Palette

8 blue tones for data visualization with perceptual uniformity:

```css
chart-blue-1  /* oklch(0.90 0.030 249) - Lightest */
chart-blue-2  /* oklch(0.80 0.040 249) */
chart-blue-3  /* oklch(0.72 0.050 249) */
chart-blue-4  /* oklch(0.65 0.059 249) */
chart-blue-5  /* oklch(0.58 0.065 249) */
chart-blue-6  /* oklch(0.50 0.070 249) */
chart-blue-7  /* oklch(0.42 0.075 249) */
chart-blue-8  /* oklch(0.34 0.077 249) - Darkest */
```

Progressive lightness with gradually increasing chroma for perceptual uniformity. All adjacent colors exceed WCAG 3:1 contrast requirements.

### Why OKLCH?

**HSL Problems:**
```css
/* HSL: uneven perceived brightness */
background: hsl(0, 0%, 50%);
primary: hsl(120, 50%, 50%);
/* These look completely different brightness! */
```

**OKLCH Solution:**
```css
/* OKLCH: perceptually uniform */
background: oklch(0.50 0 0);
primary: oklch(0.50 0.10 135);
/* These look similar brightness ✓ */
```

Changes in L (lightness) and C (chroma) values match what your eyes perceive. No surprise gray zones in gradients.

---

## Typography

### Opt-In with `.prose`

Basalt UI uses the official `@tailwindcss/typography` plugin configured with Basalt design tokens.

**Content areas** (blog posts, articles, documentation):
```html
<article class="prose">
  <h1>Primary Heading</h1>
  <h2>Section Header</h2>
  <p>Automatically styled paragraphs with <a href="#">links</a>.</p>
  <code>inline code</code>
  <pre><code>code blocks</code></pre>
</article>
```

**Component libraries** (ShadCN, Tremor, app UI):
```html
<!-- No .prose class - components style themselves -->
<Table>...</Table>
<Button>Click Me</Button>
<nav><a href="#">Link</a></nav>
```

### Why Not Global Styling?

Global semantic HTML defaults conflict with component libraries:
- Tremor Table expects unstyled `<table>` elements
- ShadCN Button shouldn't inherit link `<a>` styles
- Navigation links don't want automatic blue underlines

### Automatic Dark Mode

The `.prose` class uses Basalt CSS variables, so **no `dark:prose-invert` needed**:

```html
<body class="dark">
  <article class="prose">
    <!-- Text colors switch automatically -->
  </article>
</body>
```

### Font Stack (Variable Fonts)

- **Instrument Sans Variable** (all text) - Modern geometric sans with variable width axis (wdth), all weights 400-700, ligatures & kerning enabled
- **JetBrains Mono Variable** (code) - All weights 400-700, code ligatures (!=, <=, =>)

**Width utilities:**
- `.font-condensed` (85% width) - Tight, data-focused
- `.font-wide` (110% width) - Spacious, friendly

### Utility Classes

For custom layouts outside `.prose`:

```html
<div class="text-display">Hero Text (64px)</div>
<div class="text-hero">Subhero (48px)</div>
<h2 class="text-h2">Manual heading (32px)</h2>
<span class="text-small">Metadata (14px)</span>
<span class="text-caption">Fine print (12px)</span>
```

**No arbitrary values:**
- ✅ `text-h2`, `text-body`, `text-small`
- ❌ `text-lg`, `text-xl`, `text-[17px]`

---

## Spacing System

Based on 4px increments, limited to purposeful values:

```
p-0   (0px)     p-1  (4px)     p-2  (8px)     p-3  (12px)
p-4   (16px)    p-5  (20px)    p-6  (24px)    p-8  (32px)
p-10  (40px)    p-12 (48px)    p-16 (64px)    p-20 (80px)
p-24  (96px)    p-32 (128px)
```

**What's missing?** `p-7`, `p-9`, `p-11`, `p-13-15`, `p-17-19`, etc.

**Why?** Force consistency. If you need a spacing value that's not defined, it's probably inconsistent with the design system.

---

## Restrictions

Basalt UI is **opinionated**. It disables arbitrary values and infinite scales.

### What Works ✅

```html
<!-- Content areas with .prose -->
<article class="prose">
  <h2>Section Title</h2>
  <p>Automatically styled</p>
</article>

<!-- Defined tokens -->
<div class="p-4 text-body font-bold bg-primary">

<!-- ShadCN/Tremor components (no conflicts) -->
<Button variant="default">Click Me</Button>
<Table>...</Table>
```

### What Doesn't Work ❌

```html
<!-- Arbitrary values (disabled) -->
<div class="p-[13px]">           ❌
<div class="text-[17px]">        ❌
<div class="bg-[#f3f3f3]">       ❌

<!-- Undefined utilities -->
<div class="p-7">                ❌ (use p-6 or p-8)
<div class="text-lg">            ❌ (use text-h4 or text-small)
<div class="font-light">         ❌ (use font-regular, font-medium, font-semibold, or font-bold)
```

This is **intentional**. Consistency > flexibility.

---

## Component Library Compatibility

### ShadCN UI

Basalt UI works seamlessly with ShadCN UI. All required tokens are defined:

```bash
# Install ShadCN
npx shadcn@latest init

# Choose "Zinc" as base color
# ShadCN components will use Basalt UI's volcanic palette
```

Components automatically use:
- Basalt color tokens
- Restricted spacing scale
- Semantic typography
- Defined border radius

### Tremor Raw

Basalt UI includes **full compatibility** with [Tremor Raw](https://tremor.so) chart components through automatic gray palette overrides:

```tsx
import { AreaChart } from '@tremor/react';

<AreaChart
  data={chartData}
  index="date"
  categories={['sales']}
  colors={['blue']}  // Uses Basalt UI's OKLCH blue
/>
```

**How it works:**
- Basalt overrides Tailwind's default gray scale (`white`, `black`, `gray-50` through `gray-950`)
- Tremor's hardcoded classes (`bg-white`, `text-gray-500`, `dark:bg-gray-950`) automatically use Basalt colors
- No manual theme configuration needed in Tremor components

**Supported chart colors:**
- Named: `blue`, `red`, `emerald` (green), `amber` (yellow), `violet` (purple), `cyan`, `indigo`
- Sequential: `chart-blue-1` through `chart-blue-8` (lightness progression)
- Color shades: `blue-50` through `blue-950` for all chart colors

**Tremor semantic tokens:**
All Tremor tokens (`tremor-brand`, `tremor-background`, `tremor-content`, etc.) are mapped to Basalt's OKLCH foundation palette with proper light/dark mode support.

---

## Dark Mode

Toggle dark mode by adding/removing the `dark` class:

```html
<html class="dark">
  <!-- Dark mode active -->
</html>
```

All colors automatically adjust to warm, comfortable dark mode values.

**Light mode:** Warm whites, rich dark grays
**Dark mode:** Deep warm grays, soft whites

Both modes avoid stark extremes for comfortable, professional interfaces.

---

## Available Utilities

### Colors

```css
/* Foundation Palette */
bg-light-1, bg-light-2, bg-light-3, bg-light-4
bg-dark-1, bg-dark-2, bg-dark-3, bg-dark-4
text-white

/* Semantic Backgrounds */
bg-background, bg-card, bg-muted, bg-primary
bg-blue, bg-blue-light, bg-blue-deep
bg-red, bg-orange, bg-yellow, bg-green, bg-purple

/* Text (always pair with background) */
text-foreground, text-muted-foreground
text-primary-foreground, text-secondary-foreground
text-blue-foreground, text-blue-light-foreground, text-blue-deep-foreground
text-red-foreground, text-orange-foreground, text-yellow-foreground
text-green-foreground, text-purple-foreground

/* Borders */
border-border, border-input, border-primary

/* Focus rings */
ring-ring, ring-primary

/* Sequential Charts */
bg-chart-blue-1, bg-chart-blue-2, ... bg-chart-blue-8

/* Tailwind Gray Overrides (for Tremor compatibility) */
bg-white, bg-black
bg-gray-50, bg-gray-100, bg-gray-200, bg-gray-300
bg-gray-400, bg-gray-500, bg-gray-600, bg-gray-700
bg-gray-800, bg-gray-900, bg-gray-950
/* Automatically mapped to Basalt foundation palette */

/* Chart Color Shades (for Tremor charts) */
bg-blue-50 through bg-blue-950
bg-red-50 through bg-red-950
bg-emerald-50 through bg-emerald-950
bg-amber-50 through bg-amber-950
bg-violet-50 through bg-violet-950
bg-cyan-50 through bg-cyan-950
bg-indigo-50 through bg-indigo-950
```

### Typography

```css
/* Sizes (semantic) */
text-display, text-hero, text-h1, text-h2, text-h3, text-h4, text-h5, text-h6
text-body, text-small, text-caption

/* Families */
font-heading, font-body, font-mono

/* Weights (Variable fonts) */
font-regular, font-medium, font-semibold, font-bold

/* Width (Variable font wdth axis) */
font-condensed, font-wide

/* Letter spacing */
tracking-tight, tracking-normal, tracking-wide
```

### Spacing

```css
/* Padding/Margin */
p-0, p-1, p-2, p-3, p-4, p-5, p-6, p-8, p-10, p-12, p-16, p-20, p-24, p-32
m-0, m-1, m-2, m-3, m-4, m-5, m-6, m-8, m-10, m-12, m-16, m-20, m-24, m-32

/* Gap (flexbox/grid) */
gap-0, gap-1, gap-2, gap-3, gap-4, gap-5, gap-6, gap-8, gap-10, gap-12
```

### Border Radius

```css
rounded-none, rounded-sm, rounded-md, rounded, rounded-lg, rounded-xl, rounded-full
```

### Shadows

```css
shadow-sm, shadow, shadow-md, shadow-lg, shadow-xl
```

---

## Customization

Want to adjust colors for your brand? Fork and modify `src/index.css`:

```css
:root {
  /* Adjust OKLCH values */
  --primary: oklch(0.58 0.10 135);  /* Change hue/chroma/lightness */
  --destructive: oklch(0.58 0.18 35);
}

.dark {
  /* Adjust dark mode */
  --primary: oklch(0.68 0.11 135);  /* Lighter for dark backgrounds */
}
```

**Keep the philosophy:**
- Use OKLCH color space
- Maintain perceptual uniformity
- Preserve semantic HTML defaults
- Keep restrictions (no arbitrary values)

---

## Examples

### Card Component

```html
<div class="bg-card p-6 rounded-lg shadow">
  <h3 class="text-h3 font-bold">Card Title</h3>
  <p class="text-muted-foreground">Card description text.</p>
  <button class="bg-primary text-primary-foreground px-4 py-2 rounded">
    Action
  </button>
</div>
```

### Hero Section

```html
<header class="p-16 bg-background">
  <h1 class="text-display font-heading font-bold tracking-tight">
    Welcome to Your App
  </h1>
  <p class="text-h3 text-muted-foreground">
    Build something amazing with Basalt UI.
  </p>
</header>
```

### Alert Component

```html
<!-- Error alert with proper text pairing -->
<div class="bg-destructive text-destructive-foreground p-4 rounded">
  <h4 class="text-h4 font-bold">Error</h4>
  <p class="text-small">Something went wrong. Please try again.</p>
</div>

<!-- Success alert -->
<div class="bg-green text-green-foreground p-4 rounded">
  <h4 class="text-h4 font-bold">Success</h4>
  <p class="text-small">Your changes have been saved.</p>
</div>

<!-- Warning alert -->
<div class="bg-orange text-orange-foreground p-4 rounded">
  <h4 class="text-h4 font-bold">Warning</h4>
  <p class="text-small">Please review your input before continuing.</p>
</div>
```

---

## Why "Basalt UI"?

Basalt is a volcanic rock formed from cooled lava. It's:
- **Strong and foundational** - Like a mature design system
- **Natural and earthy** - Inspiring the zinc + nature accent palette
- **Structured but organic** - Restrictive yet beautiful

The design system embodies this aesthetic: professional structure with warm, natural character.

---

## Use Cases

Perfect for:
- 📊 **Dashboards** - Clean, data-focused interfaces
- 📝 **Content platforms** - Blogs, documentation, marketing sites
- 🛠️ **SaaS applications** - Professional, warm, accessible
- 🎨 **Design showcases** - Demonstrates thoughtful design system architecture

Not ideal for:
- 🎮 Gaming interfaces (too restrained)
- 🎨 Highly artistic sites (needs more flexibility)
- 🌈 Colorful, playful brands (neutral-focused palette)

---

## Requirements

- **Tailwind CSS v4+** (uses `@theme inline` syntax)
- Modern browser with OKLCH support (Chrome, Edge, Safari, Firefox 2023+)
- No additional dependencies

---

## Documentation

- [Full Design System Documentation](./CLAUDE.md) - Philosophy, architecture, guidelines
- [Web Showcase](../../apps/web) - Interactive examples and component gallery

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

MIT License - Use freely, modify as needed, keep attribution.

---

## Inspiration

- **Color Science**: OKLCH color space, Björn Ottosson's Oklab
- **Nord Theme**: Inspired by expressive color approach for syntax highlighting
- **Nature**: Volcanic landscapes, basalt formations, natural materials
- **Design Systems**: ShadCN UI, Radix Colors, Tailwind Zinc
- **Philosophy**: Restrictive design, semantic HTML, mature consistency

---

**Built with intention. Designed for consistency. Inspired by nature.**

🌋 Basalt UI - Where volcanic aesthetics meet modern design systems.
