import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// S0: a plain Vite + React config is enough to prove the `workspace:*` link to
// basalt-ui resolves and the playground builds. Once the package ships real UI
// (S2+), this adopts `basaltViteConfig` from `basalt-ui/vite` and a source alias
// for HMR-on-package-source.
export default defineConfig({
  plugins: [react()],
  server: { port: 4319, strictPort: true },
})
