#!/usr/bin/env bun
/**
 * Mirror non-transpiled assets into the unbundled dist.
 *
 * tsup (bundle: false) emits only `.ts`/`.tsx`. Four asset classes are copied verbatim,
 * preserving the src/ tree, so the dist resolves:
 *   - `*.css`        — the standalone `styles.css` and the shell `*.module.css`.
 *     Their imports are left verbatim in the emitted JS; the consumer's bundler
 *     processes the `.module.css` as CSS modules and serves `styles.css`.
 *   - `*.module.css.d.ts` — the co-located CSS-module type declarations, so the
 *     emitted `*.d.ts` resolve the css imports self-containedly (no reliance on a
 *     consumer ambient `*.module.css` declaration).
 *   - `*.woff2`      — the faces in `css/files/`, which `fonts.css` and `styles.css` name relative
 *     to themselves.
 *   - `*.astro`      — `astro/BasaltFonts.astro`, published as `basalt-ui/astro/BasaltFonts.astro`;
 *     the consumer's Astro compiles it.
 */
import { readdirSync, statSync, mkdirSync, copyFileSync } from 'node:fs'
import { join, relative, dirname, resolve } from 'node:path'

const SRC = resolve(import.meta.dirname, '..', 'src')
const DIST = resolve(import.meta.dirname, '..', 'dist')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

let n = 0
for (const f of walk(SRC)) {
  if (
    f.endsWith('.css') ||
    f.endsWith('.css.d.ts') ||
    f.endsWith('.woff2') ||
    f.endsWith('.astro')
  ) {
    const dest = join(DIST, relative(SRC, f))
    mkdirSync(dirname(dest), { recursive: true })
    copyFileSync(f, dest)
    n++
  }
}
console.log(`copy-assets: ${n} asset files mirrored into dist`)
