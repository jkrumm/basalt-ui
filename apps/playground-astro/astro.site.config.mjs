import mdx from '@astrojs/mdx'
import react from '@astrojs/react'
import { defineConfig } from 'astro/config'
import { basaltAstro, basaltShiki } from 'basalt-ui/astro'

// The site profile's page types (guide, article, post list, changelog) as a plain Astro site beside the
// matrix: basaltAstro() with its head scripts, so it builds apart from astro.config.mjs, whose pages must
// carry no script at all. `bun run build:site` writes dist-site/; scripts/site-pages.ts checks it.
// oxlint-disable-next-line import/no-default-export -- Astro loads its config from the default export
export default defineConfig({
  output: 'static',
  site: 'https://example.com',
  srcDir: './site',
  outDir: './dist-site',
  cacheDir: './.astro-site',
  prefetch: false,
  integrations: [react(), basaltAstro(), mdx()],
  markdown: { shikiConfig: basaltShiki },
  build: { inlineStylesheets: 'never' },
  devToolbar: { enabled: false },
})
