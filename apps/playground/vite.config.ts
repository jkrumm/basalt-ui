import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { compile } from '@mdx-js/mdx'
import { basalt } from 'basalt-ui/vite'
import remarkGfm from 'remark-gfm'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

// The plugin list `basalt-ui init --profile app` writes (router first, then react, tailwindcss,
// basalt), plus the MDX compile below. The one workspace difference from a consumer: `basalt-ui`'s
// script subpaths resolve to the package's `src/`, so a source edit reloads without a build. Its
// stylesheets (`basalt-ui/*.css`) resolve through the package exports to `dist/`, as in a consumer,
// and so does the graph `basalt()` reads for the peer gate and `.basalt/sources.css`: after a
// change to a package stylesheet or to the classes a part writes, run `bun run build` in
// packages/basalt-ui.
const basaltSrc = fileURLToPath(new URL('../../packages/basalt-ui/src', import.meta.url))

// Authored `.mdx` is compiled here, at build time, into a module; MDX text is never evaluated at
// runtime. The output calls `react/jsx-runtime` directly, so it needs no JSX transform.
const mdx = (): Plugin => ({
  name: 'playground-mdx',
  enforce: 'pre',
  async transform(code, id) {
    if (!id.endsWith('.mdx')) return null
    const file = await compile(code, { remarkPlugins: [remarkGfm] })
    return { code: String(file), map: null }
  },
})

export default defineConfig({
  define: {
    // Package source reads `process.env.NODE_ENV` to fold its dev-only code; a consumer's dep
    // optimizer replaces it in dist, the source served here needs the define.
    'process.env.NODE_ENV': JSON.stringify(process.env['NODE_ENV'] ?? 'development'),
  },
  resolve: {
    alias: [{ find: /^basalt-ui(?=\/|$)(?!.*\.css$)/, replacement: basaltSrc }],
    // One React: the package's own dev install must not hand its source a second copy.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 7710,
    strictPort: true,
    allowedHosts: ['basalt-playground.test', 'basalt-playground.mini.jkrumm.com'],
  },
  plugins: [
    mdx(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    basalt(),
  ],
})
