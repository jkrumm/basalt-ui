# Plan: Use Official Tailwind Typography Plugin, Configured for Basalt

## Problem Summary

Basalt UI currently applies semantic HTML styles globally via `@layer base`, which conflicts with component libraries like ShadCN and Tremor Raw. These libraries expect unstyled HTML elements so they can apply their own component-specific styling.

**Current conflicts:**
- Headings (h1-h6) get automatic sizing/spacing → breaks component layouts
- Links (a) get blue color + underline → breaks navigation/button components
- Tables get borders/backgrounds → conflicts with Tremor Table component
- Lists (ul/ol) get padding → could break dropdown/menu components
- Code blocks get backgrounds → looks odd in tight component spaces

**Research findings:**
- Industry best practice: Use official `@tailwindcss/typography` plugin
- Configure it to use design system tokens (not default Tailwind grays)
- Mapping to CSS variables enables automatic dark mode (no `dark:prose-invert` needed)
- **DO NOT reimplement** - plugin handles complex typography layout/spacing

## Solution: Official Plugin + Basalt Token Mapping

**Architecture Decision: Use plugin as structural engine, Basalt for aesthetics**

1. **Install** `@tailwindcss/typography` plugin
2. **Configure** to use Basalt CSS variables (not `prose-zinc`/`prose-stone`)
3. **Minimal base layer**: Only browser resets + body defaults
4. **Result**: `.prose` class that matches Basalt design system perfectly

## Implementation Plan

### Files to Create/Modify
1. `packages/basalt-ui/package.json` - Add typography plugin dependency
2. `packages/basalt-ui/tailwind.preset.js` - **NEW FILE** - Design system configuration with typography
3. `packages/basalt-ui/src/index.css` - Import plugin, reference config, simplify base layer
4. `packages/basalt-ui/CLAUDE.md` - Update documentation

### Architecture: Preset-Based Design System

**Why `tailwind.preset.js` (not `tailwind.config.js`)**:
- Basalt UI is a **design system package**, not an app
- Presets are meant for shared design rules (colors, fonts, typography)
- Apps using Basalt will import the preset in their own config
- Clean separation: Design System (preset) vs. App Implementation (config)

### Step 1: Install Plugin

```bash
cd packages/basalt-ui
bun add -D @tailwindcss/typography
```

**Result**: Adds `@tailwindcss/typography` to `devDependencies`

### Step 2: Create Design System Preset

**File**: `packages/basalt-ui/tailwind.preset.js` (**NEW FILE**)

```javascript
import typographyPlugin from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            // === MAP TO BASALT CSS VARIABLES (automatic dark mode) ===
            '--tw-prose-body': 'var(--foreground)',
            '--tw-prose-headings': 'var(--foreground)',
            '--tw-prose-lead': 'var(--text-subdued-light)',
            '--tw-prose-links': 'var(--blue)',
            '--tw-prose-bold': 'var(--foreground)',
            '--tw-prose-counters': 'var(--text-subdued-light)',
            '--tw-prose-bullets': 'var(--text-subdued-light)',
            '--tw-prose-hr': 'var(--border)',
            '--tw-prose-quotes': 'var(--foreground)',
            '--tw-prose-quote-borders': 'var(--border)',
            '--tw-prose-captions': 'var(--text-subdued-light)',
            '--tw-prose-code': 'var(--foreground)',
            '--tw-prose-pre-code': 'var(--foreground)',
            '--tw-prose-pre-bg': 'var(--muted)',
            '--tw-prose-th-borders': 'var(--border)',
            '--tw-prose-td-borders': 'var(--border)',

            // === BASALT-SPECIFIC CUSTOMIZATIONS ===
            // Only override what's unique to Basalt design system
            // Plugin handles layout/spacing (don't reimplement)

            maxWidth: '65ch', // Readable line length

            // Links - Basalt style (underline, offset, transition)
            a: {
              color: 'var(--tw-prose-links)',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              fontWeight: '500',
              transition: 'all 150ms ease-in-out',
            },

            // Code blocks - Basalt muted background
            code: {
              backgroundColor: 'var(--muted)',
              color: 'var(--foreground)',
              padding: '0.2em 0.4em',
              borderRadius: 'var(--radius-sm)', // Reference Basalt token
              fontWeight: '400',
            },

            // Remove default backticks around inline code
            'code::before': { content: '""' },
            'code::after': { content: '""' },

            // Pre blocks - match Basalt card style
            pre: {
              backgroundColor: 'var(--muted)',
              borderRadius: 'var(--radius)', // Reference Basalt token
            },

            // Headings - use Basalt font family
            'h1, h2, h3, h4, h5, h6': {
              fontFamily: 'var(--font-heading)',
            },

            // Blockquotes - Basalt blue border
            blockquote: {
              borderLeftColor: 'var(--blue)',
            },
          },
        },
      },
    },
  },
  plugins: [typographyPlugin],
};
```

