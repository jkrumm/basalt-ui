# Basalt UI Implementation Plan

## Project Identity
- **Name:** Basalt UI
- **NPM:** `basalt-ui` (unscoped, published under `jkrumm`)
- **License:** Apache 2.0
- **Repo:** `github.com/jkrumm/basalt-ui`
- **Domain:** `basalt-ui.com`

## Architecture
```
basalt-ui/
├── packages/
│   └── basalt-ui/          # Theme package: Framework-agnostic Tailwind preset + CSS
├── apps/
│   └── web/                # Astro + React site: landing + docs + playground (uses ShadCN)
├── package.json            # Root: workspaces, release script
├── biome.json              # Root code quality
├── .releaserc.js           # Release automation
└── lefthook.yml            # Git hooks
```

## Framework & Component Strategy

**basalt-ui package (framework-agnostic):**
- Tailwind preset (zinc colors, tokens, fonts)
- CSS variables for theming
- Base styles (normalize, typography)
- Works with **any framework** (React, Vue, Svelte, vanilla, etc.)
- Does NOT include components - pure theme

**apps/web (Astro + React + ShadCN):**
- Uses basalt-ui theme
- Adds ShadCN components (React) via CLI for demos
- Acts as design lab to iterate and visualize design system

**User workflow:**
1. Install: `npm install basalt-ui`
2. Use theme in tailwind.config (any framework)
3. Import CSS
4. (Optional, React only) Add ShadCN components: `npx shadcn@latest add button`

---

## Phase 1: Foundation

### 1. Monorepo Setup
- [ ] Root `package.json`: `"private": true`, `"workspaces": ["packages/*", "apps/*"]`
- [ ] Create `packages/basalt-ui/` directory
- [ ] Create `apps/web/` directory
- [ ] Run `bun install` from root

### 2. Root Scripts & Config
In root `package.json`:
- [ ] `"dev:web"` → `bun --filter web dev`
- [ ] `"dev"` → `bun run dev:web`
- [ ] `"release"` → `release-it`
- [ ] Move release-it config INTO package.json under `"release-it"` key
- [ ] Move commitlint config INTO package.json under `"commitlint"` key

---

## Phase 2: Code Quality

### 3. Biome Setup
- [ ] `bun add --dev --exact @biomejs/biome` (root only)
- [ ] `bunx @biomejs/biome init` → creates root `biome.json`
- [ ] Configure `biome.json`:
  - `files.ignore`: `["packages/*/dist", "packages/*/build", "apps/*/dist"]`
  - Set formatter + linter rules

### 4. Git Hooks with Lefthook
- [ ] `bun add -D lefthook`
- [ ] Create `lefthook.yml`:
  ```yaml
  pre-commit:
    parallel: true
    commands:
      biome-check:
        glob: "*.{js,ts,cjs,mjs,jsx,tsx,json,jsonc}"
        run: bunx @biomejs/biome check --write --no-errors-on-unmatched {staged_files} && git update-index --again

  commit-msg:
    commands:
      commitlint:
        run: bunx commitlint --edit {1}
  ```
- [ ] `bunx lefthook install`

### 5. Commitlint
- [ ] `bun add -D @commitlint/cli @commitlint/config-conventional`
- [ ] Add commitlint config to root `package.json`:
  ```json
  "commitlint": {
    "extends": ["@commitlint/config-conventional"]
  }
  ```
- [ ] Test: try invalid commit message, verify rejection

---

## Phase 3: Basic Theme Package (basalt-ui)

### 6. Package Structure
In `packages/basalt-ui/`:
- [ ] Create `package.json`:
  - `"name": "basalt-ui"`
  - `"version": "0.1.0"`
  - `"license": "Apache-2.0"`
  - `"type": "module"`
  - `"exports"`: main CSS + Tailwind preset
  - `"publishConfig": { "access": "public" }`
  - `peerDependencies`: Tailwind CSS
- [ ] Create `src/` directory
- [ ] Create `CHANGELOG.md` (empty)
- [ ] Create basic `README.md` with install instructions

### 7. Tailwind Preset (Basic)
- [ ] Create `tailwind.preset.js`:
  - Export preset with zinc color scale
  - Define color tokens: background, foreground, primary, muted, border
  - Define font family variables (will populate later)
  - Define border radius tokens
  - Wire CSS variables: `--color-background: var(--background)` etc.

### 8. CSS Tokens (Basic)
- [ ] Create `src/index.css`:
  - Basic CSS variable definitions for light theme
  - Basic CSS variable definitions for dark theme (`.dark` selector)
  - Placeholder font variables (will configure later)
  - Basic zinc mappings

---

## Phase 4: Web App Setup (Design Lab)

