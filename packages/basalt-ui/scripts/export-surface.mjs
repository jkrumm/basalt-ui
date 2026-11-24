/**
 * Export-surface snapshot — imports the BUILT dist/ entry of every published JS subpath and
 * compares `Object.keys()` (sorted) against the shards in scripts/export-surface/ (one JSON file per
 * subpath, see export-surface-shards.mjs). Catches a named export
 * that exists in a source module but was dropped by a barrel (BP/p at 1.0.0) — publint/attw
 * validate the export MAP, not named-export completeness, so they cannot catch this class.
 *
 * Modes:
 *   --update            rewrite the drifted shards (and delete orphans) from the current build (run
 *                       `bun run build` first); shards that already match are not touched
 *   --shards <dir>      shard directory (default: this repo's scripts/export-surface)
 *   --base <dir>        package root whose dist/ to import (default: this repo's package;
 *                       pack-test passes the scratch consumer's node_modules/basalt-ui)
 *
 * Run under `node --import scripts/css-noop-register.mjs` so CSS-module imports load as no-ops.
 * Entries are imported as direct file URLs, so resolution is independent of cwd and of the
 * importing script's own node_modules chain.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { diffShards, readShards, serializeShard, shardFile } from './export-surface-shards.mjs'

const OWN_PKG_ROOT = fileURLToPath(new URL('../', import.meta.url))

const args = process.argv.slice(2)
const update = args.includes('--update')
const baseFlag = args.indexOf('--base')
const baseDir = baseFlag !== -1 ? resolve(args[baseFlag + 1]) : OWN_PKG_ROOT
const shardsFlag = args.indexOf('--shards')
const shardsDir =
  shardsFlag !== -1
    ? resolve(args[shardsFlag + 1])
    : resolve(OWN_PKG_ROOT, 'scripts/export-surface')

const exportsMap = JSON.parse(readFileSync(resolve(baseDir, 'package.json'), 'utf8')).exports
const UI_WILDCARD = './ui/*'

/**
 * The `ui/<name>` primitive modules: the keys of `SLOTS` in the built `ui/slots.js`, which gen-ui
 * writes from `src/ui/*.tsx` (tests and guards left out). Read from dist, so it holds for the
 * scratch consumer pack-test points `--base` at.
 */
async function uiModules() {
  const slots = resolve(baseDir, exportsMap[UI_WILDCARD].import.replace('*', 'slots'))
  const { SLOTS } = await import(pathToFileURL(slots).href)
  return Object.keys(SLOTS).toSorted()
}

/**
 * Every published JS subpath — non-JS assets (`.css`, `.astro`, `./configs/*`) and the `./core/*` eject paths
 * have no snapshot of their own. `./ui/*` expands to one subpath per primitive module, so a symbol
 * added to or dropped from one is a shard diff.
 */
const subpaths = (
  await Promise.all(
    Object.keys(exportsMap)
      .filter((k) => !k.startsWith('./configs') && !k.endsWith('.css') && !k.endsWith('.astro'))
      .filter((k) => exportsMap[k] !== null && !k.startsWith('./core/'))
      .flatMap(async (k) => {
        if (k === UI_WILDCARD) return (await uiModules()).map((name) => `./ui/${name}`)
        return k.includes('*') ? [] : [k]
      }),
  )
).flat()

const actual = {}
for (const subpath of subpaths) {
  const entry = exportsMap[subpath] ?? exportsMap[UI_WILDCARD]
  const rel = (typeof entry === 'string' ? entry : entry.import).replace(
    '*',
    subpath.slice('./ui/'.length),
  )
  const mod = await import(pathToFileURL(resolve(baseDir, rel)).href)
  actual[subpath] = Object.keys(mod)
    .filter((k) => k !== 'default')
    .toSorted()
}

const expected = readShards(shardsDir)
const failures = diffShards(expected, actual)

if (update) {
  mkdirSync(shardsDir, { recursive: true })
  const drifted = new Set(failures.map((f) => f.slice('export-surface/'.length, f.indexOf(': '))))
  for (const subpath of Object.keys(actual)) {
    if (drifted.has(shardFile(subpath))) {
      writeFileSync(resolve(shardsDir, shardFile(subpath)), serializeShard(actual[subpath]))
    }
  }
  for (const subpath of Object.keys(expected)) {
    if (!(subpath in actual)) rmSync(resolve(shardsDir, shardFile(subpath)))
  }
  console.log(
    `export-surface shards updated (${drifted.size} of ${subpaths.length} rewritten or removed) → ${shardsDir}`,
  )
  process.exit(0)
}

if (failures.length > 0) {
  console.error('export-surface snapshot mismatch:')
  for (const f of failures) console.error(`  ${f}`)
  console.error(
    'If intentional: node --import ./scripts/css-noop-register.mjs scripts/export-surface.mjs --update',
  )
  process.exit(1)
}
console.log(`export-surface snapshot OK (${subpaths.length} shards)`)
