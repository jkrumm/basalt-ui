#!/usr/bin/env bun
/**
 * Post-build ESM specifier fixer for the unbundled (`bundle: false`) dist.
 *
 * Node ESM (and NodeNext-mode consumers) require relative import specifiers to be
 * fully specified: a file import needs its `.js` extension, and a directory import
 * must point at `…/index.js`. tsup/esbuild with `bundle: false` transpiles each
 * module in place but leaves specifiers untouched, and the source is written
 * idiomatically (extensionless, bare directory imports) so the verbatim lift from
 * argo and go-to-definition into `src/` both stay clean.
 *
 * This rewrites the EMITTED dist only — both `*.js` (from tsup) and `*.d.ts` (from
 * tsc) — resolving every relative specifier against the files actually on disk:
 *   './palette'      -> './palette.js'        (sibling file exists)
 *   '../../tokens'   -> '../../tokens/index.js' (directory barrel)
 * Specifiers that already carry an extension (.js/.mjs/.css/.json) are left alone,
 * so `*.module.css` imports (S4) pass through verbatim. Resolution is filesystem-
 * checked, never regex-guessed, so it cannot mis-rewrite an ambiguous path.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'

const DIST = resolve(import.meta.dirname, '..', 'dist')

if (!existsSync(DIST)) {
  console.error('fix-esm-extensions: dist/ not found — run the build first')
  process.exit(1)
}

/** Match the quoted specifier of `from '…'`, `import('…')`, and bare `import '…'`. */
const SPEC = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.\.?\/[^'"]*)\2/g
const HAS_EXT = /\.(js|mjs|cjs|json|css)$/

/** For a dist file, the on-disk target a specifier should resolve to. */
function resolveSuffix(fromFile, spec, isDts) {
  const fileExt = isDts ? '.d.ts' : '.js'
  const emit = isDts ? '/index.js' : '/index.js' // specifier is always .js even in .d.ts
  const base = resolve(dirname(fromFile), spec)
  if (existsSync(base + fileExt)) return spec + '.js'
  if (existsSync(join(base, `index${fileExt}`))) return spec + emit
  // Fallback: a .js sibling may exist even when checking from a .d.ts (rare); try both.
  if (existsSync(base + '.js')) return spec + '.js'
  if (existsSync(join(base, 'index.js'))) return spec + '/index.js'
  return null
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.js') || p.endsWith('.d.ts')) out.push(p)
  }
  return out
}

let touched = 0
let rewrites = 0
const unresolved = []

for (const file of walk(DIST)) {
  const isDts = file.endsWith('.d.ts')
  const src = readFileSync(file, 'utf8')
  let changed = false
  const next = src.replace(SPEC, (match, kw, q, spec) => {
    if (HAS_EXT.test(spec)) return match
    const fixed = resolveSuffix(file, spec, isDts)
    if (!fixed) {
      unresolved.push(`${file}: ${spec}`)
      return match
    }
    if (fixed !== spec) {
      changed = true
      rewrites++
    }
    return `${kw}${q}${fixed}${q}`
  })
  if (changed) {
    writeFileSync(file, next)
    touched++
  }
}

console.log(`fix-esm-extensions: ${rewrites} specifiers rewritten across ${touched} files`)
if (unresolved.length) {
  console.error(`fix-esm-extensions: ${unresolved.length} unresolved relative specifiers:`)
  for (const u of unresolved) console.error('  ' + u)
  process.exit(1)
}
