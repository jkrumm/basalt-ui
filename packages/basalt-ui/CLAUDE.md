# Basalt UI - Design System Package

**Inherits from**: `../../CLAUDE.md` (monorepo conventions)
**This file defines**: Design system philosophy, color system, restrictions, and token architecture

A mature, restrictive Tailwind CSS design system inspired by volcanic basalt stone and natural aesthetics.

## Design Philosophy

### Core Principles

1. **Opt-In Typography**: Use `.prose` class for rich typography, not global defaults
2. **Component-Library Friendly**: Base layer minimal to avoid conflicts with ShadCN/Tremor
3. **Restrictive by Design**: No infinite scales - only purposeful, defined tokens
4. **OKLCH Color Space**: Perceptually uniform colors for accessible, harmonious palettes
5. **Warm, Not Stark**: Professional but welcoming - never pure black/white
6. **Natural Aesthetics**: Basalt stone zinc neutrals with professional blue accents and expressive Aurora colors

### What We **DO**

- ✅ Define limited, purposeful design tokens
- ✅ Opt-in typography via `.prose` class (not global HTML defaults)
- ✅ Use OKLCH for perceptual color uniformity
- ✅ Foundation palette architecture (DRY - define once, reference everywhere)
- ✅ Restrict Tailwind scales to prevent arbitrary values
- ✅ Maintain full ShadCN compatibility
- ✅ Tremor Raw compatibility via gray palette overrides
- ✅ Create warm, professional, accessible interfaces
- ✅ Support volcanic nature aesthetic (zinc + blue + expressive colors)

### What We **DON'T DO**

- ❌ Infinite utility scales (no `text-[17px]`, no `p-[13px]`)
- ❌ Arbitrary color values (no `bg-[#f3f3f3]`)
- ❌ Stark black/white (warm grays instead)
- ❌ Extend Tailwind - we **replace** and **restrict** it
- ❌ Style semantic HTML globally (conflicts with component libraries)
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

**Foundation Palette (Reusable Base Colors):**

Like Nord's Polar Night and Snow Storm, our foundation palette provides the core neutral tones that all semantic tokens reference. Each OKLCH value is defined once:

```
Light Tones (light mode backgrounds, dark mode text):
- light-1: oklch(0.99 0.002 90)    - Brightest (cards, popovers)
- light-2: oklch(0.985 0.002 90)   - Main background (light mode)
- light-3: oklch(0.96 0.004 270)   - Muted backgrounds
- light-4: oklch(0.93 0.005 270)   - Borders, inputs

Dark Tones (dark mode backgrounds, light mode text):
- dark-1: oklch(0.195 0.012 285)   - Near-black, reserved
- dark-2: oklch(0.24 0.012 285)    - Main background (dark mode)
- dark-3: oklch(0.26 0.012 285)    - Cards (dark mode)
- dark-4: oklch(0.31 0.012 285)    - Borders, muted (dark mode)

Text Tones (subdued text):
- text-subdued-light: oklch(0.5 0.014 285)  - Muted text (light mode)
- text-subdued-dark: oklch(0.8 0.012 285)   - Muted text (dark mode)

Extreme Tones (high contrast):
- white: oklch(0.99 0.002 90)               - Text on dark backgrounds
```

**Why Foundation Colors?**
- **DRY**: Each value defined once, referenced everywhere
- **Consistency**: All semantic tokens use same base
- **Maintainability**: Change once, update entire system
- **Clarity**: Foundation → Semantic → UI hierarchy

**Semantic Tokens (Reference Foundation):**
```
Light Mode:
- background: var(--light-2)  - Main background
- foreground: var(--dark-4)   - Primary text
- card: var(--light-1)        - Elevated surfaces
- muted: var(--light-3)       - Subtle backgrounds
- border: var(--light-4)      - Borders, dividers

Dark Mode:
- background: var(--dark-2)   - Main background
- foreground: oklch(0.935 0.005 90) - Soft white
- card: var(--dark-3)         - Elevated surfaces
- muted: var(--dark-4)        - Subtle backgrounds
- border: var(--dark-4)       - Borders, dividers
```

**Blue Primary (Nord Frost):**
```
Blue (Primary Accent):
- Value: oklch(0.6965 0.0591 248.69)  - Nord #81a1c1
- Same for light and dark modes
- Usage: Primary actions, links, focus rings, interactive elements

Blue Variants with Foregrounds:
- blue:       oklch(0.6965 0.0591 248.69)  - Primary accent
              blue-foreground: oklch(0.99 0.002 90) - White text on blue

- blue-light: oklch(0.78 0.045 249)         - Hover states, highlights
              blue-light-foreground: oklch(0.265 0.015 285) - Dark text on blue-light

- blue-deep:  oklch(0.5944 0.0772 254.03)   - Strong emphasis (Nord #5e81ac)
              blue-deep-foreground: oklch(0.99 0.002 90) - White text on blue-deep
```

