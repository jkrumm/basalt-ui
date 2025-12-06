# Basalt UI - Design System Package

**Inherits from**: `../../CLAUDE.md` (monorepo conventions)
**This file defines**: Design system philosophy, color system, restrictions, and token architecture

A mature, restrictive Tailwind CSS design system inspired by volcanic basalt stone and natural aesthetics.

## Design Philosophy

### Core Principles

1. **Semantic HTML First**: h2 elements look like headings without utility classes
2. **Restrictive by Design**: No infinite scales - only purposeful, defined tokens
3. **OKLCH Color Space**: Perceptually uniform colors for accessible, harmonious palettes
4. **Warm, Not Stark**: Professional but welcoming - never pure black/white
5. **Natural Aesthetics**: Basalt stone zinc neutrals with professional blue accents and expressive Aurora colors

### What We **DO**

- ✅ Define limited, purposeful design tokens
- ✅ Style semantic HTML elements by default
- ✅ Use OKLCH for perceptual color uniformity
- ✅ Restrict Tailwind scales to prevent arbitrary values
- ✅ Maintain full ShadCN compatibility
- ✅ Create warm, professional, accessible interfaces
- ✅ Support volcanic nature aesthetic (zinc + blue + Aurora colors)

### What We **DON'T DO**

- ❌ Infinite utility scales (no `text-[17px]`, no `p-[13px]`)
- ❌ Arbitrary color values (no `bg-[#f3f3f3]`)
- ❌ Stark black/white (warm grays instead)
- ❌ Extend Tailwind - we **replace** and **restrict** it
- ❌ Require utility classes for semantic HTML
- ❌ HSL/RGB colors (OKLCH only for consistency)
- ❌ Premature abstractions or over-engineering

## Color System

### OKLCH: Perceptually Uniform Colors

**Why OKLCH:**
- L (Lightness): Changes correspond to perceived brightness
- C (Chroma): Saturation that matches human perception
- H (Hue): Color angle (0-360)
- Gradients stay clean, no unexpected gray zones
- Accessible contrast by design
- Supported in all modern browsers (2025)

### Color Palette Architecture

**Basalt Foundation (Zinc-based Neutrals):**
```
Light Mode:
- background: oklch(0.985 0.002 90)  - Almost white, warm
- foreground: oklch(0.265 0.015 285) - Rich dark gray (not black)
- muted: oklch(0.935 0.005 270)      - Light gray backgrounds
- border: oklch(0.875 0.005 270)     - Subtle borders

Dark Mode:
- background: oklch(0.195 0.012 285) - Warm dark gray (not black)
- foreground: oklch(0.935 0.005 90)  - Soft white (not harsh)
- muted: oklch(0.290 0.015 285)      - Dark gray backgrounds
- border: oklch(0.320 0.015 285)     - Visible borders
```

**Blue Primary (Nord Frost):**
```
Blue (Primary Accent):
- Value: oklch(0.6965 0.0591 248.69)  - Nord #81a1c1
- Same for light and dark modes
- Usage: Primary actions, links, focus rings, interactive elements

Blue Variants:
- blue:       oklch(0.6965 0.0591 248.69)  - Primary accent
- blue-light: oklch(0.78 0.045 249)         - Hover states, highlights
- blue-deep:  oklch(0.5944 0.0772 254.03)   - Strong emphasis (Nord #5e81ac)
```

**Aurora Colors (Nord Aurora):**
```
Direct adoption of Nord's Aurora palette - same values for light and dark modes

Red:    oklch(0.6061 0.1206 15.34)  - Nord #bf616a - Errors, destructive actions
Orange: oklch(0.6929 0.0963 38.24)  - Nord #d08770 - Annotations, warnings
Yellow: oklch(0.8549 0.0892 84.09)  - Nord #ebcb8b - Caution, highlights
Green:  oklch(0.7683 0.0749 131.06) - Nord #a3be8c - Success, confirmations
Purple: oklch(0.6921 0.0625 332.66) - Nord #b48ead - Special features, unique identifiers
```

**Sequential Chart Palette:**
```
8 blue tones for data visualization (Nord blue hue ~249°)

chart-blue-1: oklch(0.90 0.030 249) - Lightest
chart-blue-2: oklch(0.80 0.040 249)
chart-blue-3: oklch(0.72 0.050 249)
chart-blue-4: oklch(0.65 0.059 249)
chart-blue-5: oklch(0.58 0.065 249)
chart-blue-6: oklch(0.50 0.070 249)
chart-blue-7: oklch(0.42 0.075 249)
chart-blue-8: oklch(0.34 0.077 249) - Darkest

Progressive lightness and gradually increasing chroma for perceptual uniformity
All adjacent colors exceed WCAG 3:1 contrast requirements
```

### Semantic Color Tokens (ShadCN Compatible)

