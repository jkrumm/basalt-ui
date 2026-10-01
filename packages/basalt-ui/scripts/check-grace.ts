/**
 * The release-time half of the C16 gate (`docs/CONTROLS-SPEC.md` §1): refuses a release whose
 * version has reached a grace entry's `promote` while the entry is still in the ledger — and, the
 * same gap on the deprecation side, a release whose version has reached a `DEPRECATED_EXPORTS`
 * row's `removeIn` while that export still ships. `useBreakpoint` was dated for 1.31.0, re-dated
 * to 1.33.0 and shipped in 1.33.0 anyway: the floor test went red on master only after the
 * release, exactly like the grace case below.
 *
 * The test-time gate (`configs/oxlint-plugin.test.ts`, `src/guard/grace.test.ts`) measures
 * `package.json`'s CURRENT version, which is the version already published — by construction it can
 * only go red AFTER the release that shipped the due entry. And nothing catches it there either:
 * semantic-release writes the new version in a `chore: release … [skip ci]` commit, so CI never
 * runs on it, and `release.yml` runs no tests of its own. The first unrelated push afterwards is
 * what fails, one minor too late, with the promotion only landable in the minor after that.
 *
 * So the gate needs the version that is ABOUT to be cut, which only the release dry run knows.
 * `scripts/release.sh` reads it back and calls this script with it, before the confirm prompt.
 *
 * The ledger checks are a pure function (`findReleaseBlockers`) so `check-grace.test.ts` can feed
 * it a ledger; running the file is the one-shot process gate. The invariants it does NOT own stay
 * with the tests: `since` before `promote`, ledger ↔ shipped-preset severity, a written `why`, and a
 * live deprecation row dated at least one minor out.
 *
 * "Still ships" reads `scripts/export-surface.json` — the snapshot `make verify` pins to the built
 * dist — for an import row. A prop row has no snapshot to read, so it counts as shipped until the
 * row says `removed: true`; a `removed` import row that is still in the snapshot is refused too.
 *
 * Usage: bun packages/basalt-ui/scripts/check-grace.ts <version>
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
// oxlint-disable-next-line -- the plugin is plain JS; the ledgers are named exports beside it
import { DEPRECATED_EXPORTS, PLUGIN_RULE_GRACE } from '../configs/oxlint-plugin.js'
import { GRACE_PERIOD_KINDS } from '../src/guard/index'

type GraceEntry = { since: string; promote: string; why: string }
type DeprecationRow = {
  subpath: string
  name: string
  prop?: string
  removeIn: string
  removed?: true
}
/** Published subpath (`.`, `./tokens`, …) → value export names, as `export-surface.json` holds. */
type ExportSurface = Record<string, readonly string[]>

/** Numeric per-component compare, so `1.9.0 < 1.10.0` — a string compare gets that backwards. */
function compareSemver(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

function stillShips(row: DeprecationRow, surface: ExportSurface): boolean {
  if (row.prop !== undefined) return row.removed !== true
  const subpath = row.subpath === 'basalt-ui' ? '.' : row.subpath.replace('basalt-ui', '.')
  return surface[subpath]?.includes(row.name) === true
}

/** Every reason `version` may not be released, one line each; empty means clear. */
export function findReleaseBlockers({
  version,
  grace,
  deprecations,
  surface,
}: {
  version: string
  grace: Record<string, GraceEntry | undefined>
  deprecations: readonly DeprecationRow[]
  surface: ExportSurface
}): string[] {
  const blockers: string[] = []
  for (const [id, entry] of Object.entries(grace)) {
    if (entry === undefined || compareSemver(version, entry.promote) < 0) continue
    blockers.push(
      `${id} — grace since ${entry.since}, promote ${entry.promote}: promote it to error (delete ` +
        'the entry + flip the shipped preset) or extend `promote` with a reason',
    )
  }
  for (const row of deprecations) {
    if (compareSemver(version, row.removeIn) < 0 || !stillShips(row, surface)) continue
    const what = row.prop === undefined ? `${row.name} (${row.subpath})` : `${row.name} ${row.prop}`
    blockers.push(
      `${what} — deprecated, removeIn ${row.removeIn}, still ships: remove it (its own commit, ` +
        'packages/basalt-ui/CLAUDE.md § Deprecation lifecycle) or re-date `removeIn` with a reason',
    )
  }
  return blockers
}

const SEMVER = /^\d+\.\d+\.\d+/

function main(): void {
  const version = process.argv[2]
  if (version === undefined || !SEMVER.test(version)) {
    console.error('usage: bun packages/basalt-ui/scripts/check-grace.ts <version>')
    process.exit(2)
  }

  const grace: Record<string, GraceEntry | undefined> = {
    ...Object.fromEntries(
      Object.entries(PLUGIN_RULE_GRACE as Record<string, GraceEntry>).map(([id, entry]) => [
        `basalt/${id}`,
        entry,
      ]),
    ),
    ...GRACE_PERIOD_KINDS,
  }
  const deprecations = DEPRECATED_EXPORTS as readonly DeprecationRow[]
  const surface = JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'export-surface.json'), 'utf8'),
  ) as ExportSurface
  const blockers = findReleaseBlockers({ version, grace, deprecations, surface })

  if (blockers.length > 0) {
    console.error(
      `✖ check-grace: v${version} is blocked by ${blockers.length} ledger entr` +
        `${blockers.length === 1 ? 'y' : 'ies'}:`,
    )
    for (const line of blockers) console.error(`  ${line}`)
    console.error('  Fix them, then release again.')
    process.exit(1)
  }

  const graceCount = Object.keys(grace).length
  console.log(
    `✓ check-grace: v${version} is clear of all ${graceCount} grace entr` +
      `${graceCount === 1 ? 'y' : 'ies'} and ${deprecations.length} deprecation ` +
      `row${deprecations.length === 1 ? '' : 's'}.`,
  )
}

if (import.meta.main) main()
