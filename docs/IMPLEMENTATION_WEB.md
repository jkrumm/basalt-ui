Immediate Next Steps (High Value, Quick Wins)

1. Showcase Pages (Like Typography)

Create visual demos to validate and iterate the design:

apps/web/src/pages/
├── colors.astro          # Color palette with OKLCH values, contrast ratios
├── spacing.astro         # Spacing scale visual examples
├── components.astro      # Button, Card, Alert examples
├── examples/
│   ├── dashboard.astro   # Full dashboard layout
│   ├── landing.astro     # Marketing page example
│   └── blog.astro        # Content-heavy page

Why: You'll immediately see if colors/spacing work in real layouts, catch issues early.

2. Core ShadCN Components Package (Smart!)

Your instinct is right - provide pre-configured components:

packages/basalt-ui-react/
├── src/
│   ├── button.tsx        # ShadCN Button with Basalt defaults
│   ├── card.tsx          # Already using this
│   ├── alert.tsx         # Destructive/Primary variants
│   ├── input.tsx         # Form controls
│   └── index.ts
├── CLAUDE.md             # React-specific patterns
└── README.md             # "Use with Astro/Next/Remix"

Export strategy:
// Pre-configured with Basalt variants
export const Button = ({ variant = "primary", ...props }) => {
return <ShadcnButton variant={variant} {...props} />
}

// Users just: import { Button } from 'basalt-ui-react'

For non-React users: Document the markup patterns:
## Using Without React

Basalt UI components are React-based, but you can recreate them:

### Button
  ```html
  <button class="bg-primary text-primary-foreground px-4 py-2 rounded font-bold">
    Click Me
  </button>

  Use this markup in Vue, Svelte, Astro, vanilla JS, etc.

  ## Medium-Term (Foundation for Growth)

  ### 3. **Migrate to Starlight** ✨
  This is the right move for a design system. Starlight is perfect for this:

  apps/docs/  (new Starlight site)
  ├── src/content/docs/
  │   ├── getting-started/
  │   │   ├── installation.md
  │   │   ├── quick-start.md
  │   │   └── philosophy.md
  │   ├── design-tokens/
  │   │   ├── colors.md
  │   │   ├── typography.md
  │   │   ├── spacing.md
  │   │   └── shadows.md
  │   ├── components/
  │   │   ├── button.mdx      # Live React examples!
  │   │   ├── card.mdx
  │   │   └── alert.mdx
  │   ├── examples/
  │   │   ├── dashboard.md
  │   │   └── landing-page.md
  │   └── guides/
  │       ├── without-react.md
  │       ├── shadcn-setup.md
  │       └── customization.md
```
  **Why Starlight:**
  - Built-in search, navigation, dark mode
  - MDX support (embed live React components)
  - Auto-generated sidebar from file structure
  - Mobile-friendly by default
  - Astro-native (you already know it)

  **Migration plan:**
  1. Keep current `apps/web` as playground/kitchen sink
  2. Create `apps/docs` with Starlight for official docs
  3. Link between them: "See live examples →" links to web app

  ### 4. **Example UIs to Validate System**
  Build these to stress-test your restrictions:

  **Dashboard Example:**
  - Sidebar navigation
  - Data tables
  - Charts (using chart-1 through chart-5)
  - Form inputs
  - Status badges
  → Tests: spacing scale, color system, component density

  **Landing Page Example:**
  - Hero with text-display
  - Feature cards with icons
  - Testimonials
  - CTA sections
  → Tests: typography scale, spacing, visual hierarchy

  **Blog/Content Example:**
  - Article layout
  - Syntax highlighted code blocks
  - Inline links, blockquotes
  - Image captions
  → Tests: semantic HTML styling, readability, prose

  ## Recommended Order

  ### Phase 1: Validate (1-2 weeks)
  1. ✅ Build **Colors showcase page** (validate OKLCH palette)
  2. ✅ Build **Spacing showcase page** (validate limited scale)
  3. ✅ Build **1-2 example UIs** (dashboard + landing)
  4. ✅ Iterate on colors/spacing based on real usage

  ### Phase 2: Components (1 week)
  5. ✅ Create `basalt-ui-react` package with 5-10 core components
  6. ✅ Document non-React usage patterns
  7. ✅ Add components showcase page

  ### Phase 3: Documentation (1-2 weeks)
  8. ✅ Set up Starlight in `apps/docs`
  9. ✅ Migrate key content from package README/CLAUDE.md
  10. ✅ Add installation, usage, customization guides
  11. ✅ Embed live component examples with MDX

  ### Phase 4: Polish (ongoing)
  12. ✅ Gather feedback from real projects
  13. ✅ Add more examples (forms, modals, navigation)
  14. ✅ Refinements to color/spacing based on usage
  15. ✅ Consider npm publish (when stable)

  ## Starlight Quick Start

  ```bash
  # Create docs site
  cd apps
  bun create astro@latest docs -- --template starlight

  # Configure to use basalt-ui
  cd docs
  bun add basalt-ui

  # In astro.config.mjs
  import starlight from '@astrojs/starlight'

  export default defineConfig({
    integrations: [
      starlight({
        title: 'Basalt UI',
        customCss: [
          // Import your design system
          '../../packages/basalt-ui/src/index.css',
        ],
        sidebar: [
          { label: 'Getting Started', link: '/getting-started/' },
          { label: 'Design Tokens', collapsed: true, items: [...] },
          { label: 'Components', collapsed: true, items: [...] },
        ],
      }),
    ],
  })
  ```

  My Recommendation

  Start with this sequence:

  1. Build 1 full example UI (dashboard or landing) → validates everything
  2. Create colors + spacing showcase pages → reference for yourself and users
  3. Extract 5 core components to basalt-ui-react → highest ROI
  4. Set up Starlight → proper docs foundation
  5. Iterate based on what breaks → real usage reveals issues

  The example UI will immediately show you what works and what doesn't. You'll discover:
  - "I need p-14!" → Add it or adjust design
  - "Ochre doesn't work for this" → Tweak OKLCH values
  - "I wish I had a gap-7" → Decide if needed

  Build real things first, document after you've validated the system works.

  Want me to help scaffold any of these next? (Color showcase page, first example UI, Starlight setup, or React
  components package?)