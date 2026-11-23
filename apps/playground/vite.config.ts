import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { compile } from '@mdx-js/mdx'
import { basaltViteConfig } from 'basalt-ui/vite'
import remarkGfm from 'remark-gfm'
import { fileURLToPath } from 'node:url'
import { mergeConfig } from 'vite'
import type { Plugin } from 'vite'
import { themeScript } from '../../packages/basalt-ui/src/css/theme-script'

// `basaltViteConfig` supplies the shared spine (React dedupe, strictPort dev
// server, the __APP_VERSION__ define). Plugins stay app-side — the preset deliberately ships none.
//
// `basaltSrc` aliases the `basalt-ui` import to the package's `src/`, so the playground exercises
// source directly (instant HMR, exact types) rather than the built `dist/`, per the repo contract
// that the playground is the everyday iteration surface on source.
const basaltSrc = fileURLToPath(new URL('../../packages/basalt-ui/src', import.meta.url))
const css = (file: string) =>
  fileURLToPath(new URL(`../../packages/basalt-ui/src/css/${file}`, import.meta.url))

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

// The pre-paint script an app gets from `basalt()`: the stored scheme and appearance land on <html>
// before the first paint, so a reload keeps the reader's accent, density and frame with no flash.
const bootScript = (): Plugin => ({
  name: 'playground-theme-script',
  transformIndexHtml: () => [{ tag: 'script', children: themeScript(), injectTo: 'head-prepend' }],
})

export default mergeConfig(
  basaltViteConfig({
    port: 7710,
    version: '1.0.0',
    basaltSrc,
    allowedHosts: ['basalt-playground.test', 'basalt-playground.mini.jkrumm.com'],
  }),
  {
    // `mergeConfig` puts the override's aliases BEFORE the preset's, which is what these two need:
    // the preset's `basalt-ui` -> `src/` alias is a prefix match that would otherwise shadow them
    // (`src/tailwind.css` does not exist — the sheets live in `src/css/` and ship as `dist/css/*`,
    // the paths a consumer's `@import 'basalt-ui/tailwind.css'` reaches).
    resolve: {
      alias: [
        {
          find: /^basalt-ui\/tailwind\.css$/,
          replacement: css('tailwind.css'),
        },
        { find: /^basalt-ui\/prose\.css$/, replacement: css('prose.css') },
        {
          find: /^basalt-ui\/table\.css$/,
          replacement: fileURLToPath(
            new URL('../../packages/basalt-ui/src/table/table.css', import.meta.url),
          ),
        },
        { find: /^basalt-ui\/tokens\.css$/, replacement: css('tokens.css') },
      ],
    },
    // tanstackRouter must precede the React plugin — it generates `src/routeTree.gen.ts` from the
    // `src/routes/` tree and rewrites route files for code-splitting before React's transform runs.
    plugins: [
      bootScript(),
      mdx(),
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
  },
)
