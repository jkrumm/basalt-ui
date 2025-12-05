# Basalt UI - Project Context

Framework-agnostic Tailwind CSS design system with zinc-based colors.

**Package (basalt-ui)**: Pure Tailwind preset + CSS tokens (works with any framework)
**Docs/Playground (apps/web)**: Astro + React + ShadCN for demos

## IMPORTANT: Working Instructions

**DO NOT** automatically start executing tasks from `docs/IMPLEMENTATION.md` unless explicitly asked. Only perform the specific tasks that the user requests. The implementation plan is for reference and context, not a directive to execute autonomously.

## Critical Rules (READ FIRST)

- **Runtime**: Bun (not npm/pnpm)
- **TypeScript**: Strict mode, no `any`, type inference preferred
- **Tailwind**: v4 syntax (`@import`, `@theme`, NOT v3 `@tailwind` directives)
- **Git**: Conventional commits, `master` branch (not main)
- **ShadCN**: Copy-paste pattern (not npm dependency)
- **Formatting**: Biome (JS/TS/JSON/CSS) + Prettier (Astro + Tailwind sorting)
- **Linting**: Biome only (no ESLint)
- **Validation**: Check `package.json`, run type-check/build + format
- **Code Style**: Typed object params, low nesting, early returns

## Tech Stack

- **Runtime**: Bun (not Node/npm)
- **Monorepo**: Bun workspaces (`packages/*`, `apps/*`)
- **TypeScript**: Strict mode, all exports typed
- **Formatting**: Biome (JS/TS/JSON/CSS) + Prettier (Astro)
- **Linting**: Biome only (no ESLint)
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

## Documentation Structure

This monorepo uses hierarchical CLAUDE.md files:

- **Root `CLAUDE.md`** (this file) - Monorepo-wide conventions
  - Bun workspace management
  - Biome, commitlint, lefthook configuration
  - Git workflow (trunk-based, conventional commits)
  - Package management rules
  - Release process

- **`packages/basalt-ui/CLAUDE.md`** (future) - Theme package conventions
  - Tailwind v4 preset architecture
  - CSS token system
  - Framework-agnostic patterns

- **`apps/web/CLAUDE.md`** - Web app specific conventions
  - Astro + React patterns
  - ShadCN integration
  - Islands architecture
  - Performance & SEO guidelines

Each workspace's CLAUDE.md focuses on its specific concerns while this root file covers shared monorepo infrastructure.

## Commands

**Root:**
```bash
bun install                # Install all workspaces
bun run dev                # Start web app
bun run pre                # Run format + lint + typecheck (pre-commit)
bun run typecheck          # Type-check all workspaces
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
bun run format                                  # Format all (Biome + Prettier)
bun run format:biome                            # Format with Biome only
bun run format:prettier                         # Format Astro files with Prettier
bun run lint                                    # Lint with Biome
bun run pre                                     # Full validation (format + lint + typecheck)
bunx commitlint --edit <file>                   # Validate commit msg
```

## Validation & Quality Workflow

**Available Commands**:
- `bun run pre` - **Recommended**: Format + lint + typecheck all workspaces
- `bun run format` - Format all files (Biome + Prettier)
- `bun run format:biome` - Format JS/TS/JSON/CSS with Biome
- `bun run format:prettier` - Format Astro files with Prettier
- `bun run lint` - Lint all files with Biome
- `bun run typecheck` - Type-check all workspaces with TypeScript
- Individual workspace: `cd apps/web && bun run typecheck`

**Workflow:**
1. Make changes
2. Run `bun run pre` to validate everything
3. Fix any errors in changed files only
4. Commit with conventional format

**Rule**: Don't refactor untouched code. User validates running apps manually.

## Hybrid Tooling Strategy

This project uses a **dual-formatter approach** for optimal results:

### Why Hybrid?

1. **Biome**: 25x faster formatting for 90% of files (JS/TS/JSON/CSS)
2. **Prettier**: Better Astro formatting + official Tailwind class sorting plugin
3. **Best of both worlds**: Speed where it matters, quality where it's needed

### Tool Responsibilities

| File Type | Formatting | Linting | Type Checking |
|-----------|------------|---------|---------------|
| `.ts/.tsx` (React components) | Biome | Biome (full) | tsc |
| `.astro` files | Prettier + Tailwind plugin | Biome (JS/TS portions) | astro check |
| `.json` | Biome | Biome | - |
| `.css` | Biome | Biome | - |

### Prettier Configuration

**What Prettier handles**:
- ✅ Astro file formatting (frontmatter + template)
- ✅ Tailwind CSS class sorting (via prettier-plugin-tailwindcss)
- ✅ Import organization in Astro files (understands Astro syntax)
- ❌ Does NOT format JS/TS/JSON/CSS (Biome handles these)

**Files**: `.prettierrc` and `.prettierignore` at monorepo root

### Biome Configuration

**What Biome handles**:
- ✅ Fast formatting for JS/TS/JSX/TSX/JSON/CSS
- ✅ Linting all file types (340+ rules)
- ✅ Import organization (except Astro files)
- 🟡 Partial linting of Astro files (JS/TS portions only, relaxed rules)

**File**: `biome.json` at monorepo root

**Astro-specific overrides**:
- `noUnusedVariables`: `off` (Biome doesn't understand Astro template syntax)
- `noUnusedImports`: `off` (Prettier handles imports)
- `organizeImports`: `off` (Prettier handles organization)

### Pre-commit Hooks

Lefthook automatically runs the appropriate tool:
- `biome-check-js`: JS/TS/JSX/TSX files → Biome
- `biome-check-json`: JSON files → Biome
- `biome-check-css`: CSS files → Biome
- `prettier-astro`: Astro files → Prettier (includes Tailwind sorting)

### Migration Notes

**From**: Pure Biome setup with experimental Astro support
**To**: Biome + Prettier hybrid for better Astro handling

**Key improvements**:
- Tailwind class sorting now works automatically
- Better Astro import organization (no false positives)
- Consistent formatting across all file types
- Minimal performance impact (Prettier only runs on `.astro` files)

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

## Development Guidelines

### Package Management

Never hardcode versions in `package.json`. Use `bun add` commands:

```bash
✅ bun add -D @biomejs/biome          # Gets latest
✅ bun add -D --exact @biomejs/biome  # Gets exact latest

❌ Manual edit: "@biomejs/biome": "^1.9.4"  # Don't do this
```

### TypeScript

Strict mode. No `any`, explicit types on all exports.

```typescript
✅ export function createTheme(colors: Record<string, string>): ThemeConfig
❌ export function createTheme(colors)  // Missing types
```

### Tailwind v4 (Not v3!)

Use v4 syntax with `@import` and `@theme`, NOT v3 `@tailwind` directives.

```css
✅ v4: @import "tailwindcss"; @theme inline { --color-primary: var(--primary); }
❌ v3: @tailwind base; @tailwind components; @tailwind utilities;
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
