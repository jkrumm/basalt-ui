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
5. **Natural Aesthetics**: Basalt stone zinc neutrals with sage, rust, and ochre accents

### What We **DO**

- ✅ Define limited, purposeful design tokens
- ✅ Style semantic HTML elements by default
- ✅ Use OKLCH for perceptual color uniformity
- ✅ Restrict Tailwind scales to prevent arbitrary values
- ✅ Maintain full ShadCN compatibility
- ✅ Create warm, professional, accessible interfaces
- ✅ Support volcanic nature aesthetic (zinc + natural accents)

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

**Natural Accents:**
```
Lichen Sage (Primary):
- Light: oklch(0.58 0.10 135)  - Earthy sage green
- Dark:  oklch(0.68 0.11 135)  - Lighter for contrast
- Usage: Primary actions, links, focus rings

Magma Rust (Destructive):
- Light: oklch(0.58 0.18 35)   - Warm rust red
- Dark:  oklch(0.66 0.19 35)   - Brighter for visibility
- Usage: Errors, warnings, destructive actions

Vein Ochre (Tertiary):
- Light: oklch(0.70 0.12 75)   - Warm ochre yellow
- Dark:  oklch(0.75 0.13 75)   - Adjusted for dark mode
- Usage: Attention, special highlights, warnings
```

### Semantic Color Tokens (ShadCN Compatible)

```css
/* Surface & Text */
--background, --foreground
--card, --card-foreground
--popover, --popover-foreground
--muted, --muted-foreground

/* Actions & States */
--primary, --primary-foreground
--secondary, --secondary-foreground
--accent, --accent-foreground
--destructive, --destructive-foreground
--ochre, --ochre-foreground

/* Structure */
--border, --input, --ring

/* Charts & Data Viz */
--chart-1 through --chart-5

/* Sidebar (ShadCN) */
--sidebar, --sidebar-foreground, --sidebar-primary, etc.
```

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
--primary: oklch(0.58 0.10 135);
--primary-hover: oklch(0.50 0.10 135);  /* Darker */

/* Adjust chroma for vibrancy */
--accent: oklch(0.68 0.08 135);   /* Muted */
--accent-vivid: oklch(0.68 0.15 135);  /* Vibrant */

/* Adjust hue for color shift */
--sage: oklch(0.58 0.10 135);     /* Green */
--rust: oklch(0.58 0.10 35);      /* Orange */
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