```css
/* Surface & Text */
--background, --foreground
--card, --card-foreground
--popover, --popover-foreground
--muted, --muted-foreground

/* Actions & States */
--primary, --primary-foreground  (blue)
--secondary, --secondary-foreground
--accent, --accent-foreground  (blue-light)
--destructive, --destructive-foreground  (red)

/* Aurora Colors */
--red, --orange, --yellow, --green, --purple

/* Blue Variants */
--blue, --blue-light, --blue-deep

/* Structure */
--border, --input, --ring

/* Categorical Charts */
--chart-1 through --chart-5

/* Sequential Charts */
--chart-blue-1 through --chart-blue-8

/* Sidebar (ShadCN) */
--sidebar, --sidebar-foreground, --sidebar-primary, etc.
```

### Chart Color Strategies

**Categorical Data** (different categories/groups):
- Use `--chart-1` through `--chart-5` (blue, red, green, yellow, purple)
- Different hues provide clear visual distinction
- Example: Product categories, user segments, status types

**Sequential Data** (continuous scale/intensity):
- Use `--chart-blue-1` through `--chart-blue-8`
- Single hue with lightness progression
- Perceptually uniform steps
- Example: Temperature scales, density maps, time series intensity

## Typography System

### Font Stack

**Headings**: Lato (700 weight)
- Modern, geometric sans-serif
- Excellent readability at large sizes
- Professional but approachable

**Body**: Nunito Sans (400 weight)
- Rounded, friendly sans-serif
- Optimized for reading comfort
- Warm, welcoming aesthetic

**Mono**: JetBrains Mono (400 weight)
- Increased character height
- Clear distinction between similar characters
- Developer-friendly

### Type Scale

**Semantic sizes with default HTML element styling:**

```css
Display: 64px/77px   - Hero sections (requires .text-display)
Hero:    48px/58px   - Subhero sections (requires .text-hero)
h1:      40px/48px   - Primary page heading (automatic)
h2:      32px/42px   - Section headers (automatic)
h3:      24px/34px   - Subsection headers (automatic)
h4:      20px/28px   - Card titles (automatic)
h5:      18px/27px   - Small headings (automatic)
h6:      16px/24px   - Tiny headings (automatic)
Body:    16px/24px   - Paragraphs (default, automatic)
Small:   14px/20px   - Metadata (requires .text-small)
Caption: 12px/16px   - Fine print (requires .text-caption)
```

**Key Philosophy**:
- `<h2>` automatically looks like a heading - no classes needed
- Only use utility classes for non-semantic sizing (display, hero, small, caption)
- No arbitrary font sizes - only defined scale values

### Letter Spacing

```css
--letter-spacing-tight:  -0.5px   (Display text only)
--letter-spacing-normal: 0        (Default - most text)
--letter-spacing-wide:   0.025em  (Uppercase, small text)
```

## Spacing System

### Limited, Purposeful Scale

Based on 4px base unit for predictable, consistent layouts:

```
0:  0      (none)
1:  4px    (tiny gaps)
2:  8px    (small gaps, internal padding)
3:  12px   (comfortable spacing)
4:  16px   (default spacing unit)
5:  20px   (medium gaps)
6:  24px   (comfortable section spacing)
8:  32px   (larger gaps)
10: 40px   (section spacing)
12: 48px   (comfortable whitespace)
16: 64px   (major sections)
20: 80px   (large whitespace)
24: 96px   (hero spacing)
32: 128px  (massive whitespace)
```

**What's Missing**: 7, 9, 11, 13-15, 17-19, 21-23, 25-31, 33+
**Why**: Force consistency, prevent arbitrary spacing

## Tailwind v4 Restriction Strategy

### How We Limit Tailwind

```css
@theme inline {
  /* Disable entire namespaces */
  --spacing: initial;
  --font-size: initial;
  --font-weight: initial;

  /* Define ONLY allowed values */
  --spacing-4: 1rem;
  --spacing-8: 2rem;

  --font-size-body: 1rem;
  --font-size-small: 0.875rem;

  --font-weight-regular: 400;
  --font-weight-bold: 700;
}
```

### What This Achieves

✅ `p-4` works (defined)
❌ `p-7` doesn't work (not defined)
❌ `p-[17px]` doesn't work (arbitrary values disabled)
✅ `text-body` works (defined)
❌ `text-lg` doesn't work (not defined)
❌ `text-[19px]` doesn't work (arbitrary values disabled)

### ShadCN Compatibility

All ShadCN components work because we define required tokens:
- Colors: background, foreground, primary, etc.
- Radius: sm, md, lg, xl
- Shadows: sm, md, lg, xl
- Spacing: Standard scale that ShadCN uses

## Restrictions & Guidelines

### What Users CAN Do

```css
/* Semantic HTML - just works */
<h2>Section Title</h2>
<p>Body paragraph.</p>

/* Defined utilities */
<div class="p-4 bg-background text-foreground">
<button class="bg-primary text-primary-foreground">

/* Semantic text sizing when needed */
<div class="text-display">Hero Text</div>
<span class="text-small">Metadata</span>
```

### What Users CANNOT Do

```css
/* Arbitrary values (disabled) */
<div class="p-[13px]">          ❌ Breaks
<div class="text-[17px]">       ❌ Breaks
<div class="bg-[#f3f3f3]">      ❌ Breaks

/* Undefined utilities */
<div class="p-7">               ❌ Breaks (only 0-6, 8, 10, 12, 16, 20, 24, 32)
<div class="text-lg">           ❌ Breaks (use text-h4, text-small, etc.)
<div class="font-semibold">     ❌ Breaks (only font-regular, font-bold)
```

