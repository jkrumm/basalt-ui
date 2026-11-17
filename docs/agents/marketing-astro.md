# Marketing app: Astro and React conventions

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
│   ├── global.css           # Tailwind + vendored basalt CSS
│   └── basalt/              # index.css (tokens), starlight.css (Starlight customCss)
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
  return <div>{prop}</div>
}
```

**Imports:**

```tsx
// Use @/ path aliases
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
import { Button } from '@/components/ui/button'

;<Button variant="outline" size="lg">
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
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  children: React.ReactNode
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

## Architecture Decisions

| Decision             | Rationale                                  |
| -------------------- | ------------------------------------------ |
| Astro over Next.js   | Static-first, framework-agnostic showcase  |
| Islands architecture | Optimal performance, ship minimal JS       |
| ShadCN copy-paste    | Full customization, no dependency bloat    |
| Path aliases `@/`    | Matches monorepo convention, clean imports |
| React 19             | Latest stable, no forwardRefs needed       |

## Testing Strategy (Future)

- Unit tests: Vitest for utility functions
- Component tests: Playwright for interactive components
- E2E tests: Playwright for user flows
- Visual regression: Storybook + Chromatic
