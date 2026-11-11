/**
 * Test-ledger gate for the v3 migration (docs/v3/concepts/migration-release.md section 8, "Ledger,
 * one file per area"). The 2.x suite is 429 test files; the ledger gives each one a disposition so a
 * port is never skipped or retired by accident. One JSON file per area keeps parallel leads off one
 * shared file: `tools/migrate-v3/ledger/<area>.json` is `{ area, status, rows }`, and
 * `manifest.json` records the 2.x file list (and the `git ls-tree` command that produced it).
 *
 * The check unions the area files and fails when:
 *  - a 2.x test file in the manifest has no row, has two rows, or a row names a file not in it;
 *  - a row has an unknown disposition or class, or a missing target where one is required;
 *  - a `retire` row cites neither a kill-list item (`kill-list: <text found in section 14>`) nor a
 *    migration row (`migration-row: <id>`);
 *  - a row that is not `retire` names no invariant: `laws` entries are a digest section 3 area
 *    label, optionally followed by `: <detail>`;
 *  - an area marked `closed` has a `port`, `swap`, `retarget` or `rewrite` target that does not exist.
 *
 * `--report` prints bucket totals next to the section 8 figures so a PR can explain any difference.
 * `--verify-source` additionally re-runs the recorded `git ls-tree` and compares the manifest to it
 * (needs the `v2` ref, so it is opt-in and not part of `make check`).
 *
 * Deleted with `tools/migrate-v3/` at fleet green.
 *
 * Usage: bun packages/basalt-ui/scripts/check-test-ledger.ts [--report] [--verify-source]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const DISPOSITIONS = ['port', 'audit', 'retire', 'swap', 'retarget', 'rewrite'] as const
export type Disposition = (typeof DISPOSITIONS)[number]

/** Section 8 classes: `ab` portable, `c` provider swap, `def` rewrite, `layout` the layout suite. */
export const CLASSES = ['ab', 'c', 'def', 'layout'] as const
export type TestClass = (typeof CLASSES)[number]

export type LedgerRow = {
  file: string
  area: string
  class: TestClass
  disposition: Disposition
  target: string | null
  laws: string[]
  cites?: string
}

export type Ledger = { area: string; status: 'open' | 'closed'; rows: LedgerRow[] }

export type Manifest = {
  ref: string
  sha?: string
  command: string
  count: number
  files: string[]
}

export type Failure = { where: string; message: string }

/** Dispositions whose row must name where the test lands. */
const NEEDS_TARGET: ReadonlySet<Disposition> = new Set(['port', 'swap', 'retarget', 'rewrite'])

/** Section 8 table, as claimed. `retire`/`audit` appear twice: the portable block and the provider-swap block. */
export const SECTION_8: ReadonlyArray<{ bucket: string; claimed: number }> = [
  { bucket: 'port (portable)', claimed: 115 },
  { bucket: 'audit (portable)', claimed: 12 },
  { bucket: 'retire (portable)', claimed: 23 },
  { bucket: 'swap only', claimed: 29 },
  { bucket: 'retarget, charts', claimed: 35 },
  { bucket: 'retarget, composites', claimed: 50 },
  { bucket: 'audit (provider swap)', claimed: 4 },
  { bucket: 'retire (provider swap)', claimed: 18 },
  { bucket: 'rewrite (D, E, F)', claimed: 62 },
  { bucket: 'layout port', claimed: 49 },
  { bucket: 'layout re-point', claimed: 32 },
]

export function bucketOf(row: LedgerRow): string {
  const { class: cls, disposition: d } = row
  if (cls === 'layout') return d === 'retarget' ? 'layout re-point' : 'layout port'
  if (cls === 'def') return 'rewrite (D, E, F)'
  if (cls === 'ab') return `${d} (portable)`
  if (d === 'swap') return 'swap only'
  if (d === 'retarget') return row.area === 'charts' ? 'retarget, charts' : 'retarget, composites'
  return `${d} (provider swap)`
}

