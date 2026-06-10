import react from '@astrojs/react'
import starlight from '@astrojs/starlight'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, fontProviders } from 'astro/config'

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
        {
          label: 'Guides',
          items: [{ label: 'Astro Font Optimization', slug: 'docs/astro-fonts' }],
        },
      ],

      social: [
        {
          label: 'GitHub',
          icon: 'github',
          href: 'https://github.com/jkrumm/basalt-ui',
        },
      ],

      // Frozen vendored copy of basalt-ui 0.4.x Starlight CSS — pending the Mantine rebuild
      // All Starlight CSS variable mappings defined in ./src/styles/basalt/index.css
      customCss: ['./src/styles/basalt/starlight.css'],

      expressiveCode: {
        themes: ['github-dark', 'github-light'],
      },

      components: {
        Head: './src/components/starlight/Head.astro',
      },
    }),
  ],
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Instrument Sans',
      cssVariable: '--font-instrument-sans',
      weights: [400, 500, 600, 700],
      styles: ['normal'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains-mono',
      weights: [400, 500, 700],
      styles: ['normal'],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
