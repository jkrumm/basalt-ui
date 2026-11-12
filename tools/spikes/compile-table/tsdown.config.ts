import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'tsdown'
import type { UserConfig } from 'tsdown'

const compiled = process.env.COMPILER === 'on'

const base: UserConfig = {
  entry: { entry: 'lib/entry.tsx' },
  outDir: compiled ? 'dist/on' : 'dist/off',
  format: 'esm',
  platform: 'browser',
  dts: false,
  clean: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: compiled
    ? [
        babel({
          include: [
            /packages[\\/]basalt-ui[\\/]src[\\/]/,
            /tools[\\/]spikes[\\/]compile-table[\\/]lib[\\/]/,
          ],
          // `core/state.ts` calls `handle.use()` and `store.use()`, hooks the compiler cannot see by name: it
          // memoizes them and React throws on the second render (docs/v3/spikes/compile-table.md, Measurements).
          exclude: [/node_modules/, /table[\\/]core[\\/]state\.ts$/],
          parserOpts: { plugins: ['typescript', 'jsx'] },
          plugins: [['babel-plugin-react-compiler', { target: '19' }]],
        }),
      ]
    : [],
}

// oxlint-disable-next-line import/no-default-export -- tsdown reads the default export
export default defineConfig(base)