**Expressive Colors (inspired by Nord Aurora):**
```
Semantic colors for meaningful UI states - same values for light and dark modes

Red:    oklch(0.6061 0.1206 15.34)  - Errors, destructive actions
        red-foreground: oklch(0.99 0.002 90) - White text on red

Orange: oklch(0.6929 0.0963 38.24)  - Annotations, warnings
        orange-foreground: oklch(0.265 0.015 285) - Dark text on orange

Yellow: oklch(0.8549 0.0892 84.09)  - Caution, highlights
        yellow-foreground: oklch(0.265 0.015 285) - Dark text on yellow

Green:  oklch(0.7683 0.0749 131.06) - Success, confirmations
        green-foreground: oklch(0.265 0.015 285) - Dark text on green

Purple: oklch(0.6921 0.0625 332.66) - Special features, unique identifiers
        purple-foreground: oklch(0.99 0.002 90) - White text on purple
```

**Sequential Chart Palette:**
```
8 blue tones for data visualization (blue hue ~249°)

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
Used for: Sequential data visualization (temperature scales, density maps, time series)
```

**Chart Color Shades (Tremor Compatibility):**
```
Full 50-950 shade scales for Tremor's dynamic color system:
- Blue shades (blue-50 through blue-950) - reuses chart-blue palette
- Red shades (red-50 through red-950)
- Emerald shades (emerald-50 through emerald-950) - maps to green
- Amber shades (amber-50 through amber-950) - maps to yellow
- Violet shades (violet-50 through violet-950) - maps to purple
- Cyan shades (cyan-50 through cyan-950)
- Indigo shades (indigo-50 through indigo-950)

Each shade scale maintains perceptual uniformity in OKLCH space
Used for: Tremor charts with classes like bg-blue-500, stroke-emerald-600
```

### Tailwind Gray Palette Override (Tremor Compatibility)

**Strategy:** Override Tailwind's default gray scale (`white`, `black`, `gray-50` through `gray-950`) to use Basalt foundation colors automatically.

**Why:** Component libraries like Tremor use hardcoded Tailwind classes (`bg-white`, `bg-gray-100`, `hover:bg-gray-800`, `text-gray-500`) that need to match Basalt's design system without manual changes.

**Implementation:** Using `@theme` (NOT `@theme inline`) to create global CSS variables that Tremor's `dark:` variants can override.

**Mapping (analyzed from Tremor usage patterns):**

Backgrounds & Surfaces:
```
white    → light-1  (brightest - cards, popovers, elevated surfaces)
gray-50  → light-2  (very light - main background in light mode)
gray-100 → light-3  (muted backgrounds, disabled states)
gray-200 → light-4  (borders, inputs)
```

Text Colors (Light Mode):
```
gray-300 → oklch(0.75 0.01 285) - very disabled/invisible text in light mode
gray-400 → muted-foreground - disabled text, icons (light mode)
gray-500 → muted-foreground - placeholders, subtle text (both modes)
gray-600 → muted-foreground - medium muted text (light mode)
gray-700 → oklch(0.35 0.013 285) - readable muted text (light mode)
```

Dark Mode Surfaces (used with `dark:` prefix):
```
gray-800 → dark-4  (borders/muted in dark mode)
gray-900 → dark-3  (cards/elevated surfaces in dark mode)
gray-950 → dark-2  (main background in dark mode)
black    → dark-1  (darkest - near-black)
```

**How Tremor Uses These:**
- Light mode: `text-gray-700` (readable) → `dark:text-gray-300` (disabled light text)
- Light mode: `text-gray-400` (disabled) → `dark:text-gray-600` (muted dark text)
- Both modes: `text-gray-500` (placeholders stay consistent via muted-foreground)
- Backgrounds: `bg-white` (light cards) → `dark:bg-gray-950` (dark main bg)

**Result:**
- Tremor components automatically use Basalt colors in both light and dark modes
- No manual theme configuration needed in Tremor components
- Proper contrast maintained via muted-foreground semantic token
- ShadCN continues using semantic tokens (unaffected)

**Code Location:** `src/index.css` lines 510-537 (`@theme` block)

### Semantic Color Tokens (ShadCN Compatible)