### 9. Astro Initialization
- [ ] `cd apps/web`
- [ ] Initialize Astro project: `bunx create-astro@latest`
- [ ] Install integrations: `@astrojs/tailwind`, `@astrojs/react`
- [ ] Add workspace dependency: `"basalt-ui": "workspace:*"`
- [ ] Configure Tailwind to use basalt-ui preset
- [ ] Import basalt-ui CSS in root layout

### 10. ShadCN Setup in Web App
- [ ] Install ShadCN CLI: `bunx shadcn@latest init`
  - Style: new-york
  - Base color: zinc
  - CSS variables: yes
  - Configure paths to use basalt-ui theme
- [ ] Add initial components for testing:
  - `bunx shadcn@latest add button`
  - `bunx shadcn@latest add card`
  - `bunx shadcn@latest add input`

### 11. Basic Pages
- [ ] Create index page with:
  - Simple hero using ShadCN components
  - Theme toggle button (manipulates `.dark` class)
- [ ] Create `/playground` page:
  - Typography scale examples
  - Color palette display (zinc)
  - Component examples (buttons, cards, inputs)
- [ ] Verify theme works, components render correctly

---

## Phase 5: Design System Iteration

### 12. Typography & Fonts (Google Fonts)
Back in `packages/basalt-ui/`:
- [ ] Decide on exact font weights needed (Lato, Nunito Sans, JetBrains Mono)
- [ ] In `src/index.css`:
  - Add Google Fonts `@import` statements
  - Define font variables: `--font-heading`, `--font-body`, `--font-mono`
  - Set `body { font-family: var(--font-body); }`
  - Set `h1-h6 { font-family: var(--font-heading); }`
  - Set `code, pre { font-family: var(--font-mono); }`

In `apps/web`:
- [ ] Add Google Fonts preconnect in `<head>`
- [ ] Add `<link rel="preload">` for critical font weights
- [ ] Test font loading, verify no FOUT
- [ ] Document recommended preload tags in README

### 13. Refine Color System
In `packages/basalt-ui/`:
- [ ] Create detailed zinc token mappings (50-950)
- [ ] Fine-tune light theme values
- [ ] Fine-tune dark theme values
- [ ] Add accent/primary color (if needed beyond zinc)
- [ ] Test in web app playground, iterate until satisfied

### 14. Normalize / Reset
In `packages/basalt-ui/src/index.css`:
- [ ] Box-sizing reset (`*, *::before, *::after`)
- [ ] Margin/padding reset
- [ ] Typography scale (h1-h6, p, a, code, pre)
- [ ] List spacing
- [ ] Font smoothing
- [ ] Test across different browsers in web app

### 15. Build & Test Integration
- [ ] Add build script to basalt-ui package
- [ ] Test importing basalt-ui from web app
- [ ] Verify ShadCN components use basalt-ui theme correctly
- [ ] Test theme toggle works properly
- [ ] Verify no build errors

---

## Phase 6: Web App Content

### 16. Landing Page
- [ ] Hero section (branding, tagline)
- [ ] Features section (design system benefits)
- [ ] CTA (link to docs, GitHub)
- [ ] Footer (links, social)

### 17. Documentation Pages
- [ ] **Getting Started**: Install, Tailwind config, CSS import
- [ ] **Theming**: Token overview, zinc palette, CSS variables
- [ ] **Typography**: Font choices, scale, usage
- [ ] **Colors**: Palette, dark mode, customization
- [ ] **Components** (ShadCN): How to add, examples
- [ ] **Customization**: Overriding tokens, extending theme

### 18. Enhanced Playground
- [ ] Interactive component demos
- [ ] Code examples with copy button
- [ ] Theme switcher
- [ ] Color palette explorer
- [ ] Typography scale visualizer

---

## Phase 7: Release Setup

### 19. Release-it Configuration
- [ ] `bun add -D release-it @release-it/conventional-changelog`
- [ ] Add release-it config to root `package.json`:
  ```json
  "release-it": {
    "git": {
      "requireBranch": "master",
      "commitMessage": "chore: release v${version}",
      "tagName": "v${version}",
      "push": true
    },
    "github": {
      "release": true,
      "releaseName": "v${version}"
    },
    "npm": {
      "publish": false,
      "versionArgs": ["--workspaces-update=false"]
    },
    "plugins": {
      "@release-it/conventional-changelog": {
        "preset": "conventionalcommits",
        "infile": "packages/basalt-ui/CHANGELOG.md",
        "gitRawCommitsOpts": {
          "path": "packages/basalt-ui"
        },
        "preset": {
          "name": "conventionalcommits",
          "types": [
            { "type": "feat", "section": "Features" },
            { "type": "fix", "section": "Bug Fixes" },
            { "type": "docs", "section": "Documentation" },
            { "type": "style", "section": "Styling" },
            { "type": "refactor", "section": "Refactor" },
            { "type": "perf", "section": "Performance" },
            { "type": "test", "section": "Tests" },
            { "type": "build", "section": "Build System" },
            { "type": "ci", "section": "CI" },
            { "type": "chore", "section": "Other Changes" },
            { "type": "wip", "hidden": true }
          ]
        }
      }
    },
    "hooks": {
      "before:init": "git pull",
      "after:release": ["git pull", "echo Successfully released v${version}"]
    }
  }
  ```

