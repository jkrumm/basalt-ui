# ShadCN Integration Strategy for Basalt UI

Based on research into best practices for ShadCN in monorepos and design systems.

## Architecture Decision

**basalt-ui as Theme Layer + ShadCN as Components**

```
┌─────────────────────────────────────────────┐
│         basalt-ui (npm package)             │
│  - Tailwind preset (zinc colors)           │
│  - CSS tokens/variables                    │
│  - Base styles (normalize, typography)     │
│  - NO ShadCN components                    │
└─────────────────────────────────────────────┘
                    ↓ consumed by
┌─────────────────────────────────────────────┐
│           apps/web (Astro)                  │
│  - Imports basalt-ui theme                 │
│  - Runs: shadcn@latest add button          │
│  - Components use basalt-ui theme          │
│  - Acts as design lab                      │
└─────────────────────────────────────────────┘
                    ↓ demonstrates
┌─────────────────────────────────────────────┐
│      End Users (consuming apps)             │
│  1. npm install basalt-ui                  │
│  2. Configure Tailwind preset              │
│  3. Import CSS                             │
│  4. npx shadcn@latest add [component]      │
└─────────────────────────────────────────────┘
```

## Why This Approach?

### 1. ShadCN's Philosophy
- **Copy-paste model**: Components are copied into your codebase
- **Not a dependency**: You own the code
- **Customizable**: Theme through CSS variables

### 2. Design System Best Practices
From research on scalable design systems:
- **Separation of concerns**: Theme ≠ Components
- **Flexibility**: Users can pick which components they need
- **Customization**: Users can modify ShadCN components
- **Bundle size**: Users only get what they use

### 3. Monorepo Patterns
Based on NX/Turborepo + ShadCN examples:
- Shared UI package for **theme/design tokens**
- Apps add ShadCN components locally
- Theme propagates through Tailwind config

## Implementation Steps

### Phase 1: basalt-ui Package (Theme Layer)

**Purpose**: Provide the design system foundation

**Structure**:
```
packages/basalt-ui/
├── src/
│   └── index.css          # CSS variables, base styles
├── tailwind.preset.js     # Tailwind config
├── package.json
└── README.md
```

**What it provides**:
```js
// tailwind.preset.js
module.exports = {
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        // ... more tokens
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui"],
        heading: ["var(--font-heading)"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
}
```

```css
/* src/index.css */
@import url('https://fonts.googleapis.com/css2?family=Lato:wght@600&family=Nunito+Sans:wght@400&family=JetBrains+Mono:wght@400&display=swap');

:root {
  /* Zinc-based color system */
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --primary: 0 0% 9%;
  --primary-foreground: 0 0% 98%;
  /* ... more tokens */

  /* Typography */
  --font-heading: "Lato", sans-serif;
  --font-body: "Nunito Sans", sans-serif;
  --font-mono: "JetBrains Mono", monospace;

  /* Radius */
  --radius: 0.5rem;
}

.dark {
  --background: 0 0% 3.9%;
  --foreground: 0 0% 98%;
  /* ... dark mode tokens */
}

/* Base styles */
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  font-family: var(--font-body);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}

code, pre {
  font-family: var(--font-mono);
}
```

### Phase 2: apps/web Setup

**Purpose**: Design lab to visualize and iterate on design system

**Setup**:
```bash
cd apps/web
bunx create-astro@latest

# Install integrations
bunx astro add tailwind react

# Add workspace dependency
# In apps/web/package.json:
{
  "dependencies": {
    "basalt-ui": "workspace:*"
  }
}
```

**Tailwind Config**:
```js
// apps/web/tailwind.config.mjs
import basaltPreset from 'basalt-ui/tailwind.preset'

export default {
  presets: [basaltPreset],
  content: [
    './src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}',
  ],
}
```

**Import CSS**:
```astro
---
// apps/web/src/layouts/Layout.astro
import 'basalt-ui/src/index.css'
---
```

**Add ShadCN**:
```bash
cd apps/web
bunx shadcn@latest init

# Prompts:
# - Style: new-york
# - Base color: zinc
# - CSS variables: yes
# - Where is your global CSS?: src/styles/globals.css (or wherever)
# - Configure components.json to use basalt-ui paths
```

**Add Components**:
```bash
bunx shadcn@latest add button
bunx shadcn@latest add card
bunx shadcn@latest add input
# etc.
```