```css
/* Foundation Palette (base colors, defined once) */
--light-1, --light-2, --light-3, --light-4  (light tones)
--dark-1, --dark-2, --dark-3, --dark-4      (dark tones)
--white                                      (pure white)
--text-subdued-light, --text-subdued-dark   (muted text)

/* Surface & Text (reference foundation) */
--background, --foreground
--card, --card-foreground
--popover, --popover-foreground
--muted, --muted-foreground

/* Actions & States (reference foundation + Aurora) */
--primary, --primary-foreground             (var(--blue), var(--white))
--secondary, --secondary-foreground
--accent, --accent-foreground               (var(--blue-light), var(--dark-4))
--destructive, --destructive-foreground     (var(--red), var(--white))

/* Expressive Colors with Foregrounds (semantic states) */
--red, --red-foreground                     (var(--white))
--orange, --orange-foreground               (var(--dark-4))
--yellow, --yellow-foreground               (var(--dark-4))
--green, --green-foreground                 (var(--dark-4))
--purple, --purple-foreground               (var(--white))

/* Blue Variants with Foregrounds (primary accent) */
--blue, --blue-foreground                   (var(--white))
--blue-light, --blue-light-foreground       (var(--dark-4))
--blue-deep, --blue-deep-foreground         (var(--white))

/* Structure (reference foundation) */
--border, --input, --ring

/* Sequential Charts */
--chart-blue-1 through --chart-blue-8

/* Sidebar (ShadCN) */
--sidebar, --sidebar-foreground, --sidebar-primary, etc.
```

### Chart Color Strategies

**Categorical Data** (different categories/groups):
- Use named colors directly: `--blue`, `--red`, `--green`, `--yellow`, `--purple`
- Different hues provide clear visual distinction
- Example: Product categories, user segments, status types

**Sequential Data** (continuous scale/intensity):
- Use `--chart-blue-1` through `--chart-blue-8`
- Single hue with lightness progression
- Perceptually uniform steps
- Example: Temperature scales, density maps, time series intensity

## Typography: Opt-In with .prose

Basalt UI uses the official `@tailwindcss/typography` plugin configured with Basalt design tokens for automatic dark mode support.

### Core Philosophy

**Semantic HTML is unstyled by default** to avoid conflicts with component libraries (ShadCN, Tremor). Use the `.prose` class for content areas where you want automatic semantic styling.

### Usage

**Content areas** (blog posts, articles, documentation):
```html
<article class="prose">
  <h1>Article Title</h1>
  <p>Content automatically styled with Basalt colors...</p>
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

**Custom layouts** (UI components, app UI):
```html
<!-- Use utility classes for manual control -->
<h2 class="text-h2 font-bold">Styled Heading</h2>
<p class="text-body text-muted-foreground">Custom paragraph</p>
```

### Why Not Global Styling?

Global semantic HTML defaults conflict with component libraries:
- Tremor Table expects unstyled `<table>` elements
- ShadCN Button shouldn't inherit link `<a>` styles
- Navigation links don't want automatic blue underlines
- Component padding/spacing conflicts with global paragraph margins

**Migration from global styling:**
- Old: `<h2>Title</h2>` styled everywhere → conflicts with components
- New: `<article class="prose"><h2>Title</h2></article>` → styled only in content areas
- Custom UI: `<h2 class="text-h2 font-bold">Title</h2>` → manual utility classes

### Automatic Dark Mode

Because `.prose` uses Basalt CSS variables, **no `dark:prose-invert` needed**:

```html
<body class="dark">
  <article class="prose">
    <!-- Text colors switch automatically via CSS variables -->
  </article>
</body>
```

### Plugin Configuration

The typography plugin is configured in `tailwind.config.js`:

**Color Mapping** (automatic dark mode):
```javascript
'--tw-prose-body': 'var(--foreground)',
'--tw-prose-headings': 'var(--foreground)',
'--tw-prose-links': 'var(--blue)',
'--tw-prose-code': 'var(--foreground)',
'--tw-prose-pre-bg': 'var(--muted)',
// ... all mapped to Basalt variables
```

**Basalt Customizations** (design system specific):
```javascript
// Links - Basalt style
a: {
  textDecoration: 'underline',
  textUnderlineOffset: '2px',
  fontWeight: '500',
  transition: 'all 150ms ease-in-out',
},

// Code - use Basalt border radius
code: {
  backgroundColor: 'var(--muted)',
  padding: '0.2em 0.4em',
  borderRadius: 'var(--radius-sm)',
},

// Headings - use Basalt font family
'h1, h2, h3, h4, h5, h6': {
  fontFamily: 'var(--font-heading)',
},

