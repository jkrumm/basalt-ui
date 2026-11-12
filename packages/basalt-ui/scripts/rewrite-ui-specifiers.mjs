#!/usr/bin/env bun
/**
 * Post-build: composites and sibling primitives reach a primitive by its published specifier.
 *
 * The source imports primitives relatively (`../ui/card` from a composite, `./button` from another
 * primitive), and the unbundled dist keeps those paths. A relative path cannot be aliased, so an
 * ejected primitive would be followed by nothing but the app's own code. This rewrites the EMITTED
 * dist (`*.js` from tsup and `*.d.ts` from tsc) so every reach into a primitive names
 * `basalt-ui/ui/<name>`, the specifier `basalt()` aliases and `tsconfig paths` redirect
 * (docs/v3/ARCHITECTURE.md section 4.1, "npm composites follow"):
 *   dist/cards/stat-card.js   '../ui/card'   -> 'basalt-ui/ui/card'
 *   dist/ui/sheet.js          './button'     -> 'basalt-ui/ui/button'
 * Only names with a seed (`src/ui/<name>.tsx`) are touched, so `./slots`, `./button.guard` and
 * every non-primitive path stay relative. Runs before `fix-esm-extensions`, on extensionless paths.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const DIST = join(ROOT, 'dist')
const UI = join(DIST, 'ui')

if (!existsSync(UI)) {
  console.error('rewrite-ui-specifiers: dist/ui not found; run the build first')
  process.exit(1)
}

const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const seeds = new Set(
  readdirSync(join(ROOT, 'src/ui'))
    .filter((f) => f.endsWith('.tsx') && !f.endsWith('.test.tsx'))
    .map((f) => f.slice(0, -'.tsx'.length))
    .filter((name) => NAME.test(name)),
)

/** `from '…'`, `import('…')` and bare `import '…'` with a relative specifier. */
const SPEC = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])(\.\.?\/[^'"]*)\2/g

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.js') || p.endsWith('.d.ts')) out.push(p)
  }
  return out
}

let rewrites = 0
let touched = 0
for (const file of walk(DIST)) {
  const src = readFileSync(file, 'utf8')
  const next = src.replace(SPEC, (match, kw, q, spec) => {
    const target = resolve(dirname(file), spec)
    const name = basename(target)
    if (dirname(target) !== UI || !seeds.has(name)) return match
    rewrites++
    return `${kw}${q}basalt-ui/ui/${name}${q}`
  })
  if (next !== src) {
    writeFileSync(file, next)
    touched++
  }
}

console.log(`rewrite-ui-specifiers: ${rewrites} specifiers rewritten across ${touched} files`)
