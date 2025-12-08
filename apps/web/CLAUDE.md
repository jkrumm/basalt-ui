# Basalt UI - Web App (Astro + React + Starlight)

**Inherits from**: `../../CLAUDE.md` (monorepo conventions: Bun, Biome, TypeScript strict, Tailwind v4)
**This file adds**: Astro + React specific patterns and web app conventions

Documentation site and design playground for the Basalt UI design system.

## Tech Stack

- **Framework**: Astro 5+ (static site generation)
- **Documentation**: Starlight (integrated at `/docs/*`)
- **UI Library**: React 19 (islands architecture)
- **Styling**: Tailwind CSS v4 + basalt-ui preset
- **Components**: ShadCN UI (copy-paste, not dependency)
- **TypeScript**: Strict mode with React JSX

## Project Structure

```
src/
├── content/
│   └── docs/
│       └── docs/        # Starlight documentation (becomes /docs/*)
├── components/
│   ├── ui/              # ShadCN components (auto-generated via CLI)
│   ├── layout/          # Header, Footer, Navigation
│   ├── features/        # Feature-specific (ComponentShowcase, etc.)
│   └── shared/          # Reusable (ThemeToggle, etc.)
├── layouts/
│   └── Layout.astro     # Base layout with SEO
├── pages/
│   ├── index.astro      # Landing page
│   ├── typography.astro # Demo pages
│   ├── colors.astro
│   ├── spacing.astro
│   └── charts.astro
├── styles/
│   ├── global.css           # Tailwind + basalt-ui imports
│   └── starlight-custom.css # Starlight theme bridge
└── lib/
    └── utils.ts         # cn() helper for ShadCN
```

## Key Conventions

### Astro-Specific

**Pages:**
- Use `.astro` files for static content
- Use `client:load` directive for interactive React components
- Import basalt-ui CSS in Layout.astro

**Islands Architecture:**
```astro
<!-- Static component (no JS shipped) -->
<Card>...</Card>

<!-- Interactive component (hydrated) -->
<ThemeToggle client:load />
```

### React Components

**File Naming:**
- Components: `PascalCase.tsx`
- Utilities: `kebab-case.ts`

**Component Pattern:**
```tsx
// Named export only (no default exports)
export function MyComponent({ prop }: Props) {
  return <div>{prop}</div>;
}
```

**Imports:**
```tsx
// Use @/ path aliases
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
```

### Styling with Tailwind v4

Use basalt-ui color tokens, not arbitrary values:

```astro
✅ <div class="bg-background text-foreground border-border">
❌ <div class="bg-[#fff]">
```

Theme: `.dark` class on `<html>`

### ShadCN Components

**Adding Components:**
```bash
# From apps/web directory
bunx shadcn@latest add button
```

**Using Components:**
```tsx
import { Button } from '@/components/ui/button';

<Button variant="outline" size="lg">
  Click me
</Button>
```

**Customization:**
- Components are copied to `src/components/ui/`
- Edit directly for project-specific needs
- Use `cn()` helper to merge Tailwind classes

### TypeScript

**Strict Mode:**
- All props must have explicit types
- No `any` types
- Use `interface` for props, `type` for unions

**Example:**
```tsx
interface ButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function Button({ variant = 'default', size = 'md', children }: ButtonProps) {
  // ...
}
```

### SEO Best Practices

**Page Meta:**
```astro
<Layout
  title="Page Title - Basalt UI"
  description="Page description for SEO"
>
```

**Requirements:**
- Unique title per page
- Description < 160 characters
- Semantic HTML (`<main>`, `<article>`, `<section>`)
- Proper heading hierarchy (h1 → h2 → h3)

### Performance

**Image Optimization:**
```astro
import { Image } from 'astro:assets';
import myImage from '../assets/image.png';

<Image src={myImage} alt="Description" loading="lazy" />
```

**Component Hydration:**
- Only use `client:load` when interactivity is needed
- Static components ship zero JavaScript
- Defer non-critical hydration with `client:visible`

