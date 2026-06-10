import { defineConfig } from 'tsup'

/**
 * Dist-first, unbundled build.
 *
 * - `bundle: false` transpiles each module in place instead of bundling, so the
 *   src/ tree is mirrored under dist/ and subpath exports resolve to real files.
 *   `bundle: false` ALONE only emits entry modules (tsup #1000) and drops CSS
 *   (tsup #1101), so the glob entry + `splitting: false` are required.
 * - `loader: { '.css': 'copy' }` copies any component-imported `.module.css`
 *   verbatim into dist next to its JS and rewrites the import path (the S4 CSS
 *   modules path). The standalone `src/styles.css` is not imported by any module,
 *   so the build script copies it explicitly.
 * - `dts: false` because tsc owns declarations (`--emitDeclarationOnly
 *   --declarationMap`); running both emitters fights (tsup #1366).
 *
 * tsup is in maintenance mode (upstream points to tsdown); the CSS-copy behavior
 * is the load-bearing piece and works today. Re-evaluate tsdown before S4's
 * heavier CSS-module work, behind the same pack-test.
 */
export default defineConfig({
  entry: ['src/**/*.{ts,tsx}'],
  format: ['esm'],
  bundle: false,
  splitting: false,
  dts: false,
  clean: true,
  outDir: 'dist',
  target: 'es2022',
  loader: { '.css': 'copy' },
})