These components will automatically:
- Use your basalt-ui theme tokens
- Be styled with zinc colors
- Follow your design system

### Phase 3: Iteration Workflow

**Development cycle**:
1. Tweak `packages/basalt-ui/src/index.css` (adjust tokens)
2. See changes instantly in `apps/web`
3. Test with ShadCN components
4. Iterate until satisfied
5. Document in web app

**Example iteration**:
```css
/* packages/basalt-ui/src/index.css */
:root {
  --primary: 220 70% 50%;  /* Change from zinc to blue */
}
```

→ All buttons in web app update immediately

### Phase 4: User Consumption

**End user workflow**:

1. **Install**:
```bash
npm install basalt-ui
```

2. **Configure Tailwind**:
```js
// tailwind.config.js
module.exports = {
  presets: [require('basalt-ui/tailwind.preset')],
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
}
```

3. **Import CSS**:
```js
// src/index.js or app.tsx
import 'basalt-ui/src/index.css'
```

4. **Add ShadCN components**:
```bash
npx shadcn@latest init
# Configure to use basalt-ui theme

npx shadcn@latest add button
```

Components automatically use Basalt UI theme!

## Advanced: Bundled Components (Optional v2)

After V0, you could optionally pre-bundle curated ShadCN components in basalt-ui:

```
packages/basalt-ui/
├── src/
│   ├── index.css
│   └── components/          # Pre-configured ShadCN components
│       ├── button.tsx
│       ├── card.tsx
│       └── input.tsx
├── tailwind.preset.js
└── package.json
```

Users then choose:
- **Option A**: Install basalt-ui, add ShadCN components themselves (flexible)
- **Option B**: Install basalt-ui with bundled components (convenient)

## Key Insights from Research

### From NX + ShadCN Example:
- ✅ Separate UI package for shared theme
- ✅ Apps run `shadcn add` locally
- ✅ Components auto-configure with theme

### From Turborepo + ShadCN Example:
- ✅ Use workspace protocol (`workspace:*`)
- ✅ Tailwind preset pattern
- ✅ CSS variables for theming

### From ShadCN Docs:
- ✅ Monorepo support built into CLI
- ✅ `components.json` configuration
- ✅ CSS variables mode recommended

### From Design System Best Practices:
- ✅ Theme as foundation, components as layer
- ✅ Flexibility over convenience (initially)
- ✅ Documentation as first-class feature

## components.json Setup

In `apps/web/components.json`:
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.mjs",
    "css": "src/styles/globals.css",
    "baseColor": "zinc",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

## FAQ

**Q: Why not bundle ShadCN components in basalt-ui from the start?**
A: ShadCN's philosophy is copy-paste. Users should own their components. Starting with just the theme keeps basalt-ui focused and flexible.

**Q: Can users customize components?**
A: Yes! They copy ShadCN components into their app and modify freely while keeping the basalt-ui theme.

**Q: What if I want to provide pre-configured components?**
A: V2 feature. After establishing the theme, you can bundle curated components as optional exports.

**Q: How do updates work?**
A: Theme updates: `npm update basalt-ui`
Components: Users re-run `shadcn add [component] --overwrite` or manually update.

**Q: Do I need to document ShadCN setup?**
A: Yes! Your docs should show:
- How to install basalt-ui
- How to add ShadCN components
- Which components work well together
- Customization examples

## Next Steps

1. ✅ Implement basic basalt-ui theme (Phase 3 of main plan)
2. ✅ Set up web app with ShadCN (Phase 4)
3. ✅ Iterate on design while seeing it live (Phase 5)
4. ✅ Document the pattern (Phase 8)
5. 🔮 Consider bundled components in V2

## References

- [ShadCN Monorepo Docs](https://ui.shadcn.com/docs/monorepo)
- [Turborepo + ShadCN Guide](https://www.nihardaily.com/94-mastering-shadcn-monorepo-with-turbo-repo-complete-guide-for-scalable-ui-development)
- [NX + ShadCN Example](https://medium.com/@sakshijaiswal0310/building-a-scalable-react-monorepo-with-nx-and-shadcn-ui-a-complete-implementation-guide-96c2bb1b42e8)
- [Design System Best Practices](https://mehd.ir/posts/building-a-scalable-design-system-with-tailwind-and-shadcnui)
