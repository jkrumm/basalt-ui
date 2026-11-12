// oxlint-disable import/no-default-export -- vite config requires a default export
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { basaltViteConfig } from 'basalt-ui/vite'
import { fileURLToPath } from 'node:url'
import { mergeConfig } from 'vite'

// `basaltViteConfig` supplies the shared spine (Mantine dedupe + optimizeDeps, strictPort dev
// server, the __APP_VERSION__ define). Plugins stay app-side — the preset deliberately ships none.
//
// `basaltSrc` aliases the `basalt-ui` import to the package's `src/`, so the playground exercises
// source directly (instant HMR, exact types) rather than the built `dist/`, per the repo contract
// that the playground is the everyday iteration surface on source.
const basaltSrc = fileURLToPath(new URL('../../packages/basalt-ui/src', import.meta.url))
const css = (file: string) =>
  fileURLToPath(new URL(`../../packages/basalt-ui/src/css/${file}`, import.meta.url))

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
        { find: /^basalt-ui\/tailwind\.css$/, replacement: css('tailwind.css') },
        { find: /^basalt-ui\/prose\.css$/, replacement: css('prose.css') },
        // The query survives the rewrite: `?inline` is how `demo/v3-tokens.ts` reads the sheet.
        { find: /^basalt-ui\/tokens\.css(\?inline)?$/, replacement: `${css('tokens.css')}$1` },
      ],
    },
    // tanstackRouter must precede the React plugin — it generates `src/routeTree.gen.ts` from the
    // `src/routes/` tree and rewrites route files for code-splitting before React's transform runs.
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  },
)
