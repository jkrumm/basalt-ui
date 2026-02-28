import react from '@astrojs/react'
import starlight from '@astrojs/starlight'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'
import { FontaineTransform } from 'fontaine'

export default defineConfig({
  site: 'https://basalt-ui.com',
  integrations: [
    react(),
    starlight({
      title: 'Basalt UI',
      description: 'Framework-agnostic Tailwind CSS design system with zinc-based colors',

      // Sidebar navigation
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'docs/introduction' },
            { label: 'Installation', slug: 'docs/installation' },
          ],
        },
        {
          label: 'Design Tokens',
          items: [
            { label: 'Colors', slug: 'docs/colors' },
            { label: 'Typography', slug: 'docs/typography' },
            { label: 'Spacing', slug: 'docs/spacing' },
          ],
        },
      ],

      social: [
        {
          label: 'GitHub',
          icon: 'github',
          href: 'https://github.com/jkrumm/basalt-ui',
        },
      ],

      // Import basalt-ui tokens for Starlight pages
      // All Starlight CSS variable mappings defined in packages/basalt-ui/src/index.css
      customCss: ['../../packages/basalt-ui/src/starlight.css'],

      expressiveCode: {
        themes: ['github-dark', 'github-light'],
      },
    }),
  ],
  vite: {
    plugins: [
      tailwindcss(),
      // Generates calibrated @font-face fallback rules so text doesn't jump
      // when Instrument Sans and JetBrains Mono swap in (near-zero CLS).
      // resolvePath is required because @fontsource-variable URLs are
      // transformed by Vite — fontaine can't resolve them otherwise.
      FontaineTransform.vite({
        fallbacks: {
          'Instrument Sans Variable': ['Helvetica Neue', 'Segoe UI', 'Roboto', 'Arial'],
          'JetBrains Mono Variable': ['Consolas', 'Menlo', 'SF Mono', 'Courier New'],
        },
        resolvePath: (id) => new URL(`../../node_modules/${id}`, import.meta.url),
      }),
    ],
  },
})
