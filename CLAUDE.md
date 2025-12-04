# Basalt UI - Project Context

Framework-agnostic Tailwind CSS design system with zinc-based colors.

**Package (basalt-ui)**: Pure Tailwind preset + CSS tokens (works with any framework)
**Docs/Playground (apps/web)**: Astro + React + ShadCN for demos

## IMPORTANT: Working Instructions

**DO NOT** automatically start executing tasks from `docs/IMPLEMENTATION.md` unless explicitly asked. Only perform the specific tasks that the user requests. The implementation plan is for reference and context, not a directive to execute autonomously.

## Tech Stack

- **Runtime**: Bun (not Node/npm)
- **Monorepo**: Bun workspaces (`packages/*`, `apps/*`)
- **TypeScript**: Strict mode, all exports typed
- **Linting**: Biome (not ESLint/Prettier)
- **Git**: Conventional commits enforced via commitlint
- **Theme**: Tailwind v4 (not v3 - important!)
- **Components**: ShadCN (copy-paste, not dependency)
- **Fonts**: Google Fonts (not self-hosted)

## Structure

```
basalt-ui/
├── packages/basalt-ui/    # Theme package (framework-agnostic)
├── apps/web/              # Astro + React docs site
├── CLAUDE.md              # You are here
└── docs/                  # Implementation plans
```

## Commands

**Root:**
```bash
bun install                # Install all workspaces
bun run dev                # Start web app
bun run release            # Create release (local only)
```

**Package (packages/basalt-ui):**
```bash
bun run build             # Build package
bun run test              # Run tests
```

**Web (apps/web):**
```bash
bun run dev               # Dev server
bun run build             # Production build
```

**Code Quality:**
```bash
bunx @biomejs/biome check .                    # Check all
bunx @biomejs/biome check --write .            # Fix all
bunx commitlint --edit <file>                  # Validate commit msg
```

## MCP Tool Guidelines

**Perplexity** (`@perplexity-ai/mcp-server`):
- High-level architectural analysis
- Broad concept summaries

**Tavily** (`tavily-mcp`):
- Deep dives into specific webpages
- Extract granular technical details

**Context7** (`https://mcp.context7.com/mcp`):
- Up-to-date library documentation
- API references

## Critical Rules

### TypeScript

**IMPORTANT**: Strict TypeScript. No `any`, no implicit types.

✅ **Correct:**
```typescript
export function createTheme(colors: Record<string, string>): ThemeConfig {
  return { colors }
}
```

❌ **Wrong:**
```typescript
export function createTheme(colors) {  // Missing types
  return { colors }
}
```

### Tailwind v4 (Not v3!)

**Key differences from v3:**
- CSS-first configuration (`@theme` directive)
- No `tailwind.config.js` plugins section
- `@import "tailwindcss"` instead of `@tailwind` directives
- Native CSS variables, not JIT

✅ **Correct (v4):**
```css
@import "tailwindcss";

@theme inline {
  --color-primary: var(--primary);
}
```

❌ **Wrong (v3 syntax):**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### File Organization

**Package exports** - Always explicit:
```typescript
// packages/basalt-ui/src/index.ts
export * from './theme'
export * from './tokens'
```

**No default exports** - Named exports only:
```typescript
export function Button() {}     // ✅ Correct
export default function() {}    // ❌ Wrong
```

### ShadCN Integration

ShadCN components are **copied** into `apps/web`, not installed as dependency.

```bash
cd apps/web
bunx shadcn@latest add button
```

Components automatically use basalt-ui theme via Tailwind preset.

### Imports

**Workspace protocol** for internal deps:
```json
{
  "dependencies": {
    "basalt-ui": "workspace:*"
  }
}
```

**Path aliases** - Use `@/` for imports:
```typescript
import { Button } from '@/components/ui/button'  // ✅
import { Button } from '../../../components'     // ❌
```

## Code Style

### Naming Conventions

- **Files**: `kebab-case.ts` (not camelCase or PascalCase)
- **Components**: `PascalCase.tsx`
- **Functions**: `camelCase()`
- **Constants**: `UPPER_SNAKE_CASE`
- **CSS variables**: `--kebab-case`

### React Patterns

**Function components** only:
```typescript
export function Button({ children }: { children: React.ReactNode }) {
  return <button>{children}</button>
}
```

**No React.FC** or arrow functions for components.

### CSS Variables

**Follow convention** - Define in `:root` and `.dark`:
```css
:root {
  --background: hsl(0 0% 100%);
}

.dark {
  --background: hsl(0 0% 3.9%);
}

@theme inline {
  --color-background: var(--background);
}
```

## Git Workflow

**Branch**: `master` (not main)

**Commit format**:
```bash
feat: add button component
fix: correct dark mode colors
docs: update README
chore: release v0.1.0
```

**Pre-commit hooks** run automatically:
- Biome format + lint
- Commitlint validation

**Release process**:
1. `bun run release` (local)
2. Creates git tag + GitHub release
3. GitHub Action publishes to npm

## Common Issues

**"Module not found"**
→ Run `bun install` from root

**Biome errors**
→ Run `bunx @biomejs/biome check --write .`

**Wrong Tailwind version behavior**
→ Check you're using v4 syntax (see rules above)

**ShadCN component doesn't use theme**
→ Verify Tailwind config uses basalt-ui preset

## What NOT to Do

- ❌ Don't use `npm` or `pnpm` (use `bun`)
- ❌ Don't write Tailwind v3 syntax
- ❌ Don't install ShadCN as dependency
- ❌ Don't use ESLint/Prettier (use Biome)
- ❌ Don't commit to master directly
- ❌ Don't use default exports
- ❌ Don't use `any` in TypeScript
- ❌ Don't self-host fonts (use Google Fonts)

## Project Philosophy

1. **Framework-agnostic package** - basalt-ui works with any framework (React, Vue, Svelte, etc.)
2. **Theme only, no components** - Keep basalt-ui minimal
3. **React for our apps** - Web app uses Astro + React + ShadCN for demos
4. **Zinc-based colors** - Not stone, not gray
5. **Design by seeing** - Web app as design lab
6. **Progressive disclosure** - Build incrementally

## Documentation

See `/docs` for detailed plans:
- `IMPLEMENTATION.md` - Main implementation plan
- `SHADCN_INTEGRATION.md` - ShadCN architecture details

## Key Principles

- **Concise over verbose** - Less code is better
- **Examples over description** - Show, don't tell
- **TypeScript strict** - No shortcuts
- **Iterate fast** - See changes immediately in web app
- **Document decisions** - Update this file as needed