**What this does**:
- ✅ Maps ALL prose colors to Basalt CSS variables (automatic dark mode)
- ✅ Overrides ONLY Basalt-specific styling (fonts, link behavior, code bg, blockquote border)
- ✅ Lets plugin handle standard typography layout (margins, spacing, font sizes, line heights)
- ✅ Removes backticks from inline code (common customization)
- ✅ References Basalt tokens (`--radius-sm`, `--font-heading`, `--blue`)

**What we DON'T do** (plugin handles these):
- ❌ Don't redefine h1-h6 font sizes (plugin has professional scale)
- ❌ Don't redefine paragraph spacing (plugin handles it)
- ❌ Don't redefine list padding (plugin handles it)
- ❌ Don't redefine table layout (plugin handles it)

**Result**: Plugin provides structure, Basalt provides aesthetics.

### Step 3: Update index.css

**File**: `packages/basalt-ui/src/index.css`

#### 3a. Import plugin and config (Lines 1-3)

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@config "../tailwind.preset.js";
```

**Rationale**:
- `@plugin` loads the typography plugin
- `@config` loads the preset with our typography customizations
- Tailwind v4 CSS-first configuration pattern

#### 3b. Simplify `@layer base` (Lines 647-829 → ~660-680)

**KEEP ONLY:**

```css
@layer base {
  /* === DOCUMENT SETUP === */
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* === TAILWIND V4: Set default border color === */
  *,
  ::before,
  ::after {
    border-color: var(--border);
  }

  html {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  /* === BODY DEFAULTS: Core typography and colors === */
  body {
    font-family: var(--font-body);
    font-size: var(--font-size-body);
    line-height: var(--line-height-body);
    font-weight: var(--font-weight-regular);
    color: var(--foreground);
    background-color: var(--background);
    letter-spacing: var(--letter-spacing-normal);
  }
}
```

**REMOVE from base layer:**
- All h1-h6 element selectors (lines 680-721)
- All paragraph styling (p selector, lines 724-726)
- All link styling (a selector, lines 729-739)
- All code/pre styling (code, kbd, samp, pre selectors, lines 742-766)
- All list styling (ul, ol, li selectors, lines 769-785)
- All blockquote styling (blockquote selector, lines 788-795)
- All hr styling (hr selector, lines 798-802)
- All image defaults (img selector, lines 805-809)
- All table styling (table, th, td selectors, lines 812-828)

**Rationale**: These styles now provided by `.prose` class from typography plugin (configured in preset).

### Step 4: Update Documentation

**File**: `packages/basalt-ui/CLAUDE.md`

Update philosophy section (lines ~10-30) from:

```markdown
### Core Principles

1. **Semantic HTML First**: h2 elements look like headings without utility classes
2. **Restrictive by Design**: No infinite scales - only purposeful, defined tokens
```

To:

```markdown
### Core Principles

1. **Opt-In Semantic Styling**: Use `.prose` class for rich typography, not global defaults
2. **Component-Library Friendly**: Base layer minimal to avoid conflicts with ShadCN/Tremor
3. **Restrictive by Design**: No infinite scales - only purposeful, defined tokens
```

Add new section after "Color System":

```markdown
## Typography: Opt-In with .prose

Basalt UI uses the official `@tailwindcss/typography` plugin configured with Basalt design tokens.

### Usage

**Content areas** (blog posts, articles, documentation):
```html
<article class="prose">
  <h1>Article Title</h1>
  <p>Content automatically styled...</p>
</article>
```

**Component libraries** (ShadCN, Tremor, app UI):
```html
<!-- No .prose class - components style themselves -->
<Table>...</Table>
<Button>Click Me</Button>
```

### Why Not Global Styling?

Global semantic HTML defaults conflict with component libraries:
- Tremor Table expects unstyled `<table>` elements
- ShadCN Button shouldn't inherit link `<a>` styles
- Navigation links don't want automatic blue underlines

### Automatic Dark Mode

Because `.prose` uses Basalt CSS variables, dark mode works automatically:

```html
<!-- No dark:prose-invert needed! -->
<article class="prose">
  <!-- Text color switches with .dark class -->
</article>
```

### Plugin Configuration

The typography plugin is configured to use Basalt tokens in `index.css`:

```css
@theme {
  --typography-body: var(--foreground);
  --typography-links: var(--blue);
  --typography-code-bg: var(--muted);
  /* ... */
}
```

This ensures `.prose` matches your design system perfectly.
```

## Expected Outcomes

**Before (Current):**
```html
<!-- Breaks component libraries -->
<Table>                  <!-- ❌ Inherits table borders/bg -->
  <TableHeader>...</TableHeader>
</Table>

<a href="#">Nav Link</a> <!-- ❌ Blue underline (unwanted) -->
```

**After (With plugin):**
```html
<!-- Content: Wrap in .prose -->
<article class="prose">
  <h1>Title</h1>         <!-- ✅ Beautifully styled -->
  <p>Content...</p>      <!-- ✅ Perfect typography -->
</article>

<!-- Components: No .prose -->
<Table>...</Table>       <!-- ✅ Works perfectly -->
<Button>Click</Button>   <!-- ✅ No conflicts -->
```

**Dark mode (automatic):**
```html
<body class="dark">
  <article class="prose">
    <!-- ✅ Text automatically white, no dark:prose-invert needed -->
  </article>
</body>
```

## Key Benefits

1. **Industry Standard**: Using official plugin, not reinventing
2. **Maintainable**: Plugin handles complex spacing/layout logic
3. **Automatic Dark Mode**: CSS variables switch, no class modifiers
4. **Perfect Sync**: Prose colors match ShadCN/Tremor/Basalt tokens
5. **Component Safe**: No global styles breaking libraries

## Testing Strategy

### Phase 1: Plugin Installation (Quick Test)
```bash
cd packages/basalt-ui
bun add -D @tailwindcss/typography
bun run build
```
**Expected**: Build succeeds, no errors

### Phase 2: Visual Testing

1. **Create test page** `apps/web/src/pages/prose-test.astro`:
```astro
---
import Layout from '../layouts/Layout.astro';
---
<Layout title="Prose Test">
  <div class="container mx-auto px-4 py-8">
    <!-- Test .prose class -->
    <article class="prose">
      <h1>H1 Heading</h1>
      <h2>H2 Heading</h2>
      <p>This is a paragraph with <a href="#">a link</a> and <code>inline code</code>.</p>
      <ul>
        <li>List item 1</li>
        <li>List item 2</li>
      </ul>
      <pre><code>const code = "block";</code></pre>
    </article>

    <!-- Test components without .prose -->
    <div class="mt-8">
      <h3>Tremor Components (No Prose)</h3>
      <!-- Import and test Tremor Table, Button, etc. -->
    </div>
  </div>
</Layout>
```

2. **Verify Tremor components** (`/dashboard`):
    - Table renders normally (no inherited borders/bg)
    - Button colors work (no link underlines)
    - Select/Dropdown components function

3. **Dark mode test**:
    - Toggle dark mode on prose-test page
    - Verify text colors switch automatically
    - No need for `dark:prose-invert`

### Phase 3: Build Validation
```bash
# Root: Type-check and format
bun run pre

# Package: Build CSS
cd packages/basalt-ui
bun run build

# Web: Build site
cd ../apps/web
bun run build
```

## Success Criteria

✅ **Plugin installs without errors**
✅ **`.prose` class available and styled correctly**
✅ **Tremor components unaffected** (no style conflicts)
✅ **ShadCN components work normally**
✅ **Dark mode automatic** (no manual class needed)
✅ **Build succeeds** (type-check + CSS compilation)
✅ **Documentation updated** (CLAUDE.md + comments)

## Rollback Plan

If typography plugin doesn't work with Tailwind v4:

1. **Fallback**: Implement custom `.prose` (original plan approach)
2. **Keep base layer minimal** (still correct approach)
3. **Wait for v4-native plugin** (future enhancement)

## Notes & Caveats

### Typography Plugin + Tailwind v4 Compatibility

**Status**: As of Dec 2025, `@tailwindcss/typography` v0.5.x was designed for v3. Tailwind v4 is in beta.

**If plugin doesn't work:**
- Error during build: "Unknown plugin @tailwindcss/typography"
- Solution: Implement custom `.prose` using original plan CSS

**If plugin works but config doesn't:**
- CSS variable mapping doesn't apply
- Solution: Adjust config syntax or fallback to custom implementation

### Alternative: Custom Implementation

If needed, we can implement `.prose` manually (130 lines of CSS from original plan) with:
- ✅ Full control over styling
- ✅ No plugin dependency
- ❌ More maintenance (we own spacing/layout logic)
- ❌ Miss plugin updates/improvements

**Recommendation**: Try plugin first. If issues, pivot to custom.

---

## Summary

**Problem**: Global semantic HTML styles conflict with component libraries (Tremor, ShadCN).

**Solution**: Use official `@tailwindcss/typography` plugin configured with Basalt tokens.

**Implementation**:
1. Install `@tailwindcss/typography` plugin
2. Create `tailwind.preset.js` with typography configuration
3. Import plugin + preset via `@plugin` and `@config` in `index.css`
4. Map typography colors to Basalt CSS variables (automatic dark mode)
5. Override ONLY Basalt-specific styles (fonts, link behavior, code bg)
6. Let plugin handle standard typography (layout, spacing, sizes)
7. Simplify `@layer base` to minimal resets + body defaults

**Result**:
- ✅ Component libraries work perfectly (no conflicts)
- ✅ Content areas styled beautifully with `.prose` class
- ✅ Automatic dark mode (CSS variables switch)
- ✅ Industry-standard approach (not reinventing)
- ✅ Maintainable (plugin handles complex logic)
- ✅ Design system preset pattern (reusable across apps)

**Files Changed**:
- `packages/basalt-ui/package.json` - Add dependency
- `packages/basalt-ui/tailwind.preset.js` - **NEW** - Typography config + plugin
- `packages/basalt-ui/src/index.css` - Import plugin/preset, simplify base layer
- `packages/basalt-ui/CLAUDE.md` - Update documentation

**Time Estimate**: ~30-45 minutes (with testing)
