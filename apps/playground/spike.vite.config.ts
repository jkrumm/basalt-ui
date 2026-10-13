// oxlint-disable import/no-default-export -- vite config requires a default export
// Spike (W1 ledger): isolated per-variant library bytes. `SPIKE_ENTRY=src/spike/x.tsx vite build -c spike.vite.config.ts`.
// React and Mantine stay external (every basalt consumer already ships them); `SPIKE_BUNDLE_MANTINE_HOOKS=1` inlines @mantine/hooks.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const entry = process.env['SPIKE_ENTRY'] ?? ''
const inlineHooks = process.env['SPIKE_BUNDLE_MANTINE_HOOKS'] === '1'
const shared =
  process.env['SPIKE_EXTERNAL_STORE'] === '1' ? ['@tanstack/react-store', '@tanstack/store'] : []
const external = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@mantine/core',
  ...(inlineHooks ? [] : ['@mantine/hooks']),
  ...shared,
]

export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: `.spike-dist/${entry.replace(/\W+/g, '_')}${inlineHooks ? '_hooks' : ''}${shared.length > 0 ? '_nostore' : ''}`,
    emptyOutDir: true,
    minify: true,
    lib: { entry, formats: ['es'], fileName: 'out' },
    rolldownOptions: { external: (id) => external.some((e) => id === e || id.startsWith(`${e}/`)) },
  },
})
