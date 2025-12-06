# Basalt UI

> A mature, restrictive Tailwind CSS design system inspired by volcanic basalt.

**Volcanic aesthetics meet modern expressiveness.** Basalt UI combines warm zinc-based neutrals with expressive semantic colors and professional blue accents to create interfaces that are both trustworthy and expressive.

---

## Philosophy

Most design systems extend Tailwind infinitely. Basalt UI does the opposite - it **restricts** Tailwind to create consistency.

- ✨ **Semantic HTML works by default** - `<h2>` looks like a heading without utility classes
- 🎨 **OKLCH color space** - Perceptually uniform colors that feel natural
- 📐 **Limited, purposeful tokens** - No `text-[17px]` or `p-[13px]`, only defined values
- 🌋 **Basalt neutrals + expressive colors** - Warm zinc grays with semantic expressiveness
- 🎯 **Mature restrictions** - Opinionated design system that enforces consistency
- 🧩 **ShadCN compatible** - Works seamlessly with ShadCN UI components

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

Semantic HTML just works:

```html
<article>
  <h2>Section Title</h2>
  <p>This paragraph looks great without any classes.</p>
  <a href="#">Links are styled automatically</a>
</article>
```

Use defined utilities when needed:

```html
<div class="p-4 bg-card text-foreground rounded-lg shadow">
  <h3>Card Title</h3>
  <p class="text-muted-foreground">Card content</p>
</div>
```

---

## The Basalt UI Difference

### Before (Standard Tailwind)

```html
<!-- Infinite utilities, no consistency -->
<div class="text-lg font-semibold tracking-tight p-3 rounded-md">
  <p class="text-[17px] leading-[1.6]">Text with arbitrary values</p>
</div>
```

**Problems:**
- Arbitrary values everywhere (`text-[17px]`)
- No semantic meaning (`<div>` instead of `<h3>`)
- Inconsistent spacing and sizing
- Requires classes for basic styling

### After (Basalt UI)

```html
<!-- Semantic HTML with defined tokens -->
<article>
  <h3>Title is styled automatically</h3>
  <p>Body text looks great by default.</p>
</article>

<!-- When you need custom styling -->
<div class="p-4 rounded-md">
  <p class="text-small">Use defined semantic sizes</p>
</div>
```

**Benefits:**
- Semantic HTML styled by default
- Consistent, predictable tokens
- Cleaner, more maintainable code
- Design system enforces consistency

---

## Color System

### Foundation Palette

Basalt UI starts with a **foundation palette**—core neutral tones defined once and referenced everywhere. This ensures consistency and makes the system easy to maintain.

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
dark-1   /* oklch(0.24 0.012 285) - Main background (dark mode) */
dark-2   /* oklch(0.26 0.012 285) - Cards (dark mode) */
dark-3   /* oklch(0.30 0.013 285) - Muted/borders (dark mode) */
dark-4   /* oklch(0.265 0.015 285) - Primary text (light mode) */
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

/* Dark Mode */
background   /* var(--dark-1) - Main background */
card         /* var(--dark-2) - Elevated surfaces */
muted        /* var(--dark-3) - Subtle backgrounds */
border       /* var(--dark-3) - Borders, dividers */
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
chart-blue-1 through chart-blue-8  /* Light to dark progression */
```

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

### Font Stack

- **Headings**: Lato (700) - Modern, geometric, professional
- **Body**: Nunito Sans (400) - Rounded, friendly, readable
- **Mono**: JetBrains Mono (400) - Clear, developer-friendly

### Semantic Sizing

HTML elements are styled automatically:

```html
<h1>Primary Heading (40px)</h1>
<h2>Section Header (32px)</h2>
<h3>Subsection (24px)</h3>
<p>Body text (16px) - default</p>
```

Need custom sizes? Use semantic utilities:

```html
<div class="text-display">Hero Text (64px)</div>
<div class="text-hero">Subhero (48px)</div>
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
<!-- Defined tokens -->
<div class="p-4 text-body font-bold bg-primary">

<!-- Semantic HTML (styled automatically) -->
<h2>Section Title</h2>
<p>Body paragraph</p>

<!-- ShadCN components -->
<Button variant="default">Click Me</Button>
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
<div class="font-semibold">      ❌ (use font-regular or font-bold)
```

This is **intentional**. Consistency > flexibility.

---

## ShadCN Compatibility

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
text-dark-4, text-white

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

/* Charts */
bg-chart-blue-1, bg-chart-blue-2, ... bg-chart-blue-8
```

### Typography

```css
/* Sizes (semantic) */
text-display, text-hero, text-h1, text-h2, text-h3, text-h4, text-h5, text-h6
text-body, text-small, text-caption

/* Families */
font-heading, font-body, font-mono

/* Weights */
font-regular, font-bold

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
  <h3>Card Title</h3>
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
  <h4>Error</h4>
  <p class="text-small">Something went wrong. Please try again.</p>
</div>

<!-- Success alert -->
<div class="bg-green text-green-foreground p-4 rounded">
  <h4>Success</h4>
  <p class="text-small">Your changes have been saved.</p>
</div>

<!-- Warning alert -->
<div class="bg-orange text-orange-foreground p-4 rounded">
  <h4>Warning</h4>
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