// Blockquotes - Basalt blue border
blockquote: {
  borderLeftColor: 'var(--blue)',
},
```

### What the Plugin Provides

The typography plugin handles all the complex layout and spacing:
- ✅ Professional heading hierarchy and sizing
- ✅ Optimal paragraph spacing and line heights
- ✅ List indentation and markers
- ✅ Table layouts and borders
- ✅ Code block formatting
- ✅ Blockquote styling
- ✅ Responsive typography scales

Basalt only customizes:
- Color mapping (CSS variables for automatic dark mode)
- Font families (Lato for headings, Nunito Sans for body)
- Border radius (matches Basalt tokens)
- Link styling (underline, weight, transitions)
- Code backgrounds (Basalt muted color)

**Code Location:** `tailwind.config.js` lines 8-77

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

**Semantic sizes for utility classes:**

```css
Display: 64px/77px   - Hero sections (use .text-display)
Hero:    48px/58px   - Subhero sections (use .text-hero)
h1:      40px/48px   - Primary page heading (use .text-h1 or .prose)
h2:      32px/42px   - Section headers (use .text-h2 or .prose)
h3:      24px/34px   - Subsection headers (use .text-h3 or .prose)
h4:      20px/28px   - Card titles (use .text-h4 or .prose)
h5:      18px/27px   - Small headings (use .text-h5 or .prose)
h6:      16px/24px   - Tiny headings (use .text-h6 or .prose)
Body:    16px/24px   - Paragraphs (default body text)
Small:   14px/20px   - Metadata (use .text-small)
Caption: 12px/16px   - Fine print (use .text-caption)
```

**Key Philosophy**:
- HTML elements (h1-h6, p, a, etc.) are **unstyled by default** to avoid component conflicts
- Use `.prose` class for content areas (blog posts, articles) to get automatic semantic styling
- Use utility classes (`.text-h2`, `.text-small`) for custom layouts and UI components
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

```html
<!-- Content areas - use .prose for automatic semantic styling -->
<article class="prose">
  <h2>Section Title</h2>
  <p>Body paragraph with <a href="#">links</a> and <code>inline code</code>.</p>
  <ul>
    <li>List items</li>
  </ul>
</article>

<!-- UI components - use defined utilities -->
<div class="p-4 bg-background text-foreground">
<button class="bg-primary text-primary-foreground">

<!-- Custom layouts - use semantic text sizing -->
<div class="text-display">Hero Text</div>
<h2 class="text-h2">Unstyled Heading (no .prose)</h2>
<span class="text-small">Metadata</span>
```

### What Users CANNOT Do

```html
<!-- Arbitrary values (disabled) -->
<div class="p-[13px]">          ❌ Breaks
<div class="text-[17px]">       ❌ Breaks
<div class="bg-[#f3f3f3]">      ❌ Breaks

<!-- Undefined utilities -->
<div class="p-7">               ❌ Breaks (only 0-6, 8, 10, 12, 16, 20, 24, 32)
<div class="text-lg">           ❌ Breaks (use text-h4, text-small, etc.)
<div class="font-semibold">     ❌ Breaks (only font-regular, font-bold)
```

### Migration from Standard Tailwind

**Old Approach (Global Semantic Styles):**
```html
<!-- Elements styled globally, conflicts with components -->
<h2>Section Title</h2>              <!-- Always styled -->
<Table>                             <!-- Inherits global table styles -->
  <TableHeader>...</TableHeader>    <!-- Conflicts! -->
</Table>
```

**Basalt UI Approach (Opt-In Typography):**
```html
<!-- Content areas: Use .prose -->
<article class="prose">
  <h2>Section Title</h2>            <!-- Styled within .prose -->
  <p>Automatic styling...</p>
</article>

<!-- Components: No .prose -->
<Table>                             <!-- Clean, no conflicts -->
  <TableHeader>...</TableHeader>    <!-- Works perfectly -->
</Table>

<!-- Custom UI: Use utilities -->
<div class="text-h3 font-bold p-4 rounded-md">
  Custom styled element
</div>
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

**Q: Why aren't h2/h3/etc styled by default?**
A: Global semantic HTML defaults conflict with component libraries like ShadCN and Tremor. These libraries expect unstyled elements. Use the `.prose` class for content areas (blog posts, articles) where you want automatic semantic styling. For UI components, use utility classes like `text-h2 font-bold`.

**Q: How do I customize for my brand?**
A: Fork the repo, adjust OKLCH values in `:root` and `.dark`, update natural accent colors to match your brand. Keep the restriction strategy.

**Q: Does this work with ShadCN?**
A: Yes, fully compatible. All ShadCN tokens are defined. Components work out of the box.

## Roadmap

### Completed
- [x] Typography plugin integration (@tailwindcss/typography)
- [x] Tremor Raw full compatibility
- [x] Gray palette overrides for Tremor
- [x] Foundation palette architecture (DRY)
- [x] Chart color shades (50-950 scales)
- [x] Opt-in `.prose` class (no global semantic HTML)

### Near Term
- [ ] Validate with real projects
- [ ] Create interactive color palette showcase
- [ ] Add focus state examples
- [ ] Document all available utilities
- [ ] Create migration guide from standard Tailwind

### Future Considerations
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
