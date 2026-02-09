import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

import * as path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(), // Must come before framework plugin
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