## Validation & Development

```bash
# Build & Verify
bun run build            # Type check + production build
bun run preview          # Preview production build (optional)

# Add ShadCN Component
bunx shadcn@latest add [component-name]

# Quality (run from monorepo root)
bun run format           # Format all files (Biome + Prettier)
bun run format:prettier  # Format only Astro files with Prettier
bun run lint             # Lint all files with Biome
bun run pre              # Full validation (format + lint + typecheck)
```

**Workflow:**
1. Make changes to components/pages
2. Check `package.json` for validation commands
3. Run `bun run pre` from root to validate everything
4. Fix any errors in changed files only
5. Commit with conventional format

**Note**: User runs `bun dev` manually for validation. Focus on type-checking and formatting.

## Integration with basalt-ui Package

**Importing CSS in Workspace:**
```css
/* src/styles/global.css */
@import "tailwindcss";

/* Import basalt-ui tokens from workspace using relative path */
@import "../../../../packages/basalt-ui/src/index.css";
```

**Why relative path?**
In Bun workspaces, CSS imports from workspace packages work best with relative paths. When publishing to npm, consumers can use `import "basalt-ui/css"`, but within the monorepo, relative paths are more reliable.

**What You Get:**
- Tailwind v4 base styles
- Light/dark theme CSS variables
- Color tokens (background, foreground, primary, muted, border, ring)
- Typography scale
- Border radius tokens

**Workspace Dependency:**
```json
{
  "dependencies": {
    "basalt-ui": "workspace:*"
  }
}
```

## Tremor Raw Integration

This project uses **Tremor Raw** for data visualization components. Tremor Raw is copied into the project (not installed as dependency) similar to ShadCN.

### Architecture

**Component Structure:**
```
src/
├── components/
│   ├── ui/              # ShadCN components (CVA variants)
│   ├── tremor/          # Tremor Raw components (tailwind-variants)
│   └── ...
├── lib/
│   ├── utils.ts         # Merged utilities (cn() + cx())
│   ├── chartUtils.ts    # Tremor chart utilities
│   └── useOnWindowResize.ts  # Chart responsiveness hook
```

**Dependencies:**
- **Tremor-specific**: `tailwind-variants`, `@remixicon/react`, `recharts`
- **Shared with ShadCN**: `clsx`, `tailwind-merge`, Radix UI primitives
- **Coexistence**: Both CVA (ShadCN) and tailwind-variants (Tremor) work together

### Critical: Astro Usage Pattern

**All Tremor chart components MUST use `client:only="react"`:**

```astro
---
import { Card } from '@/components/tremor/Card';
import { AreaChart } from '@/components/tremor/AreaChart';
---

<!-- Card can use client:load -->
<Card client:load>
  <h3>Monthly Views</h3>

  <!-- Charts MUST use client:only="react" -->
  <div class="h-72">
    <AreaChart
      client:only="react"
      data={chartData}
      index="date"
      categories={["views"]}
      colors={["blue"]}
    />
  </div>
</Card>
```

