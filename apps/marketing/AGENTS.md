# Basalt UI - Web App (Astro + React + Starlight)

**Inherits from**: `../../AGENTS.md` (monorepo conventions: Bun, Biome, TypeScript strict, Tailwind v4)
**This file adds**: Astro + React specific patterns and web app conventions

Documentation site and design playground for the Basalt UI design system.

Stale where it names Biome or Prettier: the root `AGENTS.md` (oxlint, oxfmt) wins there.

## Tech Stack

- **Framework**: Astro 5+ (static site generation)
- **Documentation**: Starlight (integrated at `/docs/*`)
- **UI Library**: React 19 (islands architecture)
- **Styling**: Tailwind CSS v4 + basalt-ui preset
- **Components**: ShadCN UI (copy-paste, not dependency)
- **TypeScript**: Strict mode with React JSX

## Validation & Development

```bash
# Build & Verify
bun run build            # Production build (astro build)
bun run typecheck        # astro check; also part of the root `bun run typecheck` and so of `bun run pre` and CI. Needs the root `overrides` pin of @emnapi/runtime (bun otherwise pairs @astrojs/astro2tsx with @emnapi/runtime 2.0.0-beta.2 and astro check crashes)
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
@import 'tailwindcss';

/* Import basalt-ui tokens from workspace using relative path */
@import '../../../../packages/basalt-ui/src/styles.css';
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

**Formatting + Linting:**

- `.astro` files are formatted by **Prettier** (better Astro support + Tailwind sorting)
- `.ts/.tsx` files are formatted by **Biome** (25x faster)
- All files are linted by **Biome**
- Prettier plugin automatically sorts Tailwind classes in Astro files
- Biome has relaxed rules for Astro files (`noUnusedVariables`: off, `noUnusedImports`: off)
- Reason: Biome doesn't understand Astro template syntax, causes false positives
- See root `AGENTS.md` for full hybrid tooling strategy

## Branches

- Before changing a page, layout or component under `src/`, Read `docs/agents/marketing-astro.md`: the project structure, the component and styling conventions, the architecture decisions.
- Before changing anything under `src/components/tremor/`, `src/lib/chartUtils.ts` or a chart in an `.astro` page, Read `docs/agents/marketing-tremor.md`.
- Before adding or editing a doc under `src/content/docs/` or `astro.config.mjs`, Read `docs/agents/marketing-starlight.md`.
