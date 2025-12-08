import react from '@astrojs/react'
import starlight from '@astrojs/starlight'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  site: 'https://basalt-ui.com', // Update with actual domain when available
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

      // Bridge Starlight theme with basalt-ui
      customCss: ['./src/styles/starlight-custom.css'],

      expressiveCode: {
        themes: ['github-dark', 'github-light'],
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