**Why `client:only="react"` is required:**
- Tremor uses **Recharts** internally for all chart rendering
- Recharts accesses browser APIs (`window`, `document`) during render
- SSR will fail with "window is not defined" errors
- Hydration mismatches occur (server HTML doesn't match client SVG)
- Solution: Skip server rendering entirely with `client:only`

**Alternative directives that WON'T work:**
- ❌ `client:load` - Still attempts SSR, causes hydration errors
- ❌ `client:visible` - Same SSR issue
- ❌ No directive - Will fail at build time

### Color Compatibility

Tremor components automatically use Basalt UI color tokens through the CSS definitions:

```tsx
// Named colors map to Basalt UI tokens
<AreaChart
  colors={["blue", "emerald", "violet"]}
  // Uses --color-blue-500, --color-emerald-500, --color-violet-500
/>
```

**Available chart colors:**
- `blue` (primary), `red` (error), `emerald` (success - maps to green), `amber` (warning - maps to yellow)
- `violet` (accent - maps to purple), `cyan`, `indigo`
- `chart-1` through `chart-5` (categorical: blue, red, green, yellow, purple)
- `chart-blue-1` through `chart-blue-8` (sequential blues)

**How it works:**
- Basalt UI CSS defines all color shades (50-950) for each named color
- Tremor's `chartUtils.ts` generates classes like `bg-blue-500`, `stroke-emerald-600`
- These Tailwind classes are mapped to Basalt UI OKLCH tokens via `@theme inline` block
- Dark mode automatically switches to appropriate OKLCH values

### Utilities

**Merged in `lib/utils.ts`:**

```typescript
// ShadCN utility (class-variance-authority)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Tremor utility (identical implementation, different name for compatibility)
export function cx(...args: ClassValue[]) {
  return twMerge(clsx(...args))
}

// Tremor focus/error utilities
export const focusInput = [...]
export const focusRing = [...]
export const hasErrorInput = [...]
```

**Why both `cn()` and `cx()`?**
- ShadCN components import `cn()`, Tremor components import `cx()`
- Identical implementation (both use clsx + tailwind-merge)
- Keeps both libraries' import statements unchanged

### Chart Utilities

**Separate file `lib/chartUtils.ts`:**

```typescript
// Color definitions and utilities
export const chartColors = { blue: {...}, emerald: {...}, ... }
export const getColorClassName = (color, type) => {...}
export const constructCategoryColors = (categories, colors) => {...}

// Chart-specific helpers
export const getYAxisDomain = (autoMinValue, minValue, maxValue) => {...}
export const hasOnlyOneValueForKey = (array, keyToCheck) => {...}
```

### Common Patterns

**Basic Area Chart:**
```astro
---
const data = [
  { date: 'Jan', views: 2400 },
  { date: 'Feb', views: 1398 },
  // ...
];
---

<Card client:load>
  <h3 class="text-h4 mb-4">Page Views</h3>
  <div class="h-72">
    <AreaChart
      client:only="react"
      data={data}
      index="date"
      categories={["views"]}
      colors={["blue"]}
    />
  </div>
</Card>
```

**Multi-Series Chart:**
```astro
<AreaChart
  client:only="react"
  data={salesData}
  index="month"
  categories={["product1", "product2"]}
  colors={["blue", "emerald"]}
/>
```

**Chart Height:**
Always wrap charts in containers with explicit height (Recharts needs defined viewport):
```astro
✅ <div class="h-72"><AreaChart ... /></div>
✅ <div class="h-96"><AreaChart ... /></div>
❌ <div><AreaChart ... /></div>  <!-- Will render at 0px height -->
```

**IMPORTANT: Function Props Limitation**
Astro's `client:only` cannot serialize functions, so props like `valueFormatter`, `onValueChange`, `tooltipCallback`, and `customTooltip` cannot be passed from `.astro` files. Charts will use default formatters (numbers as strings). For custom formatting, create a wrapper React component.

### Known Issues & Solutions

**Issue: Recharts "width(-1) and height(-1)" error**
- **Root cause**: ResponsiveContainer calculates dimensions before container is sized
- **Solution**: AreaChart component uses inline `style={{ width: '100%', height: 320 }}` on wrapper div to provide explicit dimensions immediately on mount
- **For custom charts**: Always use inline styles for height, not just Tailwind classes

**Issue: Chart renders at 0px height**
- **Solution**: Wrap in container with explicit Tailwind height class (`h-72`, `h-96`, etc.)

**Issue: Chart disappears on hover / "valueFormatter is not a function" error**
- **Root cause**: Astro's `client:only` serialization converts functions to `null`
- **Solution**: Don't pass `valueFormatter`, `onValueChange`, `tooltipCallback`, or `customTooltip` from `.astro` files
- **Workaround**: Create a wrapper React component (`.tsx`) if custom formatting is needed

**Issue: "Encountered two children with the same key" warning**
- **Root cause**: Duplicate `key` props on nested elements within `React.Fragment`
- **Solution**: Only put `key` on `React.Fragment`, not on children `<defs>` or `<linearGradient>`

**Issue: "window is not defined" error**
- **Solution**: Use `client:only="react"` directive (not `client:load`)

**Issue: Hydration mismatch warnings**
- **Solution**: Use `client:only="react"` to skip SSR entirely

**Issue: Charts don't respect dark mode**
- **Solution**: Verify Tremor components use `dark:` prefix classes (should work automatically with `.dark` on `<html>`)

### Adding More Tremor Components

**Copy from official docs:**
1. Visit https://www.tremor.so/docs/components
2. Copy component code
3. Paste into `src/components/tremor/[ComponentName].tsx`
4. Verify imports (`cx`, `chartUtils`, Radix packages)
5. Use with appropriate Astro client directive

**Chart components always need `client:only="react"`**
**UI components (Badge, Button, Select) can use `client:load`**

## Starlight Documentation

This app uses Starlight for documentation at `/docs/*`.

### Structure

- **Documentation root**: `src/content/docs/docs/` (nested structure creates `/docs/*` URLs)
- **Landing page**: `/docs` redirects to `/docs/introduction`
- **Demo pages**: Root level (`/typography`, `/colors`, etc.)
- **Docs pages**: `/docs/*` subpath

### Adding Documentation

1. Create new `.md` file in `src/content/docs/docs/`
2. Add frontmatter:
   ```markdown
   ---
   title: Page Title
   description: Page description
   ---
   ```
3. Update sidebar in `astro.config.mjs`:
   ```javascript
   sidebar: [
     {
       label: 'Section Name',
       items: [
         { label: 'Page Title', slug: 'docs/page-slug' },
       ],
     },
   ]
   ```

### Styling

- **Current**: Minimal setup with CSS variable mapping to basalt-ui tokens
- **CSS bridge**: `src/styles/starlight-custom.css` maps Starlight variables to basalt-ui
- **Future**: Can override Starlight components for explicit basalt-ui styling

### Configuration

- **Config file**: `astro.config.mjs` - Starlight integration
- **Content config**: `src/content.config.ts` - Content collections setup
- **Social links**: Configured as array in Starlight config (v0.37+ syntax)

## Critical Gotchas

**Framework:**
- ❌ DON'T use `@astrojs/tailwind` (deprecated for Tailwind v4)
- ✅ DO use `@tailwindcss/vite` plugin

**React Islands:**
- ❌ DON'T forget `client:load` on interactive components
- ✅ DO add hydration directive explicitly

**Imports:**
- ❌ DON'T mix path styles: `../components` vs `@/components`
- ✅ DO use `@/` prefix consistently

**Exports:**
- ❌ DON'T use default exports
- ✅ DO use named exports only

**Formatting + Linting:**
- `.astro` files are formatted by **Prettier** (better Astro support + Tailwind sorting)
- `.ts/.tsx` files are formatted by **Biome** (25x faster)
- All files are linted by **Biome**
- Prettier plugin automatically sorts Tailwind classes in Astro files
- Biome has relaxed rules for Astro files (`noUnusedVariables`: off, `noUnusedImports`: off)
- Reason: Biome doesn't understand Astro template syntax, causes false positives
- See root `CLAUDE.md` for full hybrid tooling strategy

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Astro over Next.js | Static-first, framework-agnostic showcase |
| Islands architecture | Optimal performance, ship minimal JS |
| ShadCN copy-paste | Full customization, no dependency bloat |
| Path aliases `@/` | Matches monorepo convention, clean imports |
| React 19 | Latest stable, no forwardRefs needed |

## Testing Strategy (Future)

- Unit tests: Vitest for utility functions
- Component tests: Playwright for interactive components
- E2E tests: Playwright for user flows
- Visual regression: Storybook + Chromatic
