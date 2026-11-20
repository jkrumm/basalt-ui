import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'astro/config'

// Static output only: every page is built once and measured from dist (scripts/measure.ts).
// Stylesheets are always files, never inlined, so the matrix reads one CSS cost per page.
// oxlint-disable-next-line import/no-default-export -- Astro loads its config from the default export
export default defineConfig({
  output: 'static',
  integrations: [react()],
  build: { inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
  vite: { plugins: [tailwindcss()] },
})