### Migration from Standard Tailwind

**Old Approach (Infinite Utilities):**
```html
<div class="text-lg font-semibold tracking-tight p-3 rounded-md">
```

**Basalt UI Approach (Semantic + Defined Tokens):**
```html
<!-- If it's a heading, use semantic HTML -->
<h3>Title</h3>

<!-- If it needs custom styling, use defined tokens -->
<div class="text-h3 font-bold tracking-normal p-3 rounded-md">
```

## Development Guidelines

### Adding New Tokens

**DO:**
1. Consider if it fits the natural/volcanic aesthetic
2. Use OKLCH color space for colors
3. Add to both light and dark modes
4. Update `@theme inline` mapping
5. Document in this file

**DON'T:**
1. Add arbitrary values
2. Extend the spacing scale without justification
3. Add font weights beyond 400/700
4. Use HSL/RGB for new colors

### Color Modification

Always work in OKLCH space:
```css
/* Adjust lightness for contrast */
--blue: oklch(0.692 0.097 252);
--blue-darker: oklch(0.553 0.107 252);  /* Darker (blue-deep) */

/* Adjust chroma for vibrancy */
--blue-muted: oklch(0.765 0.076 192);   /* Muted */
--blue-vivid: oklch(0.692 0.15 252);    /* More vibrant */

/* Adjust hue for color shift */
--blue: oklch(0.692 0.097 252);      /* Blue (252°) */
--teal: oklch(0.765 0.076 192);      /* Teal (192°) */
--cyan: oklch(0.794 0.102 219);      /* Cyan (219°) */
```

### Testing Colors

Use browser DevTools or OKLCH color pickers:
- https://oklch.com/
- https://www.oklch.org/
- Chrome/Edge DevTools (native OKLCH support)

Check contrast ratios:
- WCAG AA: 4.5:1 for body text, 3:1 for large text
- WCAG AAA: 7:1 for body text, 4.5:1 for large text

## File Architecture

```
packages/basalt-ui/
├── src/
│   └── index.css          # Main design system file
│       ├── Color Palette  (OKLCH definitions)
│       ├── @theme inline  (Tailwind v4 restrictions)
│       ├── @layer base    (Semantic HTML defaults)
│       └── @layer utilities (Custom utilities)
├── CLAUDE.md              # This file - design philosophy
├── README.md              # User-facing documentation
└── package.json
```

## Version Strategy

**Current**: Pre-1.0 (experimental, breaking changes allowed)

**Path to 1.0:**
1. Validate color palette with real projects
2. Confirm ShadCN component compatibility
3. Test typography scale across use cases
4. Gather feedback on restrictions
5. Stabilize token API

**Post-1.0:**
- Semantic versioning
- No breaking changes to token names
- Color value adjustments are patches
- New tokens are minor versions
- Removed tokens are major versions

## Common Questions

**Q: Why restrict Tailwind instead of building custom CSS?**
A: Tailwind's JIT, build optimization, and ecosystem are valuable. We want Tailwind's power with design system discipline.

**Q: Why OKLCH instead of HSL?**
A: Perceptual uniformity. `oklch(0.5 0.1 135)` to `oklch(0.6 0.1 135)` looks like a consistent brightness increase. HSL doesn't guarantee this.

**Q: Why only 400/700 font weights?**
A: Clarity and simplicity. Most design systems only need regular and bold. Extra weights (300, 500, 600) create confusion and inconsistency.

**Q: Can I use arbitrary values like `p-[13px]`?**
A: No, these are disabled. If you need a spacing value, add it to the scale. This enforces consistency across your project.

**Q: Why are h2/h3/etc styled by default?**
A: Semantic HTML should look correct without classes. If you're writing `<h2>`, it should look like a heading. This creates cleaner, more maintainable code.

**Q: How do I customize for my brand?**
A: Fork the repo, adjust OKLCH values in `:root` and `.dark`, update natural accent colors to match your brand. Keep the restriction strategy.

**Q: Does this work with ShadCN?**
A: Yes, fully compatible. All ShadCN tokens are defined. Components work out of the box.

## Roadmap

### Near Term
- [ ] Validate with real projects
- [ ] Create interactive color palette showcase
- [ ] Add focus state examples
- [ ] Document all available utilities
- [ ] Create migration guide from standard Tailwind

### Future Considerations
- [ ] Prose plugin alternative (restricted typography utilities)
- [ ] Animation/transition tokens
- [ ] Container query tokens
- [ ] Grid system recommendations
- [ ] Dark mode transition animations
- [ ] Color palette generator tool

## Support & Contribution

This is an opinionated design system. Contributions should:
1. Maintain the restrictive philosophy
2. Use OKLCH for colors
3. Preserve semantic HTML defaults
4. Follow volcanic nature aesthetic
5. Document in CLAUDE.md and README.md

For questions or feedback, open an issue describing:
- Your use case
- Why existing tokens don't work
- How your proposal aligns with the philosophy