export function bucketTotals(rows: readonly LedgerRow[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(bucketOf(row), (totals.get(bucketOf(row)) ?? 0) + 1)
  return totals
}

export function formatReport(rows: readonly LedgerRow[]): string {
  const totals = bucketTotals(rows)
  const known = new Set(SECTION_8.map((s) => s.bucket))
  const lines = ['| bucket | rows | section 8 | diff |', '|-|-|-|-|']
  for (const { bucket, claimed } of SECTION_8) {
    const n = totals.get(bucket) ?? 0
    lines.push(`| ${bucket} | ${n} | ${claimed} | ${n - claimed >= 0 ? '+' : ''}${n - claimed} |`)
  }
  for (const [bucket, n] of totals)
    if (!known.has(bucket)) lines.push(`| ${bucket} | ${n} | n/a | n/a |`)
  const claimedTotal = SECTION_8.reduce((sum, s) => sum + s.claimed, 0)
  lines.push(
    `| total | ${rows.length} | ${claimedTotal} | ${rows.length - claimedTotal >= 0 ? '+' : ''}${rows.length - claimedTotal} |`,
  )
  return lines.join('\n')
}

// ── Inputs ────────────────────────────────────────────────────────────────────

const repoRoot = join(import.meta.dirname, '..', '..', '..')
const ledgerDir = join(repoRoot, 'tools', 'migrate-v3', 'ledger')
const MANIFEST_FILE = 'manifest.json'

export function loadLedgers(dir: string): Ledger[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== MANIFEST_FILE)
    .toSorted()
    .map(
      (f) => ({ ...(JSON.parse(readFileSync(join(dir, f), 'utf8')) as Ledger), file: f }) as Ledger,
    )
}

export function loadManifest(dir: string): Manifest {
  return JSON.parse(readFileSync(join(dir, MANIFEST_FILE), 'utf8')) as Manifest
}

