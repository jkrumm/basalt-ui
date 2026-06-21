// oxlint-disable import/no-default-export -- vite config requires a default export
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

export default mergeConfig(
  basaltViteConfig({
    port: 7714,
    version: '1.0.0',
    basaltSrc,
    allowedHosts: ['basalt-playground.test'],
  }),
  {
    plugins: [react()],
  },
)
