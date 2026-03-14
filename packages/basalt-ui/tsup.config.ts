import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,
  outDir: 'dist',
  clean: true,
  external: [
    'react',
    'react/jsx-runtime',
    'react-dom',
    '@base-ui/react',
    '@base-ui/react/button',
    '@base-ui/react/checkbox',
    '@base-ui/react/merge-props',
    '@base-ui/react/menu',
    '@base-ui/react/radio',
    '@base-ui/react/radio-group',
    '@base-ui/react/switch',
    '@base-ui/react/use-render',
    '@tabler/icons-react',
    'class-variance-authority',
    'clsx',
    'tailwind-merge',
  ],
  sourcemap: false,
  treeshake: true,
})
