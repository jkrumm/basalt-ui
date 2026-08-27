/**
 * The release-time half of the C16 gate (`docs/CONTROLS-SPEC.md` §1): refuses a release whose
 * version has reached a grace entry's `promote` while the entry is still in the ledger.
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
 * Exports nothing on purpose — it is a one-shot process gate, not a module. The invariants it does
 * NOT own stay with the tests: `since` before `promote`, ledger ↔ shipped-preset severity, and a
 * written `why`.
 *
 * Usage: bun packages/basalt-ui/scripts/check-grace.ts <version>
 */
// oxlint-disable-next-line -- the plugin is plain JS; the ledger is a named export beside it
import { PLUGIN_RULE_GRACE } from '../configs/oxlint-plugin.js'
import { GRACE_PERIOD_KINDS } from '../src/guard/index'

type GraceEntry = { since: string; promote: string; why: string }
const pluginGrace = PLUGIN_RULE_GRACE as Record<string, GraceEntry>

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

const SEMVER = /^\d+\.\d+\.\d+/

function main(): void {
  const version = process.argv[2]
  if (version === undefined || !SEMVER.test(version)) {
    console.error('usage: bun packages/basalt-ui/scripts/check-grace.ts <version>')
    process.exit(2)
  }

  const due = [
    ...Object.entries(pluginGrace).map(([id, entry]) => [`basalt/${id}`, entry] as const),
    ...Object.entries(GRACE_PERIOD_KINDS).map(([kind, entry]) => [kind, entry] as const),
  ].filter(([, entry]) => entry !== undefined && compareSemver(version, entry.promote) >= 0)

  if (due.length > 0) {
    console.error(
      `✖ check-grace: v${version} reaches the promote version of ${due.length} grace entr` +
        `${due.length === 1 ? 'y' : 'ies'} still in the ledger:`,
    )
    for (const [id, entry] of due) {
      console.error(`  ${id} — since ${entry?.since}, promote ${entry?.promote}`)
    }
    console.error(
      '  Promote them to error (delete the entry + flip the shipped preset) or extend `promote` ' +
        'with a reason, then release again.',
    )
    process.exit(1)
  }

  const total = Object.keys(pluginGrace).length + Object.keys(GRACE_PERIOD_KINDS).length
  console.log(
    `✓ check-grace: v${version} is clear of all ${total} grace entr${total === 1 ? 'y' : 'ies'}.`,
  )
}

main()
