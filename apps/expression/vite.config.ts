import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { basalt } from 'basalt-ui/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// The plugin list `basalt-ui init --profile app` writes (router first, then react, tailwindcss,
// basalt). The one workspace difference from a consumer: `basalt-ui`'s
// script subpaths resolve to the package's `src/`, so a source edit reloads without a build. Its
// stylesheets (`basalt-ui/*.css`) resolve through the package exports to `dist/`, as in a consumer,
// and so does the graph `basalt()` reads for the peer gate and `.basalt/sources.css`: after a
// change to a package stylesheet or to the classes a part writes, run `bun run build` in
// packages/basalt-ui.
const basaltSrc = fileURLToPath(new URL('../../packages/basalt-ui/src', import.meta.url))

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
    port: 7712,
    strictPort: true,
  },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    basalt(),
  ],
})
