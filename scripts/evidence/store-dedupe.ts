/* oxlint-disable no-console -- CLI entry point: counts and failures go to the terminal */
/**
 * Store-dedupe check (V2-SPEC § 8 Store row) — counts how many copies of TanStack Store's engine
 * and of the `use-sync-external-store` `with-selector` shim a built dist carries. Reads files
 * only; needs no browser.
 *
 *   bun scripts/evidence/store-dedupe.ts <dist-dir> [--expect <n>]
 *
 * Exits 1 unless the dist carries exactly `n` (default 1) copies of each marker.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

/**
 * One match per copy, anchored on identifiers that survive minification (property names). `engine`
 * is the object `createReactiveSystem` returns (`@tanstack/store` `alien.js`), which every Store,
 * atom and router-core store links against. `storeClass` is the `Store` constructor's bind line
 * (`store.js`) and `shim` the initial ref of `useSyncExternalStoreWithSelector` (production build).
 */
export const MARKERS = {
  engine:
    /return\s*\{\s*link\s*:\s*[\w$]+\s*,\s*unlink\s*:\s*[\w$]+\s*,\s*propagate\s*:\s*[\w$]+\s*,\s*checkDirty\s*:\s*[\w$]+\s*,\s*shallowPropagate\s*:\s*[\w$]+\s*,?\s*\}/g,
  storeClass: /this\.setState\s*=\s*this\.setState\.bind\(this\)/g,
  shim: /hasValue\s*:\s*(?:!1|false)\s*,\s*value\s*:\s*null/g,
} as const

export type MarkerName = keyof typeof MARKERS
export type DedupeCounts = Record<MarkerName, { copies: number; chunks: string[] }>

/** `files` maps an emitted chunk name to its source text. */
export function countStoreCopies(files: Record<string, string>): DedupeCounts {
  const counts = {} as DedupeCounts
  for (const [name, pattern] of Object.entries(MARKERS) as Array<[MarkerName, RegExp]>) {
    const chunks: string[] = []
    let copies = 0
    for (const [file, source] of Object.entries(files)) {
      const hits = source.match(pattern)?.length ?? 0
      if (hits === 0) continue
      copies += hits
      chunks.push(file)
    }
    counts[name] = { copies, chunks: chunks.toSorted() }
  }
  return counts
}

/** Marker names whose copy count differs from `expected`. */
export function violations(counts: DedupeCounts, expected = 1): MarkerName[] {
  return (Object.keys(counts) as MarkerName[]).filter((m) => counts[m].copies !== expected)
}

function readJsFiles(distDir: string): Record<string, string> {
  const files: Record<string, string> = {}
  for (const entry of readdirSync(distDir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.[cm]?js$/.test(entry.name)) continue
    const path = join(entry.parentPath, entry.name)
    files[path.slice(distDir.length + 1)] = readFileSync(path, 'utf8')
  }
  return files
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const expectAt = args.indexOf('--expect')
  const expected = expectAt === -1 ? 1 : Number(args[expectAt + 1])
  const distDir = args.find(
    (a, i) => !a.startsWith('--') && (expectAt === -1 || i !== expectAt + 1),
  )
  if (!distDir || !Number.isInteger(expected)) {
    console.error('usage: bun scripts/evidence/store-dedupe.ts <dist-dir> [--expect <n>]')
    process.exit(2)
  }
  const files = readJsFiles(distDir)
  const counts = countStoreCopies(files)
  const gzip = Object.values(files).reduce((n, s) => n + gzipSync(s).length, 0)
  for (const [name, { copies, chunks }] of Object.entries(counts)) {
    console.log(`${name.padEnd(10)} ${copies} (${chunks.join(', ') || '-'})`)
  }
  console.log(`gzip total ${gzip} B over ${Object.keys(files).length} chunks`)
  const bad = violations(counts, expected)
  if (bad.length > 0) {
    console.error(`FAIL: expected ${expected} copy of each, wrong: ${bad.join(', ')}`)
    process.exit(1)
  }
}