/** The `Area` column of the digest's section 3 table: the labels a `laws` entry may start with. */
export function parseLawLabels(digest: string): Set<string> {
  const start = digest.indexOf('## 3. Must-survive invariants')
  if (start < 0) return new Set()
  const rest = digest.slice(start + 3)
  const end = rest.search(/^## /m)
  const section = end < 0 ? rest : rest.slice(0, end)
  const labels = new Set<string>()
  for (const line of section.split('\n')) {
    if (!line.startsWith('|')) continue
    const cell = line.split('|')[1]?.trim()
    if (cell && cell !== 'Area' && !/^-+$/.test(cell)) labels.add(cell)
  }
  return labels
}

/** The body of the concept's section 14, the text a `kill-list:` citation must quote. */
export function parseKillList(concept: string): string {
  const start = concept.indexOf('## 14. Kill list')
  if (start < 0) return ''
  const rest = concept.slice(start + 3)
  const end = rest.search(/^## /m)
  return end < 0 ? rest : rest.slice(0, end)
}

// ── Check ─────────────────────────────────────────────────────────────────────

export type CheckInput = {
  ledgers: readonly Ledger[]
  manifest: Manifest
  lawLabels: ReadonlySet<string>
  killList: string
  /** Path relative to the repo root; injected so tests need no file tree. */
  exists: (path: string) => boolean
}

function lawResolves(law: string, labels: ReadonlySet<string>): boolean {
  for (const label of labels) if (law === label || law.startsWith(`${label}: `)) return true
  return false
}

function citeResolves(cites: string | undefined, killList: string): string | undefined {
  if (!cites) return 'retire row cites nothing: name a kill-list item or a migration row'
  const kill = /^kill-list:\s*(.+)$/.exec(cites)
  if (kill) {
    return killList.toLowerCase().includes(kill[1]!.trim().toLowerCase())
      ? undefined
      : `kill-list citation "${kill[1]!.trim()}" is not in migration-release.md section 14`
  }
  if (/^migration-row:\s*\S/.test(cites)) return undefined
  return `retire cite "${cites}" is neither "kill-list: <item>" nor "migration-row: <id>"`
}

export function checkLedgers(input: CheckInput): Failure[] {
  const { ledgers, manifest, lawLabels, killList, exists } = input
  const failures: Failure[] = []
  const fail = (where: string, message: string) => failures.push({ where, message })

  if (manifest.count !== manifest.files.length) {
    fail(
      MANIFEST_FILE,
      `count ${manifest.count} does not match ${manifest.files.length} listed files`,
    )
  }
  if (new Set(manifest.files).size !== manifest.files.length)
    fail(MANIFEST_FILE, 'lists a file twice')

  const inManifest = new Set(manifest.files)
  const seen = new Map<string, string>()

  for (const ledger of ledgers) {
    const area = ledger.area
    if (ledger.status !== 'open' && ledger.status !== 'closed') {
      fail(area, `status must be "open" or "closed", got ${JSON.stringify(ledger.status)}`)
    }
    for (const row of ledger.rows) {
      const where = row.file
      if (row.area !== area) fail(where, `row area "${row.area}" sits in the "${area}" ledger`)
      if (!inManifest.has(row.file)) fail(where, 'is not in the 2.x file list (manifest.json)')
      const previous = seen.get(row.file)
      if (previous !== undefined) fail(where, `is named twice (areas "${previous}" and "${area}")`)
      seen.set(row.file, area)

      if (!DISPOSITIONS.includes(row.disposition)) {
        fail(where, `unknown disposition "${row.disposition}"`)
        continue
      }
      if (!CLASSES.includes(row.class)) fail(where, `unknown class "${row.class}"`)
      if (NEEDS_TARGET.has(row.disposition) && !row.target) {
        fail(where, `${row.disposition} row has no target path`)
      }
      if (row.disposition === 'retire') {
        const problem = citeResolves(row.cites, killList)
        if (problem) fail(where, problem)
        continue
      }
      if (!Array.isArray(row.laws) || row.laws.length === 0) {
        fail(
          where,
          `${row.disposition} row names no invariant in laws (digest section 3 area label)`,
        )
      } else {
        for (const law of row.laws) {
          if (!lawResolves(law, lawLabels))
            fail(where, `law "${law}" is not a digest section 3 area label`)
        }
      }
      if (ledger.status === 'closed' && row.target && !exists(row.target)) {
        fail(
          where,
          `${row.disposition} target ${row.target} does not exist but area "${area}" is closed`,
        )
      }
    }
  }

  for (const file of manifest.files) {
    if (!seen.has(file)) fail(file, 'has no ledger row: every 2.x test file must be named once')
  }
  return failures
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function verifySource(manifest: Manifest): Failure[] {
  const proc = Bun.spawnSync(
    ['git', 'ls-tree', '-r', '--name-only', manifest.ref, '--', 'packages/basalt-ui'],
    {
      cwd: repoRoot,
    },
  )
  if (proc.exitCode !== 0)
    return [
      {
        where: MANIFEST_FILE,
        message: `git ls-tree ${manifest.ref} failed: ${proc.stderr.toString().trim()}`,
      },
    ]
  const live = proc.stdout
    .toString()
    .split('\n')
    .filter((f) => /\.(test|spec)\.(ts|tsx)$/.test(f))
  const listed = new Set(manifest.files)
  const liveSet = new Set(live)
  return [
    ...live
      .filter((f) => !listed.has(f))
      .map((f) => ({ where: f, message: `is in ${manifest.ref} but not in the manifest` })),
    ...manifest.files
      .filter((f) => !liveSet.has(f))
      .map((f) => ({ where: f, message: `is in the manifest but not in ${manifest.ref}` })),
  ]
}

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '')

function main(argv: readonly string[]): void {
  const ledgers = loadLedgers(ledgerDir)
  const manifest = loadManifest(ledgerDir)
  const failures = checkLedgers({
    ledgers,
    manifest,
    lawLabels: parseLawLabels(read(join(repoRoot, 'docs', 'v3', 'DISCOVERY-DIGEST.md'))),
    killList: parseKillList(read(join(repoRoot, 'docs', 'v3', 'concepts', 'migration-release.md'))),
    exists: (path) => existsSync(join(repoRoot, path)),
  })
  if (argv.includes('--verify-source')) failures.push(...verifySource(manifest))

  const rows = ledgers.flatMap((l) => l.rows)
  if (failures.length > 0) {
    console.error(`✖ test-ledger: ${failures.length} failure(s)`)
    for (const f of failures) console.error(`  ${f.where}: ${f.message}`)
    process.exit(1)
  }
  if (argv.includes('--report')) console.log(formatReport(rows))
  console.log(
    `✓ test-ledger: ${rows.length} rows in ${ledgers.length} areas, ${manifest.files.length} 2.x test files, 0 failures`,
  )
}

// Only run when executed directly (not when imported by the test suite)
if (import.meta.path === Bun.main) {
  main(process.argv.slice(2))
}
