# Basalt UI - Web App (Astro + React)

**Inherits from**: `../../CLAUDE.md` (monorepo conventions: Bun, Biome, TypeScript strict, Tailwind v4)
**This file adds**: Astro + React specific patterns and web app conventions

Documentation site and design playground for the Basalt UI design system.

## Tech Stack

- **Framework**: Astro 5+ (static site generation)
- **UI Library**: React 19 (islands architecture)
- **Styling**: Tailwind CSS v4 + basalt-ui preset
- **Components**: ShadCN UI (copy-paste, not dependency)
- **TypeScript**: Strict mode with React JSX
- **State**: Nanostores (theme management)

## Project Structure

```
src/
├── components/
│   ├── ui/              # ShadCN components (auto-generated via CLI)
│   ├── layout/          # Header, Footer, Navigation
│   ├── features/        # Feature-specific (ComponentShowcase, etc.)
│   └── shared/          # Reusable (ThemeToggle, etc.)
├── layouts/
│   └── Layout.astro     # Base layout with SEO
├── pages/
│   ├── index.astro      # Landing page
│   └── playground.astro # Component playground
├── styles/
│   └── global.css       # Tailwind + basalt-ui imports
└── lib/
    ├── utils.ts         # cn() helper for ShadCN
    └── theme-store.ts   # Nanostores theme state
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

Theme: `.dark` class on `<html>`, state via Nanostores

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
bunx @biomejs/biome check --write apps/web/  # Format
bunx @biomejs/biome check apps/web/          # Check only
```

**Workflow:**
1. Make changes to components/pages
2. Check `package.json` for validation commands
3. Run build to verify no type errors
4. Format before committing
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

**Biome + Astro:**
- Biome doesn't understand Astro's template syntax (HTML below `---`)
- The following are disabled for `.astro` files in root `biome.json`:
  - `noUnusedVariables` and `noUnusedImports` (prevents false positives)
  - `organizeImports` (conflicts with Astro's frontmatter structure)
- Regular `.ts/.tsx` files still get full linting and import organization

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Astro over Next.js | Static-first, framework-agnostic showcase |
| Islands architecture | Optimal performance, ship minimal JS |
| Nanostores for theme | Lightweight (< 1kb), framework-agnostic |
| ShadCN copy-paste | Full customization, no dependency bloat |
| Path aliases `@/` | Matches monorepo convention, clean imports |
| React 19 | Latest stable, no forwardRefs needed |

## Testing Strategy (Future)

- Unit tests: Vitest for utility functions
- Component tests: Playwright for interactive components
- E2E tests: Playwright for user flows
- Visual regression: Storybook + Chromatic
