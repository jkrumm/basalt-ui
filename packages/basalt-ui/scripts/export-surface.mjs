/**
 * Export-surface snapshot — imports the BUILT dist/ entry of every published JS subpath and
 * compares `Object.keys()` (sorted) against scripts/export-surface.json. Catches a named export
 * that exists in a source module but was dropped by a barrel (BP/p at 1.0.0) — publint/attw
 * validate the export MAP, not named-export completeness, so they cannot catch this class.
 *
 * Modes:
 *   --update            rewrite the snapshot from the current build (run `bun run build` first)
 *   --base <dir>        package root whose dist/ to import (default: this repo's package;
 *                       pack-test passes the scratch consumer's node_modules/basalt-ui)
 *
 * Run under `node --import scripts/css-noop-register.mjs` so CSS-module imports load as no-ops.
 * Entries are imported as direct file URLs, so resolution is independent of cwd and of the
 * importing script's own node_modules chain.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const OWN_PKG_ROOT = fileURLToPath(new URL('../', import.meta.url))
const SNAPSHOT_PATH = resolve(OWN_PKG_ROOT, 'scripts/export-surface.json')

const args = process.argv.slice(2)
const update = args.includes('--update')
const baseFlag = args.indexOf('--base')
const baseDir = baseFlag !== -1 ? resolve(args[baseFlag + 1]) : OWN_PKG_ROOT

const exportsMap = JSON.parse(readFileSync(resolve(baseDir, 'package.json'), 'utf8')).exports
/** Every published JS subpath — non-JS assets have no named exports to snapshot. */
const subpaths = Object.keys(exportsMap).filter(
  (k) => !k.startsWith('./configs') && k !== './styles.css' && k !== './llms.txt',
)

const actual = {}
for (const subpath of subpaths) {
  const entry = exportsMap[subpath]
  const rel = typeof entry === 'string' ? entry : entry.import
  const mod = await import(pathToFileURL(resolve(baseDir, rel)).href)
  actual[subpath] = Object.keys(mod)
    .filter((k) => k !== 'default')
    .toSorted()
}

if (update) {
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(actual, null, 2)}\n`)
  console.log(`export-surface snapshot updated (${subpaths.length} subpaths) → ${SNAPSHOT_PATH}`)
  process.exit(0)
}

const expected = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'))
const failures = []
for (const subpath of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
  const want = expected[subpath] ?? []
  const got = actual[subpath] ?? []
  const missing = want.filter((k) => !got.includes(k))
  const added = got.filter((k) => !want.includes(k))
  if (missing.length > 0) failures.push(`${subpath}: missing exports: ${missing.join(', ')}`)
  if (added.length > 0) failures.push(`${subpath}: unsnapshotted exports: ${added.join(', ')}`)
}

if (failures.length > 0) {
  console.error('export-surface snapshot mismatch:')
  for (const f of failures) console.error(`  ${f}`)
  console.error(
    'If intentional: node --import scripts/css-noop-register.mjs scripts/export-surface.mjs --update',
  )
  process.exit(1)
}
console.log(`export-surface snapshot OK (${subpaths.length} subpaths)`)