### 20. GitHub Action
- [ ] Create `.github/workflows/publish.yml`:
  ```yaml
  name: Publish to npm

  on:
    release:
      types: [published]

  jobs:
    publish:
      runs-on: ubuntu-latest
      permissions:
        contents: read
        id-token: write
      steps:
        - uses: actions/checkout@v4
        - uses: oven-sh/setup-bun@v1
          with:
            bun-version: latest
        - run: bun install --frozen-lockfile
        - name: Publish
          working-directory: ./packages/basalt-ui
          run: |
            echo "//registry.npmjs.org/:_authToken=${{ secrets.NPM_TOKEN }}" > .npmrc
            bun publish --non-interactive --access public
          env:
            NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
  ```
- [ ] Add `NPM_TOKEN` to GitHub repo secrets

### 21. Release Process Documentation
- [ ] Document in README or CONTRIBUTING:
  - Trunk-based workflow on master
  - How to run `bun run release`
  - What happens (version bump → changelog → tag → GitHub release → npm publish)
  - Test with `bun run release --dry-run`

---

## Phase 8: Documentation & Polish

### 22. Design System Documentation
Create in `/docs`:
- [ ] Color mapping table (zinc 50-950 → design tokens)
- [ ] Typography scale specification
- [ ] Spacing philosophy
- [ ] Component guidelines (how to use with ShadCN)

### 23. Package README
In `packages/basalt-ui/README.md`:
- [ ] Installation instructions
- [ ] Quick start (Tailwind config + CSS import)
- [ ] Using with ShadCN
- [ ] Google Fonts setup
- [ ] Dark mode usage
- [ ] Customization guide
- [ ] Examples

### 24. Root README
- [ ] Project overview
- [ ] Monorepo structure explanation
- [ ] Development workflow
- [ ] Contributing guidelines
- [ ] Links to docs site

---

## Implementation Notes

### Tailwind Preset Usage
```js
// Consumer tailwind.config.js
module.exports = {
  presets: [require('basalt-ui/tailwind.preset')],
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
}
```

### Framework-Agnostic Usage
```bash
# basalt-ui works with ANY framework
npm install basalt-ui

# Configure Tailwind with preset (works everywhere)
# Import CSS (works everywhere)
```

### ShadCN Integration (React Only - Optional)
```bash
# If using React, you can optionally add ShadCN components
# They will automatically use basalt-ui theme
npx shadcn@latest add button
```

### Font Strategy (Google Fonts)
```html
<!-- In your app's <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Lato:wght@600&family=Nunito+Sans:wght@400&family=JetBrains+Mono:wght@400&display=swap">
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@600&family=Nunito+Sans:wght@400&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
```

Or in CSS:
```css
@import url('https://fonts.googleapis.com/css2?family=Lato:wght@600&family=Nunito+Sans:wght@400&family=JetBrains+Mono:wght@400&display=swap');
```

### Dark Mode Contract
- basalt-ui provides CSS variables for `.dark` selector
- Apps toggle `.dark` class on `<html>` or `<body>`
- Apps handle localStorage persistence

### Release Flow
1. Work on master (trunk-based)
2. `bun run release` when ready
3. release-it: version bump → changelog → tag → GitHub release
4. GitHub Action: npm publish

### Config Philosophy
- Store configs in package.json where possible (release-it, commitlint)
- Keep separate files only when necessary (biome, lefthook need their own files)

---

## V0 Milestone Checklist

Minimal shippable version:
- [ ] Bun monorepo working
- [ ] basalt-ui package: Tailwind preset + CSS tokens + dark/light
- [ ] Typography system (Google Fonts, basic scale)
- [ ] Normalize/reset layer
- [ ] Web app: landing page + basic docs
- [ ] ShadCN components in web app working with theme
- [ ] Theme toggle functioning
- [ ] Git hooks working (Biome + commitlint)
- [ ] Release workflow tested (dry-run)
- [ ] READMEs with install + quick start

After V0:
- [ ] Expand component examples in web app
- [ ] Add interactive playground features
- [ ] Comprehensive documentation
- [ ] Consider: Bundle finalized ShadCN components in basalt-ui for easier distribution
- [ ] Blog/showcase section
- [ ] Community templates
