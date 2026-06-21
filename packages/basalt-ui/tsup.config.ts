// oxlint-disable import/no-default-export -- tsup requires a default export
import { defineConfig } from 'tsup'

/**
 * Dist-first, unbundled build.
 *
 * - `bundle: false` transpiles each module in place instead of bundling, so the
 *   src/ tree is mirrored under dist/ and subpath exports resolve to real files.
 *   `bundle: false` ALONE only emits entry modules (tsup #1000), so the glob
 *   entry + `splitting: false` are required.
 * - Under `bundle: false` esbuild does NOT follow imports, so the CSS-module
 *   imports in shell components are left verbatim in the emitted JS (the consumer's
 *   bundler — e.g. Vite — processes them as CSS modules). The `.css` files
 *   themselves are NOT touched by tsup; `scripts/copy-assets.mjs` mirrors every
 *   CSS file under src (and the co-located CSS-module type declarations) into dist
 *   so the preserved imports resolve. (A `.css` loader would be inert here and
 *   only risks rewriting the import to an asset path, which breaks CSS-module
 *   class maps — so it is deliberately absent.)
 * - The entry excludes declaration files: the per-file CSS-module `.d.ts`
 *   declarations end in `.ts` and would otherwise be transpiled into junk `.js`.
 * - `dts: false` because tsc owns declarations (`--emitDeclarationOnly
 *   --declarationMap`); running both emitters fights (tsup #1366).
 *
 * tsup is in maintenance mode (upstream points to tsdown); this unbundled +
 * manual-copy CSS path is tsup-stable, so the tsdown migration stays deferred
 * behind the pack-test.
 */
export default defineConfig({
  entry: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts', '!src/**/*.test.{ts,tsx}'],
  format: ['esm'],
  bundle: false,
  splitting: false,
  dts: false,
  clean: true,
  outDir: 'dist',
  target: 'es2022',
})
