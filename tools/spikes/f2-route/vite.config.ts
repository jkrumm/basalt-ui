// oxlint-disable import/no-default-export -- vite config requires a default export
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))
const pkg = (path: string) => here(`../../../packages/basalt-ui/src/${path}`)

// Source files under packages/basalt-ui resolve bare imports from that package's own (absent)
// node_modules, which Vite reads as an optional peer and stubs. Pointing every dependency of this
// harness at its node_modules makes the source build the way an installed package would.
const deps = Object.keys(
  (
    JSON.parse(readFileSync(here('package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
  ).dependencies,
)
const TOOLING = new Set([
  'vite',
  'typescript',
  'playwright-core',
  '@vitejs/plugin-react',
  '@tailwindcss/vite',
])
const depAliases = deps
  .filter((name) => !TOOLING.has(name))
  .map((name) => ({
    find: new RegExp(`^${name.replace(/[/@.-]/g, '\\$&')}(/.*)?$`),
    replacement: `${here(`node_modules/${name}`)}$1`,
  }))

// The same prefix-to-source aliasing as apps/playground/vite.config.ts, narrowed to the twelve
// published subpaths of ARCHITECTURE section 3 that this route touches; the two stubs stand in for
// the subpaths whose `src` is still the 2.x shape.
export default {
  root: here('.'),
  logLevel: 'warn',
  resolve: {
    alias: [
      ...depAliases,
      { find: /^basalt-ui$/, replacement: here('stubs/root.ts') },
      { find: /^basalt-ui\/charts$/, replacement: here('stubs/charts.tsx') },
      { find: /^basalt-ui\/tailwind\.css$/, replacement: pkg('css/tailwind.css') },
      { find: /^basalt-ui\/tokens\.css$/, replacement: pkg('css/tokens.css') },
      { find: /^basalt-ui\/controls$/, replacement: here('stubs/controls.ts') },
      { find: /^basalt-ui\/table$/, replacement: here('stubs/table.ts') },
      { find: /^basalt-ui\/(ui\/[a-z-]+|router|data|page|cards)$/, replacement: pkg('$1') },
    ],
  },
  plugins: [react(), tailwindcss()],
}
